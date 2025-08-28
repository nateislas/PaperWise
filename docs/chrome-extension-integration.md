## PaperWise Chrome Extension Integration and Async Backend Design

### Objective
Enable a Chrome extension to send arXiv PDFs to PaperWise for analysis, receive progress updates, and notify the user when results are ready. Implement a robust, low‑bottleneck async job model in the backend.

---

### Scope
- Chrome Extension UX and API contract
- Backend async job APIs, SSE streaming, and result retrieval
- Server‑side URL fetching and validation
- Queue/worker architecture, reliability, and observability

---

### Terminology
- Job: A single analysis request, identified by `job_id` (UUID)
- States: `queued`, `processing`, `done`, `error`
- Sources: `file_id` (pre‑uploaded) or `pdf_url` (server fetch)

---

### API Design

1) Submit async analysis

POST `/api/v1/analyze/async`

Request (one of):
```json
{ "file_id": "<uuid>", "analysis_type": "comprehensive", "query": "optional" }
```
```json
{ "pdf_url": "https://arxiv.org/pdf/XXXX.YYYYY.pdf", "analysis_type": "comprehensive", "query": "optional" }
```

Response:
```json
{ "job_id": "<uuid>", "status": "queued" }
```

Validation:
- Exactly one of `file_id` or `pdf_url` must be present
- `pdf_url` domain allow‑list (e.g., arXiv) and content‑type checks

2) Job status

GET `/api/v1/jobs/{job_id}`

Response:
```json
{
  "job_id": "<uuid>",
  "state": "queued|processing|done|error",
  "progress": 0,
  "stage": "queued|fetching_pdf|parsing|analyzing|finalizing",
  "error_code": null,
  "error_message": null,
  "result_url": null
}
```

3) Job progress (SSE)

GET `/api/v1/jobs/{job_id}/stream` (media type `text/event-stream`)

Event payloads (examples):
```json
{ "type": "state", "state": "processing", "stage": "parsing", "progress": 35 }
```
```json
{ "type": "log", "message": "Extracted 12 sections" }
```
```json
{ "type": "done", "result_url": "/api/v1/jobs/<id>/result" }
```

4) Result retrieval

GET `/api/v1/jobs/{job_id}/result`

Response (JSON): final structured analysis or a stable link to the stored result.

5) Optional webhook

Client can provide `callback_url` at submit time; backend POSTs completion/error.

---

### Queue and Workers
- Redis‑backed queue (Celery or RQ); one or more worker processes
- FastAPI handles HTTP only; workers perform PDF fetch/parse and LLM analysis
- Retries with exponential backoff on transient failures
- Back‑pressure: queue length thresholds; return 429 when saturated

---

### Server‑Side URL Fetching
- Enforce size caps, timeouts, and `Content-Type: application/pdf`
- Store fetched PDFs under `uploads/` with a `job_id`‑based filename
- Associate stored file with job metadata

---

### Data Model (conceptual)
Job (Redis hash or DB row):
- `job_id`, `state`, `progress`, `stage`, `created_at`, `updated_at`
- `source_type` (`file_id`|`pdf_url`), `source_value`
- `result_path|url`, `error_code`, `error_message`

SSE Channel: `jobs:{job_id}` via Redis pub/sub

---

### Security & Compliance
- Auth: Bearer tokens (extension stores token), CORS allow‑list for extension origin
- Domain allow‑list for `pdf_url`, strict input validation
- Logging: structured logs with `job_id` correlation, minimal PII

---

### Chrome Extension Contract
- Submit: call `/api/v1/analyze/async` with `pdf_url` (preferred) or `file_id`
- Progress: subscribe to `/api/v1/jobs/{job_id}/stream`
- Completion: show notification; on click open results UI for `job_id`
- Fallback: poll `/api/v1/jobs/{job_id}` if SSE unavailable

---

### Chrome Extension UI/UX

User flows:
- From arXiv page with PDF open or linked:
  1. Click browser action (toolbar) or context menu "Analyze with PaperWise"
  2. Extension extracts active PDF URL (or selected link URL)
  3. Extension submits to `/api/v1/analyze/async` with `pdf_url`
  4. Background subscribes to `/api/v1/jobs/{job_id}/stream`
  5. Shows badge/progress; final system notification on completion
  6. Clicking notification opens PaperWise results page for `job_id`

Surfaces:
- Browser action: shows small popup with current job status, last results, and a retry button
- Context menu: "Analyze with PaperWise" on `https://arxiv.org/*` pages/links
- Options page: configure API base URL, token, and preferences (auto-open results)

Permissions (Manifest V3):
- `permissions`: `contextMenus`, `notifications`, `storage`
- `host_permissions`: PaperWise API domain, `https://arxiv.org/*`
- `action`: default title/icon; optional badge for progress

Auth:
- Options page stores API token in `chrome.storage.sync`
- Requests include `Authorization: Bearer <token>`

Progress & notifications:
- Background worker aggregates SSE events; updates action badge (e.g., `25%`, spinner)
- On `done` or `error`, create a Chrome notification; click opens results or error details

Error handling:
- Detect non‑PDF URLs, blocked domains, or oversized files; show user‑friendly errors
- Network retries with backoff; fall back to polling when SSE is unavailable
- Timeouts with clear recovery actions

Security & privacy:
- Only send `pdf_url` to backend; no local file content unless user explicitly uploads
- Limit context menu to arXiv (and future allow‑listed domains)

Extension checklist:
- [ ] Manifest V3 with background service worker and action UI
- [ ] Context menu for arXiv pages/links
- [ ] Options page for API base URL and token
- [ ] Background logic: submit async, handle SSE/polling, notifications
- [ ] Popup UI: show current/last job status and quick actions
- [ ] Error states: network, auth, invalid URL, backend errors
- [ ] Permission review and store policy compliance

---

### Acceptance Criteria
- Async submit returns `job_id` immediately
- Status endpoint reflects accurate state/progress
- SSE delivers timely updates end‑to‑end
- Results endpoint returns final analysis or stable link
- Robust under load with retries and back‑pressure

---

### Phased Plan
1) Minimal viable async path
   - Add endpoints: submit async, job status, job result
   - Implement Redis queue + worker, no SSE initially (polling ok)
2) Add SSE progress via Redis pub/sub
3) Add server‑side URL fetch with validation and caps
4) Add webhook callback, rate limits, and cleanup/TTL jobs

---

### Implementation Checklist
- [ ] Choose queue framework (Celery or RQ) and configure Redis
- [ ] Define job schema and storage (Redis hash or DB)
- [ ] Implement `POST /api/v1/analyze/async`
- [ ] Implement worker task: fetch (optional), parse, analyze, persist result
- [ ] Implement `GET /api/v1/jobs/{job_id}`
- [ ] Implement `GET /api/v1/jobs/{job_id}/result`
- [ ] Wire Chrome extension contract in README (usage examples)
- [ ] Add SSE: `GET /api/v1/jobs/{job_id}/stream` and worker pub/sub
- [ ] Add server‑side URL fetch validation and limits
- [ ] Add webhook callback support (optional)
- [ ] Add cleanup/TTL for jobs and stored files/results
- [ ] Observability: structured logs, metrics, error codes

---

### Notes
- Keep existing `POST /api/v1/analyze/stream` for current frontend compatibility
- Extension should prefer async job flow for scalability and resilience


