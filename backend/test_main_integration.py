
from uuid import uuid4

from fastapi.testclient import TestClient

import main
import db
from ai_analyzer import analyze_resources


# --------------------------------------------------
# Synthetic AWS resource
# --------------------------------------------------

SYNTHETIC_RESOURCES = [
    {
        "service": "ec2",
        "resource_type": "EC2 Instance",
        "identifier": "SYNTHETIC-TEST-NOT-A-REAL-AWS-RESOURCE",
        "name": "Synthetic test instance",
        "region": "ap-south-1",
        "specifications": {
            "instance_type": "t3.micro",
            "state": "stopped",
        },
        "tags": [],
        "tagged": False,
    }
]


# --------------------------------------------------
# Mock AWS scanner
# --------------------------------------------------

class FakeAWSScanner:
    """Return synthetic inventory without calling AWS."""

    def __init__(self, region):
        self.region = region

    def analyze(self):
        return {
            "region": self.region,
            "billing_period": {
                "start": "2026-10-01",
                "end_exclusive": "2026-10-16",
                "metric": "UnblendedCost",
            },
            "active_services": [],
            "billing_error": None,
            "scanned_services": [
                {
                    "scanner": "ec2",
                    "resource_count": 1,
                    "status": "success",
                }
            ],
            "unsupported_services": [],
            "resources": SYNTHETIC_RESOURCES,
            "resource_count": len(SYNTHETIC_RESOURCES),
            "scan_errors": [],
            "complete": True,
        }


# --------------------------------------------------
# Mock database operations
# --------------------------------------------------

async def fake_create_analysis(**kwargs):
    return None


async def fake_update_analysis(**kwargs):
    return None


# --------------------------------------------------
# Integration test
# --------------------------------------------------

def test_analyze_endpoint_with_synthetic_resource(monkeypatch):
    """
    Exercise the real /api/analyze route.

    AWS scanning and database writes are mocked.
    Authentication is overridden through FastAPI.
    The real analyzer and Ollama model are used.
    """

    test_user = {
        "id": uuid4(),
        "email": "integration-test@example.com",
    }

    async def fake_current_user():
        return test_user

    # Replace the AWS scanner used by main.py.
    monkeypatch.setattr(
        main,
        "AWSScanner",
        FakeAWSScanner,
    )

    # Prevent real database writes.
    monkeypatch.setattr(
        db,
        "create_analysis",
        fake_create_analysis,
    )

    monkeypatch.setattr(
        db,
        "update_analysis",
        fake_update_analysis,
    )

    # Override the dependency registered with FastAPI.
    main.app.dependency_overrides[
        main.get_current_user
    ] = fake_current_user

    # Ensure the endpoint uses the real AI analyzer.
    monkeypatch.setattr(
        main,
        "analyze_resources",
        analyze_resources,
    )

    try:
        # Do not enter the application lifespan here:
        # this test mocks the database and does not need
        # a real database connection.
        with TestClient(
            main.app,
            raise_server_exceptions=True,
        ) as client:

            response = client.post(
                "/api/analyze",
                json={
                    "region": "ap-south-1",
                    "analysis_id": str(uuid4()),
                },
            )

        # Verify HTTP response.
        assert response.status_code == 200, response.text

        payload = response.json()

        assert payload["region"] == "ap-south-1"
        assert payload["resource_count"] == 1
        assert len(payload["resources"]) == 1
        assert payload["complete"] is True

        assert (
            payload["resources"][0]["identifier"]
            == "SYNTHETIC-TEST-NOT-A-REAL-AWS-RESOURCE"
        )

        assert "analysis" in payload

        # Verify the AI response structure.
        analysis = payload["analysis"]

        assert isinstance(analysis, dict)
        assert isinstance(analysis.get("summary"), str)
        assert isinstance(
            analysis.get("estimated_monthly_savings"),
            dict,
        )
        assert isinstance(analysis.get("issues"), list)
        assert isinstance(
            analysis.get("additional_data_required"),
            list,
        )
        assert isinstance(
            analysis.get("limitations"),
            list,
        )

        assert payload["analysis_id"] is not None

        print("\nIntegration test passed.")
        print("HTTP status:", response.status_code)
        print("Resource count:", payload["resource_count"])
        print("Analysis summary:", analysis["summary"])
        print(
            "Estimated monthly savings:",
            analysis["estimated_monthly_savings"],
        )

    finally:
        # Avoid leaking the authentication override into
        # other tests.
        main.app.dependency_overrides.pop(
            main.get_current_user,
            None,
        )

