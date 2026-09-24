# Existing-runtime integration

## The boundary

The Vercel host is only a renderer and task-state service. The actual task and its existing Spectrum connection stay on Grokbot's computer. No Grok API, replacement orchestrator or new messaging listener is introduced.

The bridge is implemented in `src/spectrum-presenter.mjs`, not left as a task for Grokbot to invent. What remains deployment-specific is **where to register that bridge in the actual running sender** and how that sender recovers original card sessions. No copy of the current VM runtime was provided with this code request, so this package does not claim a pre-wired modification to it.

## One-time attachment

Inside the existing shared runtime:

```js
import { app, edit } from 'spectrum-ts';
import { attachLiveTaskCards } from './live-task-cards/examples/existing-runtime.mjs';
import { MemoryTargets } from './live-task-cards/src/spectrum-presenter.mjs';

const liveCards = attachLiveTaskCards({
  app,
  edit,
  originalTargets: new MemoryTargets(),
  baseUrl: process.env.LIVE_CARDS_BASE_URL,
  publisherToken: process.env.LIVE_CARDS_PUBLISHER_TOKEN,
});
```

Run this once per existing runtime lifetime, not inside each message handler or worker. `MemoryTargets` retains exact original message and Space objects during that lifetime. It is an explicit uptime-only implementation, not a claim of restart recovery.

Register `liveCards.start`, `liveCards.update`, and `liveCards.sync` through the existing trusted executor/queue mechanism. Resolve task and conversation authority through that runtime before calling them. Reuse the original authorized `Space` object to preserve provider and sending-line context. Do not select the first account/line from configuration or accept a model's arbitrary recipient as authority.

## Create/send

```js
const result = await liveCards.start(createRequest, originalAuthorizedSpace);
// Persist result.record.id and result.record.revision in the existing task context.
```

The helper saves the card, validates the presentation context, claims the send, calls the injected `app(url, {live:true})` through `space.send`, retains the returned message, and acknowledges the result to the host. The website and publisher token do not receive Photon credentials.

## Data/update

```js
const record = await client.get(cardId);
const next = structuredClone(record.content);
next.detail.title = 'Verifying';
next.progress.completed = actualVerifiedCount;

await liveCards.update(cardId, {
  requestId: uniqueProgressEventId,
  expectedRevision: record.revision,
  content: next,
}, originalAuthorizedSpace);
```

The helper uses the original message with `edit(app(url, {live:true}), originalMessage)`. It does not send a new bubble. A void edit return is valid; the original provider-managed message/session remains the target.

The website's visible-page polling complements the provider update. It does not guarantee refresh in a suspended/offscreen Messages surface. Test initial load, an already-visible card, and reopening it on the intended device.

## Do not mix unregistered send paths

Using the CLI to save page data is fine. Manually sending its URL through another sender without registering that original message/attempt with this helper is not equivalent to `liveCards.start`. A later `sync` could otherwise believe the card has never been sent. Use one managed send/update path per card and reconcile existing sends before adopting them.

## Restart

The durable host remembers slots, card content, original opaque message references and presentation claims. It does not serialize the entire SDK object graph.

To support edits after restart, supply an `originalTargets` implementation with:

```ts
get(cardId): Promise<{message: OriginalSupportedMessage, space: OriginalAuthorizedSpace} | null>
set(cardId, {message, space}): Promise<void>
```

Its message must come from a verified public SDK/runtime recovery path and contain the original provider-managed session. Do not construct `miniAppCardSession` from guessed fields, deserialize a method-less JSON object and call it recovered, or create a new card silently. The adapter also expects the same authorized Space object stored with that target; the runtime must resolve/reuse it consistently.

If recovery is unavailable, keep the existing process alive for active cards, use page updates/text as an honest fallback after a restart, and report `REQUIRES_ORIGINAL_SESSION`. The source docs describe retaining the original returned message, but this package has not established the user's installed SDK's restart mechanism.

## Unknown outcomes

If the SDK or target persistence fails after dispatch begins, the attempt remains unknown. If a successful provider response cannot be acknowledged to the host, the helper returns `provider_accepted_ack_pending` with the exact reconciliation payload. A subsequent blind send is prohibited.

Recover using the actual existing executor/provider result. Settle the known attempt through `client.settlePresentation`. Never free a slot just because a process restarted, a task is quiet, or a network timeout elapsed.

## Installed SDK verification

Use the existing project's resolved SDK, rather than upgrading it implicitly to match today's website. Check real public builder signatures and return behavior. The local tests here use provider doubles; they are not a pinned-SDK compatibility test or a device test. The official app-card docs explain the initial app send, edit target and extension prerequisite; see `docs/SOURCES.md`.
