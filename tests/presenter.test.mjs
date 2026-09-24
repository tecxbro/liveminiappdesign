import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpectrumPresenter, createTaskCardRuntime, MemoryTargets } from '../src/spectrum-presenter.mjs';
import { httpFixture, payload, finished } from './helpers.mjs';

function sdkDouble({ fail = false } = {}) {
  const calls = []; const original = { id: 'provider-message-1' };
  const space = { id: 'replace-with-authorized-space-id', async send(op) {
    calls.push(op); if (fail) throw new Error('network failed after request might have been sent');
    return op.kind === 'edit' ? undefined : original;
  } };
  return { calls, original, space, app: (url, options) => ({ kind: 'app', url, options }), edit: (content, target) => ({ kind: 'edit', content, target }) };
}
test('existing-runtime start/update sends once and edits original object', async t => {
  const f = await httpFixture(t), sdk = sdkDouble(), targets = new MemoryTargets();
  const runtime = createTaskCardRuntime({ client: f.client, presenter: createSpectrumPresenter({ ...sdk, targets }) });
  const b = await payload(), start = await runtime.start(b, sdk.space);
  assert.equal(start.presentation, 'provider_accepted');
  b.content.progress.completed = 28;
  await runtime.update(start.record.id, { requestId: 'next', expectedRevision: 1, content: b.content }, sdk.space);
  assert.equal(sdk.calls.length, 2); assert.equal(sdk.calls[0].kind, 'app'); assert.equal(sdk.calls[1].kind, 'edit');
  assert.equal(sdk.calls[1].target, sdk.original); assert.equal(sdk.calls[0].options.live, true);
});
test('successful edit returning undefined is not interpreted as send failure', async t => {
  const f = await httpFixture(t), sdk = sdkDouble(), runtime = createTaskCardRuntime({ client: f.client, presenter: createSpectrumPresenter({ ...sdk, targets: new MemoryTargets() }) });
  const b = await payload(), start = await runtime.start(b, sdk.space);
  const updated = await runtime.update(start.record.id, { requestId: 'next', expectedRevision: 1, content: b.content }, sdk.space);
  assert.equal(updated.presentation, 'provider_accepted'); assert.equal(updated.record.delivery.messageRef, sdk.original.id);
});
test('repeat sync does not resend already presented revision', async t => {
  const f = await httpFixture(t), sdk = sdkDouble(), runtime = createTaskCardRuntime({ client: f.client, presenter: createSpectrumPresenter({ ...sdk, targets: new MemoryTargets() }) });
  const start = await runtime.start(await payload(), sdk.space);
  await runtime.sync(start.record.id, sdk.space); assert.equal(sdk.calls.length, 1);
});
test('confirmed terminal update releases slot and leaves original final page', async t => {
  const f = await httpFixture(t), sdk = sdkDouble(), runtime = createTaskCardRuntime({ client: f.client, presenter: createSpectrumPresenter({ ...sdk, targets: new MemoryTargets() }) });
  const b = await payload(), start = await runtime.start(b, sdk.space);
  const end = await runtime.update(start.record.id, { requestId: 'done', expectedRevision: 1, content: finished(b.content) }, sdk.space);
  assert.ok(end.record.archivedAt); assert.equal((await f.client.slots())[0].occupied, false);
  assert.match(await (await fetch(start.record.viewUrl)).text(), /Report delivered|Result delivered/);
});
test('missing original session after restart blocks updates without replacement send', async t => {
  const f = await httpFixture(t), sdk = sdkDouble(), b = await payload();
  let runtime = createTaskCardRuntime({ client: f.client, presenter: createSpectrumPresenter({ ...sdk, targets: new MemoryTargets() }) });
  const start = await runtime.start(b, sdk.space);
  runtime = createTaskCardRuntime({ client: f.client, presenter: createSpectrumPresenter({ ...sdk, targets: new MemoryTargets() }) });
  await assert.rejects(runtime.update(start.record.id, { requestId: 'next', expectedRevision: 1, content: b.content }, sdk.space), { code: 'REQUIRES_ORIGINAL_SESSION' });
  assert.equal(sdk.calls.length, 1); assert.equal((await f.client.get(start.record.id)).revision, 2);
});
test('wrong conversation rejects before a provider send or record creation', async t => {
  const f = await httpFixture(t), sdk = sdkDouble(), runtime = createTaskCardRuntime({ client: f.client, presenter: createSpectrumPresenter({ ...sdk, targets: new MemoryTargets() }) });
  const b = await payload(); b.conversationRef = 'wrong';
  await assert.rejects(runtime.start(b, sdk.space), { code: 'SPACE_MISMATCH' }); assert.equal(sdk.calls.length, 0);
});
test('provider failure becomes unknown and is not auto retried', async t => {
  const f = await httpFixture(t), sdk = sdkDouble({ fail: true }), runtime = createTaskCardRuntime({ client: f.client, presenter: createSpectrumPresenter({ ...sdk, targets: new MemoryTargets() }) });
  await assert.rejects(runtime.start(await payload(), sdk.space), { code: 'PRESENTATION_UNKNOWN' });
  const record = await f.client.get((await f.client.slots())[0].cardId);
  assert.equal(record.activeAttempt.state, 'unknown');
  await assert.rejects(runtime.sync(record.id, sdk.space), { code: 'PRESENTATION_PENDING' }); assert.equal(sdk.calls.length, 1);
});
test('lost acknowledgment returns reconciliation data, not another SDK send', async t => {
  const f = await httpFixture(t), sdk = sdkDouble();
  const normalSettle = f.client.settlePresentation.bind(f.client);
  f.client.settlePresentation = async () => { throw new Error('lost ack'); };
  const runtime = createTaskCardRuntime({ client: f.client, presenter: createSpectrumPresenter({ ...sdk, targets: new MemoryTargets() }) });
  const start = await runtime.start(await payload(), sdk.space);
  assert.equal(start.presentation, 'provider_accepted_ack_pending'); assert.ok(start.reconciliation.attemptId);
  await normalSettle(start.record.id, start.reconciliation);
  assert.equal(sdk.calls.length, 1);
});
test('terminal release clears optional uptime-only target mapping', async t => {
  const f = await httpFixture(t), sdk = sdkDouble(), targets = new MemoryTargets();
  const runtime = createTaskCardRuntime({ client: f.client, presenter: createSpectrumPresenter({ ...sdk, targets }) });
  const b = await payload(), start = await runtime.start(b, sdk.space);
  assert.ok(await targets.get(start.record.id));
  await runtime.update(start.record.id, { requestId: 'done', expectedRevision: 1, content: finished(b.content) }, sdk.space);
  assert.equal(await targets.get(start.record.id), null);
});
