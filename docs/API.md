# Implemented publishing API

This API belongs to this package. These are not names of existing Photon or Grokbot endpoints.

All requests use the configured host origin. JSON writes require `Content-Type: application/json`, at most 16 KiB, and `Authorization: Bearer <PUBLISHER_TOKEN>`. The writer credential stays in trusted server-side code. Unknown fields are rejected.

## Operations

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Public process health; does not imply storage/device readiness |
| GET | `/api/doctor` | Authenticated storage/occupancy check |
| GET | `/api/slots` | Exactly ten slots with current assignment information |
| POST | `/api/cards` | Create once, atomically assign a free slot |
| GET | `/api/cards/:id` | Trusted publisher's complete record |
| PUT | `/api/cards/:id` | Replace display content using a matching revision |
| POST | `/api/cards/:id/presentation/begin` | Claim one original-message send/update |
| POST | `/api/cards/:id/presentation/settle` | Save/reconcile that exact provider outcome |
| POST | `/api/cards/:id/release` | Release a terminal, finally-presented assignment |
| POST | `/api/cards/:id/discard` | Release a never-presented draft without an uncertain send |
| GET | `/:slot/:id?k=:readKey&r=:revision` | Exact card page; read-only capability |
| GET | `/api/view/:slot/:id` | Display-only JSON, using the read key as a Bearer token |

`r` is a presentation/cache marker. The page always reads the latest available record for that same ID. The read key is independent of content revision, so older messages can reopen current state. Slot-only URLs such as `/live-3` are never public card identities.

## Create

`examples/research.json`, `checks.json` and `stages.json` are complete examples. Replace the illustrative task, request and conversation values with runtime-issued values. A create request is:

```json
{
  "requestId": "unique-create-request",
  "taskId": "unique-existing-task",
  "conversationRef": "actual-authorized-space-id",
  "content": {
    "template": "dots",
    "eyebrow": "TASK",
    "title": "Research market",
    "subtitle": "Sourcing · verifying · analysis",
    "status": "running",
    "header": "none",
    "stages": [
      { "id": "source", "label": "Source", "state": "done" },
      { "id": "verify", "label": "Verify", "state": "active" },
      { "id": "analyze", "label": "Analyze", "state": "pending" },
      { "id": "report", "label": "Report", "state": "pending" }
    ],
    "detail": { "title": "Verifying", "subtitle": "Company profiles" },
    "progress": { "completed": 27, "total": 50, "unit": "profiles verified" }
  }
}
```

Repeating the same `requestId` with the same normalized content returns the retained original record. Reusing it for different content returns `IDEMPOTENCY_CONFLICT`. Another create key for the same retained task/conversation returns `TASK_ALREADY_HAS_CARD`. Do not use creation to update an existing card.

Returned `viewUrl` is a scoped read capability. Internal IDs and URLs should remain in the task/runtime context rather than being printed alongside the user-facing card.

## Update

Use PUT with a complete `content` object, a unique request ID, and the current content revision:

```js
const record = await client.get(cardId);
const content = structuredClone(record.content);
content.progress.completed = 34; // Actual verified count, not simulated progress.

const updated = await client.update(cardId, {
  requestId: 'research-progress-002',
  expectedRevision: record.revision,
  content,
});
```

This changes persistent data, not website code. To also update the original bubble in the existing shared runtime, call:

```js
await liveCards.update(cardId, {
  requestId: 'research-progress-002',
  expectedRevision: record.revision,
  content,
}, originalAuthorizedSpace);
```

Do not call both for the same logical write with different request IDs. A matching retry is safe; a stale unrelated update gets `REVISION_CONFLICT`. Content writes are blocked while a presentation attempt is in flight or unresolved, preventing races between old and new presentations. This does not stop the underlying task; it can continue and report through text while the display issue is reconciled.

## Content validation

`template`: `dots`, `segments`, `stages`. `header`: `none`, `study`, `hands`. `status`: `queued`, `running`, `waiting`, `completed`, `failed`, `cancelled`. Stage state: `pending`, `active`, `done`, `blocked`.

There are 2–4 stages with unique IDs and labels up to 12 characters. `running` has exactly one active stage; other statuses have none. `queued` has only pending stages. `completed` has all done stages and no incomplete measurement. One blocked marker is allowed for waiting/failure/cancellation.

Title is at most 40 characters (recommend 26 or fewer). Subtitle is at most 65. Detail title is at most 24; detail subtitle at most 50. Strings are plain text, escaped during rendering. No HTML, URLs, colors, CSS, JavaScript, actions or callback fields are accepted.

`progress` is null or `{completed, total, unit}`. Integers satisfy `0 <= completed <= total <= 1,000,000`, with positive total and a named unit. There is no arbitrary `percentage` field.

## Provider presentation ledger

The supplied runtime helper handles these calls. They do not call Photon themselves.

Begin body: `{ "revision": 2 }`. A new claim returns its `attempt.id`, `kind` (`send` or `update`) and exact revision. A provider-accepted same revision may return `skipped: true`. Another in-flight/unknown claim blocks duplicate dispatch; it is not silently timed out or stolen.

Settlement body:

```json
{
  "attemptId": "actual-attempt-id",
  "outcome": "accepted",
  "messageRef": "actual-original-provider-message-id"
}
```

Outcomes are `accepted`, `not_applied`, or `unknown`. `not_applied` requires evidence that the provider operation did not happen; a timeout is not that evidence. `unknown` retains the attempt and slot. After checking the original provider/runtime result, settle the same attempt as accepted or not applied. Do not issue a new send to discover what happened.

For an edit, the original `messageRef` must remain unchanged; successful edits may return no replacement message. This server stores only an opaque message reference. Original provider session state belongs to the existing runtime.

## Release, discard and history

Release body: `{ "expectedRevision": 3 }`. The task must be terminal, no presentation may be pending, and the original message must have that final revision recorded as accepted. The helper does this automatically after a successful final update.

Discard body: `{}`. It only applies to a draft with no accepted message and no unresolved send. Discarding a draft does not cancel the real underlying task.

Historical records expire under the explicit configured retention policy. Idempotent retry lookup is bounded by retained history; do not replay month-old creation requests as new work. Old URLs are never reassigned, even after history pruning.

## Errors and evidence

HTTP errors have `{ "error": { "code", "message" } }`. Authentication failure is 401, missing/unavailable card 404, stale/occupied/conflicting state 409, invalid input 400, oversized body 413, storage/configuration trouble 503.

A returned card record proves stored state. A settled presentation records trusted runtime-reported provider acceptance. Neither constitutes physical-device evidence.
