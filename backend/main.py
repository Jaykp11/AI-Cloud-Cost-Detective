import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

import jwt
from asyncpg.exceptions import UniqueViolationError
from dotenv import load_dotenv
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from starlette.concurrency import run_in_threadpool

import db
from ai_analyzer import analyze_resources
from auth import (
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    create_access_token,
    get_current_user,
    hash_password,
    validate_auth_config,
    verify_password,
)
from aws_scanner import (
    AWSCLINotInstalledError,
    AWSCommandError,
    AWSCredentialsError,
    AWSPermissionError,
    AWSScanner,
)

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FRONTEND_ORIGIN = os.getenv(
    "FRONTEND_ORIGIN",
    "http://localhost:5173",
)


# --------------------------------------------------
# WebSocket Progress Manager
# --------------------------------------------------

class ProgressManager:
    """Manage WebSocket clients subscribed to analysis progress."""

    def __init__(self):
        self.connections: dict[UUID, set[WebSocket]] = {}
        self.recent_events: dict[UUID, list[dict[str, Any]]] = {}

    async def connect(
        self,
        analysis_id: UUID,
        websocket: WebSocket,
    ) -> None:
        await websocket.accept()

        self.connections.setdefault(
            analysis_id,
            set(),
        ).add(websocket)

        # Replay recent progress events to avoid missing early updates.
        for event in self.recent_events.get(analysis_id, []):
            await websocket.send_json(event)

    def disconnect(
        self,
        analysis_id: UUID,
        websocket: WebSocket,
    ) -> None:
        clients = self.connections.get(analysis_id)

        if clients is None:
            return

        clients.discard(websocket)

        if not clients:
            self.connections.pop(analysis_id, None)

    async def send(
        self,
        analysis_id: UUID,
        message: str,
        progress_status: str = "in_progress",
    ) -> None:
        clients = list(
            self.connections.get(analysis_id, set())
        )

        payload = {
            "analysis_id": str(analysis_id),
            "status": progress_status,
            "message": message,
            "timestamp": datetime.now(
                timezone.utc
            ).isoformat(),
        }

        events = self.recent_events.setdefault(
            analysis_id,
            [],
        )
        events.append(payload)
        del events[:-20]

        # Bound memory usage by limiting retained analysis histories.
        while len(self.recent_events) > 100:
            oldest_analysis_id = next(iter(self.recent_events))

            if (
                oldest_analysis_id == analysis_id
                and len(self.recent_events) > 1
            ):
                oldest_analysis_id = next(
                    key
                    for key in self.recent_events
                    if key != analysis_id
                )

            self.recent_events.pop(oldest_analysis_id, None)

        # FIX: Initialize this list before collecting stale connections.
        stale_clients: list[WebSocket] = []

        for websocket in clients:
            try:
                await websocket.send_json(payload)
            except Exception:
                logger.debug(
                    "Removing stale WebSocket client for analysis %s.",
                    analysis_id,
                    exc_info=True,
                )
                stale_clients.append(websocket)

        for websocket in stale_clients:
            self.disconnect(analysis_id, websocket)


progress_manager = ProgressManager()


# --------------------------------------------------
# Application Lifecycle
# --------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_auth_config()

    await db.connect_db()
    logger.info("Database initialized.")

    try:
        yield
    finally:
        await db.close_db()


app = FastAPI(
    title="AI Cloud Cost Detective API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# --------------------------------------------------
# Request Models
# --------------------------------------------------

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=128,
    )


class AnalyzeRequest(BaseModel):
    region: str = Field(
        min_length=1,
        max_length=64,
    )
    analysis_id: UUID


# --------------------------------------------------
# Response Serialization
# --------------------------------------------------

def json_safe(value: Any) -> Any:
    """Convert values into JSON-compatible representations."""

    if isinstance(value, UUID):
        return str(value)

    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)

        return value.astimezone(timezone.utc).isoformat()

    if isinstance(value, dict):
        return {
            str(key): json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]

    if isinstance(value, (str, int, float, bool)) or value is None:
        return value

    return str(value)


# --------------------------------------------------
# Savings Summary
# --------------------------------------------------

def format_estimated_savings(
    analysis: dict[str, Any],
) -> str:
    """
    Convert estimated monthly savings into a readable summary.
    Do not invent savings when the analyzer has no estimate.
    """

    savings_data = analysis.get("estimated_monthly_savings")

    if not isinstance(savings_data, dict):
        return "Not estimated"

    amount = savings_data.get("amount")

    if amount is None:
        return "Not estimated"

    currency = savings_data.get("currency", "USD")

    return f"{currency} {amount}"


# --------------------------------------------------
# AWS Region Discovery
# --------------------------------------------------

def get_enabled_regions() -> list[dict[str, Any]]:
    """Return AWS regions that are enabled or do not require opt-in."""

    scanner = AWSScanner(region="us-east-1")

    response = scanner._run_command(
        [
            "ec2",
            "describe-regions",
            "--all-regions",
        ]
    )

    regions = [
        {
            "name": region.get("RegionName"),
            "endpoint": region.get("Endpoint"),
            "opt_in_status": region.get("OptInStatus"),
        }
        for region in response.get("Regions", [])
        if region.get("OptInStatus")
        in ("opt-in-not-required", "opted-in")
    ]

    return sorted(
        regions,
        key=lambda region: region["name"] or "",
    )


# --------------------------------------------------
# AWS Exception Handling
# --------------------------------------------------

def http_error(exc: Exception) -> None:
    """Translate known AWS errors into HTTP responses."""

    if isinstance(exc, AWSCLINotInstalledError):
        code = status.HTTP_503_SERVICE_UNAVAILABLE
    elif isinstance(exc, AWSCredentialsError):
        code = status.HTTP_401_UNAUTHORIZED
    elif isinstance(exc, AWSPermissionError):
        code = status.HTTP_403_FORBIDDEN
    else:
        code = status.HTTP_502_BAD_GATEWAY

    raise HTTPException(
        status_code=code,
        detail=str(exc),
    ) from exc


# --------------------------------------------------
# Health Check
# --------------------------------------------------

@app.get("/")
async def health_check():
    return {
        "status": "healthy",
        "service": "AI Cloud Cost Detective API",
    }


# --------------------------------------------------
# Authentication: Signup
# --------------------------------------------------

@app.post(
    "/api/auth/signup",
    status_code=status.HTTP_201_CREATED,
)
async def signup(request: SignupRequest):
    email = str(request.email).strip().lower()
    user_id = uuid4()
    hashed_password = hash_password(request.password)

    try:
        user = await db.create_user(
            user_id=user_id,
            email=email,
            password_hash=hashed_password,
        )
    except UniqueViolationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc

    return {
        "message": "Account created successfully.",
        "user": json_safe(user),
    }


# --------------------------------------------------
# Authentication: Login
# --------------------------------------------------

@app.post("/api/auth/login")
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
):
    email = form.username.strip().lower()
    user = await db.get_user_by_email(email)

    if user is None or not verify_password(
        form.password,
        user["password_hash"],
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(user["id"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": int(
            os.getenv(
                "JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
                "60",
            )
        ) * 60,
    }


# --------------------------------------------------
# Authentication: Current User
# --------------------------------------------------

@app.get("/api/auth/me")
async def current_user(
    user: dict = Depends(get_current_user),
):
    return {
        "id": str(user["id"]),
        "email": user["email"],
        "created_at": json_safe(user["created_at"]),
    }


# --------------------------------------------------
# List AWS Regions
# --------------------------------------------------

@app.get("/api/regions")
async def list_regions(
    user: dict = Depends(get_current_user),
):
    try:
        regions = await run_in_threadpool(
            get_enabled_regions
        )

        return {
            "regions": regions,
        }

    except (
        AWSCLINotInstalledError,
        AWSCredentialsError,
        AWSPermissionError,
        AWSCommandError,
    ) as exc:
        http_error(exc)


# --------------------------------------------------
# Analysis History
# --------------------------------------------------

@app.get("/api/history")
async def analysis_history(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    rows = await db.get_user_analyses(
        user_id=user["id"],
        limit=limit,
        offset=offset,
    )

    return {
        "analyses": [
            json_safe(row)
            for row in rows
        ],
        "limit": limit,
        "offset": offset,
    }


@app.get("/api/history/{analysis_id}")
async def analysis_report(
    analysis_id: UUID,
    user: dict = Depends(get_current_user),
):
    """Return a saved report only if it belongs to the current user."""

    record = await db.get_user_analysis(
        analysis_id=analysis_id,
        user_id=user["id"],
    )

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found.",
        )

    return json_safe(record)


# --------------------------------------------------
# WebSocket Progress
# --------------------------------------------------

@app.websocket("/ws/progress/{analysis_id}")
async def websocket_progress(
    websocket: WebSocket,
    analysis_id: UUID,
    token: str = Query(...),
):
    """Authenticate a WebSocket connection and stream progress."""

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        subject = payload.get("sub")

        if not subject:
            raise ValueError("Missing token subject.")

        user_id = UUID(subject)
        user = await db.get_user_by_id(user_id)

        if user is None:
            raise ValueError("User not found.")

        # Wait briefly for the analysis request to create its record.
        owned_analysis = None

        for _ in range(40):
            owned_analysis = await db.get_user_analysis(
                analysis_id=analysis_id,
                user_id=user_id,
            )

            if owned_analysis is not None:
                break

            await asyncio.sleep(0.25)

        if owned_analysis is None:
            raise ValueError(
                "Analysis does not exist or is not owned by this user."
            )

    except Exception:
        await websocket.close(code=1008)
        return

    await progress_manager.connect(
        analysis_id,
        websocket,
    )

    try:
        await websocket.send_json(
            {
                "analysis_id": str(analysis_id),
                "status": "connected",
                "message": "Connected to analysis progress.",
            }
        )

        while True:
            message = await websocket.receive_text()

            if message == "ping":
                await websocket.send_json(
                    {
                        "analysis_id": str(analysis_id),
                        "status": "connected",
                        "message": "pong",
                    }
                )

    except WebSocketDisconnect:
        pass

    finally:
        progress_manager.disconnect(
            analysis_id,
            websocket,
        )


# --------------------------------------------------
# AWS Infrastructure and AI Cost Analysis
# --------------------------------------------------

@app.post("/api/analyze")
async def analyze_infrastructure(
    request: AnalyzeRequest,
    user: dict = Depends(get_current_user),
):
    analysis_id = request.analysis_id
    region = request.region.strip()

    if not region:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AWS region cannot be empty.",
        )

    # Create the record before beginning the workflow.
    try:
        await db.create_analysis(
            analysis_id=analysis_id,
            user_id=user["id"],
            region=region,
        )

    except UniqueViolationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This analysis ID has already been used.",
        ) from exc

    try:
        # Step 1: Scan AWS infrastructure.
        await progress_manager.send(
            analysis_id,
            "Querying AWS Cost Explorer for active services...",
        )

        await progress_manager.send(
            analysis_id,
            f"Scanning active services in {region}...",
        )

        logger.info(
            "Starting AWS resource scan for region %s.",
            region,
        )

        result = await run_in_threadpool(
            lambda: AWSScanner(region).analyze()
        )

        resources = result.get("resources", [])

        if not isinstance(resources, list):
            raise RuntimeError(
                "AWS scanner returned an invalid resources collection."
            )

        logger.info(
            "AWS scan completed. Found %d resources.",
            len(resources),
        )

        if not result.get("active_services"):
            result["message"] = (
                "No positive unblended costs were found "
                "for the current billing period. "
                "Resources may still exist."
            )

        if not result.get("complete", False):
            logger.warning(
                "AWS scan is incomplete for region %s.",
                region,
            )

        # Step 2: AI analysis.
        await progress_manager.send(
            analysis_id,
            "Analyzing costs with AI...",
        )

        analysis = await run_in_threadpool(
            analyze_resources,
            resources,
        )

        if not isinstance(analysis, dict):
            raise RuntimeError(
                "AI analyzer returned an invalid response."
            )

        result["analysis"] = analysis

        # Step 3: Calculate summary values.
        issues = analysis.get("issues", [])

        issues_found = (
            len(issues)
            if isinstance(issues, list)
            else 0
        )

        savings = format_estimated_savings(analysis)

        # Step 4: Persist the results.
        await progress_manager.send(
            analysis_id,
            "Storing results...",
        )

        await db.update_analysis(
            analysis_id=analysis_id,
            user_id=user["id"],
            status="completed",
            resources_scanned=len(resources),
            issues_found=issues_found,
            estimated_savings=savings,
            analysis_result=result,
        )

        # Step 5: Notify clients that the analysis has completed.
        await progress_manager.send(
            analysis_id,
            "Analysis complete",
            progress_status="completed",
        )

        return json_safe(
            {
                **result,
                "analysis_id": analysis_id,
            }
        )

    except HTTPException:
        raise

    except (
        AWSCLINotInstalledError,
        AWSCredentialsError,
        AWSPermissionError,
        AWSCommandError,
    ) as exc:
        logger.warning(
            "AWS operation failed for analysis %s: %s",
            analysis_id,
            exc,
        )

        try:
            await db.update_analysis(
                analysis_id=analysis_id,
                user_id=user["id"],
                status="failed",
                analysis_result={
                    "error": str(exc),
                },
            )

            await progress_manager.send(
                analysis_id,
                "Analysis failed because an AWS operation was unsuccessful.",
                progress_status="failed",
            )

        except Exception:
            logger.exception(
                "Could not persist AWS failure for analysis %s.",
                analysis_id,
            )

        http_error(exc)

    except Exception as exc:
        logger.exception(
            "Analysis failed for ID %s.",
            analysis_id,
        )

        try:
            await db.update_analysis(
                analysis_id=analysis_id,
                user_id=user["id"],
                status="failed",
                analysis_result={
                    "error": "Analysis failed.",
                },
            )

            await progress_manager.send(
                analysis_id,
                "Analysis failed. Check the backend logs.",
                progress_status="failed",
            )

        except Exception:
            logger.exception(
                "Could not persist failure for analysis %s.",
                analysis_id,
            )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Analysis failed. Check the backend logs.",
        ) from exc
