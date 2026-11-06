# Request Flow

## AI Cloud Cost Detective

This document describes the end-to-end flow for authenticating a user, scanning AWS costs and resources, reporting live progress, running AI analysis through Ollama, and returning a persisted report.

## 1. Authentication: Signup / Login

1. The user opens the React frontend and submits the signup or login form.
2. React sends the credentials to the relevant FastAPI authentication endpoint over HTTPS.
3. For signup, the backend validates the input, hashes the password, and stores the user record in PostgreSQL.
4. For login, the backend retrieves the user record and verifies the submitted password against the stored hash.
5. If authentication succeeds, FastAPI issues a signed JWT with appropriate claims and an expiration time.
6. React uses the JWT in the `Authorization: Bearer <token>` header for protected HTTP API requests.
7. FastAPI validates the JWT and authorizes access to the requested resource on each protected request.

**Important:** PostgreSQL stores the user record and password hash. A JWT is typically issued to the client rather than stored as the user's password or saved as a database record by default. Token revocation/session tracking may require additional storage if implemented.

## 2. User Starts an Analysis

1. The user selects an AWS region and clicks **Run Analysis**.
2. React sends `POST /api/analyze` with the selected region and the JWT in the authorization header.
3. FastAPI validates the JWT, validates the request body, and checks that the user's AWS access is configured as expected.
4. The backend creates an analysis record (or otherwise assigns an analysis ID) and marks it as `queued` or `running`.
5. React establishes a WebSocket connection associated with that analysis to receive progress events. The backend must authenticate the connection and verify that the analysis belongs to the user.

Example request body:

```json
{
  "region": "us-east-1"
}
```

Example HTTP header:

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

The exact endpoint paths and request fields should match the implementation.

## 3. Retrieve Cost Data Using AWS Cost Explorer

1. FastAPI invokes the AWS CLI from the backend using a subprocess with a controlled argument list and timeout.
2. The backend runs a Cost Explorer query such as `aws ce get-cost-and-usage`, using the configured date range, granularity, metrics, and grouping/filter options.
3. The backend parses the JSON response and aggregates the relevant **UnblendedCost** values.
4. It filters out irrelevant or zero-cost service entries according to the application's defined rules.
5. The backend emits a WebSocket progress event indicating that cost retrieval has completed.

**Important distinctions:**
- Cost Explorer generally reports billing data over a selected period; it may be delayed and is not, by itself, proof that a resource is running right now.
- Cost Explorer's service labels do not always map directly to AWS CLI service command names. Maintain an explicit, tested mapping.
- The Cost Explorer API may require its own IAM permission and can return costs across a billing period rather than only the selected resource's current state.

## 4. Build the Active-Service Execution List

1. Python examines the cost results and identifies services that meet the configured activity/cost criteria.
2. It creates a dynamic execution list, for example:

```python
active_services = ["AmazonEC2", "AmazonRDS"]
```

3. The backend maps each Cost Explorer service label to a supported AWS CLI/API operation.
4. Only supported services in the execution list are passed to the metadata-collection stage. Unsupported services should be recorded as skipped rather than causing the whole scan to fail.
5. FastAPI emits a progress event listing the services being inspected, without exposing secrets or unnecessary account details.

The list represents services selected for inspection based on the configured criteria. It should not be described as a definitive list of currently running resources unless the backend also checks resource state.

## 5. Collect Metadata for Selected Services

1. For each supported service in the execution list, Python runs the appropriate AWS CLI `describe` or `list` operation.
2. The backend parses the response and collects relevant resource identifiers, configuration details, tags, and other metadata needed for cost analysis.
3. Calls are bounded with timeouts and handled individually so that one unsupported service or permission error can be reported without silently corrupting the entire result.
4. The backend tracks progress and sends WebSocket events as services or resource batches finish.
5. The collected data is normalized into a consistent structure for the analysis stage.

## 6. Send Progress Updates Through WebSocket

While the scan is running, FastAPI sends progress messages to React. A typical event sequence might be:

```json
{"stage": "started", "message": "Analysis started"}
{"stage": "cost_discovery", "message": "Retrieving cost data"}
{"stage": "service_discovery", "message": "Identifying services to inspect"}
{"stage": "metadata_collection", "service": "AmazonEC2", "message": "Collecting resource metadata"}
{"stage": "ai_analysis", "message": "Analyzing cost and configuration data"}
{"stage": "completed", "analysis_id": "<analysis-id>"}
```

These are illustrative payloads; field names and event formats should be aligned with the actual implementation.

React uses the messages to update the progress tracker. The WebSocket is for live status; the persisted analysis record and final API response are the durable source of the result. The backend should mark the analysis as failed and send a failure event if a fatal error occurs.

## 7. Run AI Analysis Through Ollama

1. FastAPI prepares a structured, bounded input containing the relevant cost totals, resource metadata, tags, and any supported contextual details.
2. The backend sends that input to the configured Ollama API/model.
3. Ollama generates an explanation of the findings, potential cost-saving opportunities, and suggested configuration changes.
4. FastAPI parses and validates the model output, handles timeouts or malformed responses, and distinguishes model-generated suggestions from verified AWS facts.
5. The backend does **not** automatically apply suggested changes. Any future remediation feature should require explicit authorization, validation, and user confirmation.

## 8. Persist the Analysis in PostgreSQL

1. FastAPI stores or updates the analysis record with the owner, selected region, status, timestamps, cost/resource summaries, and final recommendations according to the database schema.
2. The backend marks the analysis as completed only after the required stages and persistence succeed.
3. If a stage fails, the record should retain a meaningful failed status and an appropriate error summary without storing secrets.
4. The analysis record is then available to the authenticated history endpoint.

A possible high-level status lifecycle is:

`queued → running → completed`

or, when an unrecoverable error occurs:

`queued/running → failed`

## 9. Return the Final Report to React

1. FastAPI returns the final report or an analysis identifier that React can use to retrieve the result.
2. React renders the cost summary, inspected resources, AI-generated explanations, localized optimization suggestions, and recommended fixes.
3. The frontend clearly distinguishes measured cost/resource data from AI-generated recommendations.
4. The user can later open analysis history. React calls the protected history endpoint, FastAPI validates the JWT and ownership, queries PostgreSQL, and returns only records the user is authorized to view.

## End-to-End Summary

```text
User
  │
  ▼
React: Login / Signup
  │
  ▼
FastAPI Auth ───────────────► PostgreSQL (user record)
  │
  └─────────────────────────► JWT returned to React
                                  │
                                  ▼
React: Select AWS region → POST /api/analyze + JWT
                                  │
                                  ▼
                         FastAPI validates request
                                  │
                                  ▼
                         Create analysis record
                                  │
                 ┌────────────────┴─────────────────┐
                 ▼                                  ▼
       WebSocket progress                    AWS Cost Explorer
                 │                         aws ce get-cost-and-usage
                 ▼                                  │
       React progress tracker                      ▼
                                         Filter relevant costs
                                                   │
                                                   ▼
                                        Build active-service list
                                                   │
                                                   ▼
                                        AWS CLI describe/list calls
                                                   │
                                                   ▼
                                         Normalize resource data
                                                   │
                                                   ▼
                                             Ollama API
                                                   │
                                                   ▼
                                        Validate AI recommendations
                                                   │
                                                   ▼
                                         Persist result in PostgreSQL
                                                   │
                                                   ▼
                                        Final report returned to React
                                                   │
                                                   ▼
                                     Report + suggestions + analysis history
```

## Failure and Edge Cases

- **Invalid/expired JWT:** Return an authentication error and do not start or reveal an analysis.
- **Invalid region or request:** Return a validation error.
- **AWS CLI missing, credentials invalid, or IAM access denied:** Mark the analysis appropriately and provide a safe, actionable error.
- **No relevant cost entries:** Return a valid empty/no-findings report instead of assuming services are active.
- **Cost data and live resource state differ:** Explain that billing data and current resource state are different signals.
- **One service metadata call fails:** Capture the service-level failure and continue where safe.
- **WebSocket disconnects:** Allow the client to reconnect or fetch current analysis status through an authenticated HTTP endpoint.
- **Ollama unavailable or times out:** Record the AI-analysis failure; if supported, return collected factual cost/resource data without inventing AI recommendations.
- **PostgreSQL write fails:** Do not report the analysis as durably completed; surface the persistence failure and preserve enough safe diagnostics for troubleshooting.
- **User requests another user's analysis:** Enforce ownership checks for both HTTP history/report routes and WebSocket subscriptions.
