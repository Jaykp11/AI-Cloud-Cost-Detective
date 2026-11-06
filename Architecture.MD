# Architecture

## AI Cloud Cost Detective

AI Cloud Cost Detective is a web application that inspects active AWS services, gathers their configuration metadata, and uses a local Ollama model to produce cost-optimization analysis and recommendations. The React frontend communicates with a FastAPI backend, which coordinates AWS CLI commands, progress updates, AI analysis, and PostgreSQL persistence.

> **Terminology note:** The workflow below uses an AWS **region**. “Resource Group” is an AWS-specific concept only if the application explicitly implements AWS Resource Groups; it is not interchangeable with a region.

## High-Level Architecture

```text
                              ┌──────────────┐
                              │     USER     │
                              └──────┬───────┘
                                     │
                                     ▼
                           ┌───────────────────┐
                           │  REACT FRONTEND   │
                           │ Login / Dashboard │
                           │ Progress / Report │
                           └────────┬──────────┘
                                    │ HTTPS / REST
                                    ▼
                           ┌───────────────────┐
                           │  PYTHON BACKEND   │
                           │      FastAPI      │
                           │ Custom JWT Auth   │
                           │ Analysis Orchestr.│
                           └───┬───────┬───┬───┘
                               │       │   │
                  ┌────────────┘       │   └──────────────┐
                  ▼                    ▼                  ▼
         ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
         │    AWS CLI     │  │ FastAPI        │  │ Ollama API     │
         │ Cost Explorer  │  │ WebSocket      │  │ AI analysis    │
         │ + service APIs │  │ Live progress  │  │ + suggestions  │
         └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
                 │                   │                   │
                 ▼                   ▼                   │
         ┌────────────────┐  ┌────────────────┐          │
         │ Active AWS     │  │ React Progress │          │
         │ services and   │  │ Tracker        │          │
         │ metadata       │  └────────────────┘          │
         └────────────────┘                              │
                                                         ▼
                                               ┌────────────────┐
                                               │ FastAPI Backend│
                                               │ Combines result│
                                               └───────┬────────┘
                                                       │
                                                       ▼
                                               ┌────────────────┐
                                               │ PostgreSQL     │
                                               │ (Docker)       │
                                               │ users          │
                                               │ analyses       │
                                               └───────┬────────┘
                                                       │
                                                       ▼
                                               ┌────────────────┐
                                               │ React Report   │
                                               │ Findings       │
                                               │ Suggestions    │
                                               │ Recommended   │
                                               │ fixes          │
                                               └────────────────┘
```

## Components

### 1. React frontend
- Provides login and signup screens, the analysis dashboard, AWS region selection, progress tracking, and the final report.
- Sends REST requests to FastAPI and includes the JWT in the `Authorization: Bearer <token>` header for protected endpoints.
- Opens a WebSocket connection for live analysis progress.
- Displays saved analysis history and results returned by the backend.

### 2. FastAPI backend
- Exposes authentication, analysis, history, and WebSocket endpoints.
- Validates JWTs on protected HTTP endpoints and authenticates WebSocket connections according to the application's implementation.
- Coordinates the scan: cost discovery, active-service detection, metadata collection, AI analysis, and persistence.
- Validates inputs, handles AWS/AI/database errors, and returns structured API responses.
- Keeps AWS credentials and database connection details on the server; they must not be exposed to the browser.

### 3. Custom JWT authentication
- Signup creates a user record in PostgreSQL, storing a password hash rather than a plaintext password.
- Login verifies the password hash and issues a signed JWT.
- Protected requests validate the token's signature and relevant claims, such as expiration and subject.
- JWTs are credentials: do not store raw tokens as user passwords or log them. The database normally stores user records; token storage is only needed if the implementation supports revocation or sessions.

### 4. AWS CLI and AWS APIs
- Uses AWS Cost Explorer, for example `aws ce get-cost-and-usage`, to retrieve cost data for the configured time period and region/grouping.
- Filters and aggregates the returned cost data to identify services with non-zero or otherwise relevant unblended cost.
- Builds a dynamic list of active services (for example, `AmazonEC2` and `AmazonRDS`) and runs service-specific `describe` commands only for supported services in that list.
- Collects resource configuration and available tags for analysis. Cost Explorer service names and AWS CLI service/API names are not always identical, so use an explicit mapping rather than assuming names match.
- Requires valid AWS credentials and IAM permissions. Cost Explorer data can be delayed and does not necessarily prove that a resource is currently running; validate resource state through service APIs when needed.

### 5. FastAPI WebSocket
- Sends progress events while the backend performs the analysis, such as scan started, cost data retrieved, active services identified, metadata collection progress, AI analysis started, and analysis completed or failed.
- The React progress tracker consumes these events and updates the interface.
- WebSocket authentication must be handled explicitly; browser WebSocket APIs do not support arbitrary `Authorization` headers in the same way as `fetch`. Use a secure, deliberate mechanism (for example, a short-lived ticket or a carefully designed cookie-based approach) and validate ownership of the requested analysis.

### 6. Ollama API
- Receives a bounded, structured summary of costs and resource metadata from FastAPI.
- Generates explanations, potential optimization opportunities, and recommended fixes.
- Returns AI-generated suggestions to the backend, which should validate and label them as recommendations rather than execute changes automatically.
- Ollama is the correct spelling of the service name.

### 7. Dockerized PostgreSQL
- Persists application data, including user records and analysis history/results.
- The `users` table holds account information such as a unique email/username and password hash.
- The `analyses` table holds analysis ownership, selected region, status/timestamps, cost/resource summary, and final findings/recommendations as appropriate to the schema.
- Use environment variables or a secrets manager for the database connection string. Do not commit real credentials to source control.
- The backend, not the browser, connects directly to PostgreSQL.

## Main Data Paths

1. **Authentication:** React → FastAPI auth endpoints → PostgreSQL user lookup/create → JWT returned to React.
2. **Analysis:** React → authenticated FastAPI analysis endpoint → AWS CLI/ APIs → Ollama → PostgreSQL persistence → final response to React.
3. **Live progress:** React opens an authenticated WebSocket → FastAPI emits progress events during the analysis → React updates the progress tracker.
4. **History:** React → authenticated FastAPI history endpoint → PostgreSQL → analysis history/results returned to the owning user.

## Security and Reliability Considerations

- Enforce JWT authentication and per-user authorization on all protected HTTP routes.
- Authenticate WebSocket connections and ensure a user can only subscribe to progress for their own analysis.
- Apply least-privilege IAM permissions; use a role or a secure credential provider where possible.
- Never expose AWS credentials, JWT signing secrets, database credentials, or private configuration in frontend code or logs.
- Treat Ollama output as untrusted text: validate the response and never execute proposed fixes automatically.
- Apply timeouts and bounded output to subprocesses and AI requests; handle missing AWS CLI, expired credentials, denied permissions, model unavailability, and database failures.
- Record analysis status so a failed scan can be distinguished from a completed scan.
- Cost Explorer data is historical/billing-oriented and may be delayed. Resource state should be confirmed using relevant AWS service APIs before describing a resource as currently active.
