---
name: live-task-cards
version: 1.0.0
description: Publish and update a read-only Photon task-progress card using supplied templates and the existing messaging runtime. Never regenerate its page for ordinary task updates.
---

# Live Task Cards: Grokbot operating skill

## When to use a card

Use one card for a substantial user-requested task with meaningful stages or a measurable batch: researching many companies, building a project, investigating a repository, processing files, or preparing a report. Require actual progress evidence and an available slot. Ordinary questions, greetings, quick answers, acknowledgements, and work already finished stay in text.

A card observes the existing task. Do not create another bot, orchestrator, transcript poller or background monitoring routine. Multiple workers contribute to the same task card through its existing owner. Do not send one card per worker.

V1 is read-only. No approval, purchase, cancellation, retry or other button. Opening the card does nothing to the task. Ask questions and receive approvals in the existing conversation. An order/booking status is eligible only for work already authorized through that workflow.

## What to invoke

Use the installed existing-runtime hook from `examples/existing-runtime.mjs`, registered through that runtime's already-validated invocation mechanism. Its returned object has:

```js
await liveCards.start(createRequest, originalAuthorizedSpace);
await liveCards.update(cardId, updateRequest, originalAuthorizedSpace);
await liveCards.sync(cardId, originalAuthorizedSpace);
```

These are real exports in this package, not pre-existing Grokbot commands. Installation wires them once. They use the existing Spectrum `app` and `edit` builders and do not start a second messaging connection.

For page publishing/inspection only, the included CLI is:

```sh
node --env-file=.env bin/live-card.mjs create examples/research.json
node --env-file=.env bin/live-card.mjs get <card-id>
node --env-file=.env bin/live-card.mjs update <card-id> update.json
node --env-file=.env bin/live-card.mjs slots
node --env-file=.env bin/live-card.mjs doctor
```

The CLI does not itself send or edit the iMessage bubble. Use the runtime hook for that part. Do not invent enqueue flags or assume page publication is message delivery.

## Selecting the template

Use `dots` for a known count of items, `segments` for measured checks/steps within a stage, and `stages` when duration/total work cannot honestly be measured. For no known count use `progress: null`, not a fabricated percentage.

Body colors are fixed navy/white/gray. The third selected screenshot's blue indicators are not allowed. Do not generate images or copy a mountain/logo into new cards. Choose an approved existing header asset or `none`; ordinary progress updates retain it.

## Create once

Use a stable unique task ID and create request ID for this specific job. Resolve `conversationRef` from the existing authorized runtime context, not an arbitrary model-provided recipient. Select 2–4 meaningful stages and the approved template/header. Creation claims an available slot from `live-1` to `live-10` atomically.

Retain the returned card ID, slot, revision and original provider message relationship. Store this in the existing task's durable context. The SDK message object/session remains with the shared runtime, never in model-facing JSON.

## Update data

Read the current record/revision before changing it. Submit the complete desired `content` with `expectedRevision` and a fresh update `requestId`. Reuse that request ID and exact payload only when reconciling a lost response to the same operation.

Update at meaningful milestones: a new stage, a useful count increase, a blocker, or an actual terminal result. Coalesce bursts. Do not advance progress based on elapsed time, a spinner, a worker going quiet, a page being opened or an unconfirmed tool call.

The runtime helper saves state and updates the original card. The hosted page also refreshes while visible. Do not send another bubble for each milestone, rewrite source files, commit code or redeploy just to change progress.

## Complete and free the slot

Set `completed` only after the task's promised outcome actually succeeds. Every displayed stage must be done and any named counter must be complete. `failed` means final failure, not a transient retry. `waiting` is not completion.

The runtime helper presents the final revision and then releases the slot. The old card keeps its own final read-only record. No automatic unsend. A different task gets a new card ID even when it reuses `live-3`.

If the task needs an additional ordinary reply or final artifact, use the existing conversation. This package does not send the final report itself.

## Errors

- `NO_SLOT_AVAILABLE`: continue the task in text. Do not create `live-11`, overwrite another card, or create another host to bypass the limit.
- `REVISION_CONFLICT`: read the current record and reconcile. Do not force a stale update over new progress.
- `PRESENTATION_PENDING`, `PRESENTATION_UNKNOWN`, or an in-flight attempt after restart: preserve occupancy. Inspect the existing runtime/provider result and settle that exact attempt; no blind resend.
- `REQUIRES_ORIGINAL_SESSION`: the page data may already be updated, but the original provider session is unavailable. Keep the host record and give an accurate text update. Restore only through a verified public SDK/runtime recovery path. Do not fabricate a session or silently send a replacement card.
- `provider_accepted_ack_pending`: the SDK returned acceptance but its publishing-state acknowledgment needs reconciliation. Use the returned reconciliation payload. Do not call the SDK again for that attempt.
- `STORE_UNAVAILABLE`: do not reset storage or treat it as ten empty slots.

Provider acceptance is not proof of device rendering. An HTML page loading is not proof of an in-message refresh. Report those separately.

## Boundaries

Do not broaden account permissions, disable reviews, switch providers, provision lines or create paid infrastructure under this skill. Keep the writer token and Redis credentials server-side. Read links are capabilities: anyone holding one can view its minimal card information; they do not identify the viewer or grant permission to act.
