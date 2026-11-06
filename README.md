# AI Cloud Cost Detective

React + TypeScript frontend, FastAPI backend, PostgreSQL persistence, AWS CLI discovery, and Ollama-powered optimization analysis.

## Prerequisites

- Python 3.13 recommended
- Node.js 22+ and npm
- Docker Desktop
- AWS CLI configured with read-only permissions for the AWS services this app scans
- Ollama installed with the `llama3.2` model available

## 1. Start PostgreSQL

From the repository root:

```bash
docker compose up -d
```

## 2. Configure and start the backend

In Git Bash, from the repository root:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set a unique `JWT_SECRET_KEY` (at least 32 characters), your local database URL, Ollama settings, and `FRONTEND_ORIGIN=http://localhost:5173`. Do not commit `.env` or share it.

Create a Python 3.13 environment if you do not already have one, then install dependencies:

```bash
python -m venv venv313
source venv313/Scripts/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

If `venv313` already exists, skip the `python -m venv venv313` command and activate the existing environment instead.

Keep this terminal running. API docs are available at `http://127.0.0.1:8000/docs`.

## 3. Configure and start the frontend

Open a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). `VITE_API_BASE_URL` defaults to `http://127.0.0.1:8000` in `.env.example`.

## End-to-end user flow

1. Create an account at `/signup`.
2. Sign in at `/login`; the JWT is saved in browser local storage and attached to protected HTTP requests as `Authorization: Bearer <token>`.
3. Select an AWS region on the dashboard and choose **Run Analysis**.
4. The frontend opens the authenticated WebSocket for the analysis ID and submits `POST /api/analyze`. The backend buffers/replays early progress events so the UI can receive progress even if the WebSocket handshake and analysis request race.
5. Open the report to review resource counts, issues, estimated monthly/yearly savings, recommendations, and copyable suggested AWS CLI remediation commands.
6. Open **History** to revisit reports saved for the signed-in account.

## Authentication and safety

- `/api/regions`, `/api/analyze`, `/api/history`, and `/api/history/{analysis_id}` require a valid JWT.
- Report retrieval is scoped to the authenticated user. WebSocket connections validate the JWT and confirm ownership of the requested analysis.
- The WebSocket uses a `token` query parameter because browser WebSocket APIs do not support setting arbitrary authorization headers. Use HTTPS/WSS in deployed environments and never log or share token-bearing URLs.
- Suggested remediation commands are displayed for review only; the app does not execute them automatically. Inspect every command and approval requirement before running it.
- Do not create AWS resources solely to test the app. Cost Explorer data may be empty or delayed, and no savings amount is displayed when the analyzer cannot support an estimate.
