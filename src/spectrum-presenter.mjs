import { CardError, assert } from './errors.mjs';

/** Explicit uptime-only target store. After restart, updates fail closed rather than create new bubbles. */
export class MemoryTargets {
  constructor() { this.map = new Map(); }
  async get(id) { return this.map.get(id) ?? null; }
  async set(id, target) { this.map.set(id, target); }
  async forget(id) { this.map.delete(id); }
}

/**
 * Inject app/edit from the EXISTING installed spectrum-ts and an existing authorized Space.
 * Never constructs Spectrum, a provider, a bot, a listener or another messaging queue.
 * targets.get/set must retain the original message object or return a publicly supported rehydrated one.
 */
export function createSpectrumPresenter({ app, edit, targets }) {
  assert(typeof app === 'function' && typeof edit === 'function' && targets?.get && targets?.set,
    'CONFIG_ERROR', 'Supply installed app/edit builders and an explicit target store.');
  return {
    async forget(id) { if (typeof targets.forget === 'function') await targets.forget(id); },
    async prepare(record, space) {
      assert(space && typeof space.send === 'function' && space.id === record.conversationRef,
        'SPACE_MISMATCH', 'Use the original authorized Space, including its sending line.', 403);
      assert(!record.activeAttempt, 'PRESENTATION_PENDING', 'An existing presentation needs reconciliation.', 409);
      let original = null;
      if (record.delivery.messageRef) {
        const t = await targets.get(record.id);
        assert(t?.message && t.space === space && t.message.id === record.delivery.messageRef,
          'REQUIRES_ORIGINAL_SESSION', 'Original provider-managed card session is unavailable. Do not send a replacement card.', 409);
        original = t.message;
      }
      const content = app(record.viewUrl, { live: true });
      const operation = original ? edit(content, original) : content;
      return {
        async perform() {
          const sent = await space.send(operation);
          const message = original || sent;
          assert(message && typeof message.id === 'string' && message.id.length > 0,
            'PROVIDER_RESULT_UNKNOWN', 'No usable original message reference returned; reconcile the send.', 502);
          // edit() may resolve undefined. The provider refreshes the original object's session.
          await targets.set(record.id, { space, message });
          return { messageRef: message.id };
        },
      };
    },
  };
}

export function createTaskCardRuntime({ client, presenter }) {
  async function archive(record) {
    const archived = await client.release(record.id, record.revision);
    // Optional cleanup releases our uptime-only mapping, not the provider's chat history.
    if (typeof presenter.forget === 'function') await presenter.forget(record.id);
    return archived;
  }
  async function sync(id, space) {
    let record = await client.get(id);
    if (record.archivedAt) return { record, presentation: 'already_archived' };
    if (record.delivery.presentedRevision === record.revision && !record.activeAttempt) {
      if (['completed', 'failed', 'cancelled'].includes(record.content.status)) record = await archive(record);
      return { record, presentation: 'already_presented' };
    }
    const plan = await presenter.prepare(record, space); // Validate before taking a presentation claim.
    const claim = await client.beginPresentation(record.id, record.revision);
    if (claim.skipped) return { record: claim.record, presentation: 'already_presented' };
    let result;
    try { result = await plan.perform(); }
    catch {
      // Any failure after invoking the SDK is conservatively ambiguous, not permission to repeat it.
      try { await client.settlePresentation(record.id, { attemptId: claim.attempt.id, outcome: 'unknown', note: 'SDK or target persistence failed after presentation started.' }); }
      catch { /* The durable in-flight claim still prevents duplicate dispatch. */ }
      throw new CardError('PRESENTATION_UNKNOWN', `Reconcile presentation attempt ${claim.attempt.id}. No automatic resend was attempted.`, 502);
    }
    try {
      record = await client.settlePresentation(record.id, { attemptId: claim.attempt.id, outcome: 'accepted', messageRef: result.messageRef });
    } catch {
      return { record, presentation: 'provider_accepted_ack_pending',
        reconciliation: { attemptId: claim.attempt.id, outcome: 'accepted', messageRef: result.messageRef } };
    }
    if (['completed', 'failed', 'cancelled'].includes(record.content.status)) record = await archive(record);
    return { record, presentation: 'provider_accepted' }; // Not a claim of physical-device rendering.
  }
  return {
    async start(input, space) {
      assert(input.conversationRef === space?.id, 'SPACE_MISMATCH', 'Task and authorized Space do not match.', 403);
      const record = await client.create(input);
      return sync(record.id, space);
    },
    async update(id, input, space) {
      const existing = await client.get(id);
      assert(existing.conversationRef === space?.id, 'SPACE_MISMATCH', 'Update must use its original authorized Space.', 403);
      const record = await client.update(id, input);
      return sync(record.id, space);
    },
    sync,
  };
}
