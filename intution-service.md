# Intution Service (Consumer) – Technical Specification

This service consumes quiz-completion events from the Quiz Agent and posts a relationship to Intuition so a user’s smart account (EVM address) is associated with a Discord Server (guild) node indicating the user took a quiz in that community.

Reference implementation used for registry/search/sync: agent-registry-v2. See: https://github.com/collabland/agent-registry-v2

## 1. Scope
- Accept events via HTTP from the Quiz Agent (producer)
- Validate, authenticate, deduplicate (idempotency), enqueue for async processing
- Worker resolves/creates Intuition nodes and upserts a `took_quiz_in` edge with minimal metadata
- Provide health, readiness, metrics, and audit logs

Non-goals: UI, end-user features, tight coupling with producer lifecycle

## 2. Event Contract (Producer → Consumer)
- Endpoint: `POST /v1/intuition/events`
- Headers:
  - `Authorization: Bearer <token>` (required)
  - `Idempotency-Key: <sha256(userAddress|guildId|quizId)>` (required)
  - `X-Request-Id: <uuid>` (optional)
  - `Content-Type: application/json`
- Body (JSON):
  - `type`: `"quiz_completed"`
  - `userAddress`: checksum EVM address (required)
  - `guildId`: Discord snowflake string (required)
  - `metadata`: { `quizId`: string, `completedAt`: ISO-8601 } (both required)
  - `version`: string (optional)
- Responses:
  - `202 Accepted` `{ status: "queued", id: "<eventId>", idempotencyKey: "<key>" }`
  - Errors: `400/401/409/413/429/5xx` with `{ code, message, details? }`

## 3. Validation
- `type === "quiz_completed"`
- `userAddress` valid checksum
- `guildId` numeric string (≤ 20 chars)
- `metadata.quizId` non-empty (≤ 128 chars recommended)
- `metadata.completedAt` valid ISO-8601; within 7 days of server `now`
- Limits: `Content-Length ≤ 32 KB`; `metadata` restricted to `quizId`, `completedAt`

## 4. Authentication
- Phase 1: Static Bearer token (configurable allowlist); optional IP allowlist
- Optional later: HMAC signature (with `X-Timestamp`, `X-Signature`) or mTLS

## 5. Idempotency
- Require `Idempotency-Key = sha256(userAddress|guildId|quizId)`
- Duplicate key handling:
  - If payload matches previous: return prior outcome (or 202 ref)
  - If mismatch: `409 Conflict` (`IDEMPOTENCY_KEY_COLLISION`)

## 6. Processing Model
- Web/API process: auth → validate → persist `events(status=queued)` → enqueue → `202`
- Worker process: dequeue → `processing` → call Intuition → `succeeded`/`failed`
- Retries: exponential backoff + jitter (e.g., 1m, 5m, 15m, 1h; cap attempts)
- DLQ: remain `failed` with `lastError` for manual replay

## 7. Storage Schema (minimal)
- `events`: `id` uuid, `idempotencyKey` unique, `type`, `payload` jsonb, `status` enum(queued|processing|succeeded|failed), `attempts` int, `lastError` text/null, `createdAt`, `updatedAt`
- `results`: `eventId` uuid (FK), `userNodeId` string, `communityNodeId` string, `edgeId` string, `vendorResponse` jsonb, `completedAt` timestamp

## 8. Intuition Integration (via agent-registry-v2)
- Resolve or create user node from `userAddress`
- Resolve or create community node from `guildId`
- Upsert edge `took_quiz_in` (user → community) with metadata `{ quizId, completedAt }`
- Use `idempotencyKey` to avoid duplicate edges
- Implementation options:
  - Import a thin wrapper module over agent-registry-v2
  - Or shell out to `pnpm tsx src/sync.ts` with structured input

Reference: https://github.com/collabland/agent-registry-v2

## 9. Configuration
- Service: `PORT`, `NODE_ENV`, `LOG_LEVEL`, `BEARER_TOKENS` (csv), queue/DB settings, `MAX_BODY_BYTES`
- Intuition/Registry: `INTUITION_ENABLED`, `AGENT_REGISTRY_BASE_URL` (if required), `AGENT_REGISTRY_TIMEOUT_MS`

## 10. Observability
- Logs: `{ requestId, idempotencyKey, type, guildId, userAddress, status, httpStatus, latencyMs, error }`
- Metrics (Prometheus): request counters, queue depth, worker success/fail, vendor call results, latency
- Optional tracing: OpenTelemetry spans for API and vendor calls

## 11. Health/Readiness
- `GET /health` → `{ status: "ok" }`
- `GET /ready` → DB + queue checks

## 12. Error Model
- `{ code: "<MACHINE_CODE>", message: "human-readable", details?: object }`
- Common: `INVALID_AUTH`, `PAYLOAD_INVALID`, `IDEMPOTENCY_KEY_COLLISION`, `RATE_LIMITED`, `INTERNAL_ERROR`

## 13. OpenAPI (Outline)
```yaml
openapi: 3.0.3
info:
  title: Intution Service
  version: 1.0.0
paths:
  /v1/intuition/events:
    post:
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [type, userAddress, guildId, metadata]
              properties:
                type:
                  type: string
                  enum: [quiz_completed]
                userAddress:
                  type: string
                guildId:
                  type: string
                metadata:
                  type: object
                  required: [quizId, completedAt]
                  properties:
                    quizId: { type: string }
                    completedAt: { type: string, format: date-time }
      responses:
        '202': { description: Accepted }
        '400': { description: Bad Request }
        '401': { description: Unauthorized }
        '409': { description: Conflict }
        '429': { description: Too Many Requests }
        '500': { description: Server Error }
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
```

## 14. Testing
- Unit: validation, auth, idempotency
- Integration: API + queue + worker with mocked registry
- Duplicate key tests (match vs conflict)
- Retry & DLQ flow for transient vendor failures
- Load: 100–500 RPS, measure latency/throughput

## 15. Deployment & Rollout
- Containerized; separate `api` and `worker`; scale independently
- Secrets via env manager
- Staging dry-run/mock registry → allowlisted guilds → monitor → expand
