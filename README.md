# flyrank-be-09: Your First Background Job

FlyRank AI Internship — Backend AI Engineering, Week 5.

## What it does

Moves a slow operation (e.g. an AI API call) out of the HTTP request/response cycle into a background worker. The endpoint answers instantly with `202 Accepted` and a job ID; the worker processes the task asynchronously; a status endpoint lets callers poll for the result.

## Architecture

```
POST /jobs  →  202 Accepted + { id, statusUrl }
                     │
                     └─ fire-and-forget → processJob()
                                              ├─ attempt 1
                                              ├─ retry on failure (up to 3x)
                                              └─ job.status = done | failed

GET /jobs/:id  →  current job state
```

## Job lifecycle

| Status | Meaning |
|--------|---------|
| `queued` | Accepted, not yet started |
| `running` | Worker is processing |
| `retrying` | Previous attempt failed, retrying |
| `done` | Completed successfully |
| `failed` | All retries exhausted |

## Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | /health | Health check |
| POST | /jobs | Submit a new job (returns 202 + job ID) |
| GET | /jobs | List all jobs |
| GET | /jobs/:id | Get job status and result |

## Setup

```bash
npm install
node server.js
# Server starts on port 3000 (or $PORT)
```

## Usage examples

```bash
# Submit a job
curl -X POST http://localhost:3000/jobs \
  -H 'Content-Type: application/json' \
  -d '{"text": "Summarize this article for me"}'
# => { "id": "uuid", "status": "queued", "statusUrl": "/jobs/uuid" }

# Poll for result
curl http://localhost:3000/jobs/<uuid>
# => { "id": "uuid", "status": "done", "result": { "summary": "...", "processedAt": "..." }, ... }

# List all jobs
curl http://localhost:3000/jobs
```

## Key design decisions

- **Idempotency-safe**: Each job gets a UUID; re-fetching status is safe
- **Retries**: Worker retries up to 3 times with exponential back-off (2s, 4s)
- **Fire-and-forget**: `processJob()` is called without `await` so the HTTP response is instant
- **In-memory store**: Jobs are stored in a plain object (production would use Redis/DB)

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
