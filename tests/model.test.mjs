import test from 'node:test';
import assert from 'node:assert/strict';
import { parseContent, parseCreate, parseUpdate, emptyState, checkState } from '../src/model.mjs';
import { loadConfig } from '../src/config.mjs';
import { payload } from './helpers.mjs';

for (const name of ['research', 'checks', 'stages']) test(`valid ${name} example`, async () => {
  assert.ok(parseCreate(await payload(name)));
});
test('reject HTML/action/style contract extensions', async () => {
  for (const property of ['actions', 'callback', 'html', 'theme', 'css', 'color']) {
    const c = (await payload()).content; c[property] = 'unexpected';
    assert.throws(() => parseContent(c), { code: 'UNKNOWN_FIELD' });
  }
});
test('unknown totals produce no invented fraction', async () => {
  const c = (await payload('checks')).content; c.progress = null;
  assert.equal(parseContent(c).progress, null);
});
test('reject invalid counters and percentages', async () => {
  for (const p of [ { completed: 51, total: 50, unit: 'checks' }, { completed: 1, total: 0, unit: 'checks' },
    { completed: 1.5, total: 50, unit: 'checks' }, { completed: -1, total: 50, unit: 'checks' },
    { completed: 1, total: 50, unit: '' }, { completed: 1, total: 50, unit: 'checks', percentage: 80 } ]) {
    const c = (await payload()).content; c.progress = p;
    assert.throws(() => parseContent(c));
  }
});
test('four named stages do not imply 25 percent increments', async () => {
  assert.equal(parseContent((await payload('stages')).content).progress, null);
});
test('reject two active stages', async () => {
  const c = (await payload()).content; c.stages[2].state = 'active';
  assert.throws(() => parseContent(c));
});
test('reject contradictory complete-but-unsent stage state', async () => {
  const c = (await payload()).content; c.status = 'completed';
  assert.throws(() => parseContent(c));
});
test('waiting uses a blocked marker rather than active working animation', async () => {
  const c = (await payload('stages')).content; c.status = 'waiting'; c.stages[2].state = 'blocked';
  assert.equal(parseContent(c).status, 'waiting');
});
test('stage IDs unique; label length bounded', async () => {
  const c = (await payload()).content; c.stages[1].id = c.stages[0].id;
  assert.throws(() => parseContent(c)); c.stages[1].id = 'other'; c.stages[1].label = 'x'.repeat(13);
  assert.throws(() => parseContent(c));
});
test('allow two to four stages with arbitrary valid labels', async () => {
  const c = (await payload()).content; c.stages = c.stages.slice(0, 2);
  assert.equal(parseContent(c).stages.length, 2);
});
test('title length and control characters bounded', async () => {
  for (const value of ['', 'x'.repeat(41), 'two\nlines']) {
    const c = (await payload()).content; c.title = value; assert.throws(() => parseContent(c));
  }
});
test('header assets are allowlisted, never arbitrary remote URLs', async () => {
  const c = (await payload()).content; c.header = 'https://example.com/tracking.png';
  assert.throws(() => parseContent(c));
});
test('create retains opaque original conversation ID', async () => {
  const b = await payload(); b.conversationRef = 'any;-;+15555550123';
  assert.equal(parseCreate(b).conversationRef, b.conversationRef);
});
test('update requires exact integer revision', async () => {
  const content = (await payload()).content;
  assert.throws(() => parseUpdate({ content, requestId: 'next', expectedRevision: 0 }));
});
test('empty slot registry has exactly ten names', () => {
  const state = emptyState(); assert.equal(Object.keys(state.slots).length, 10); assert.equal(checkState(state), state);
});
test('corrupt state does not reset silently', () => {
  const state = emptyState(); state.slots['live-1'] = 'missing'; assert.throws(() => checkState(state), { code: 'STORE_CORRUPT' });
});
test('production configuration refuses file persistence', () => {
  assert.throws(() => loadConfig({ VERCEL: '1', PUBLIC_BASE_URL: 'https://cards.example.com',
    PUBLISHER_TOKEN: 'a'.repeat(40), VIEW_SIGNING_SECRET: 'b'.repeat(40), STORE: 'file' }), { code: 'CONFIG_ERROR' });
});
test('configuration requires distinct strong secrets', () => {
  assert.throws(() => loadConfig({ PUBLISHER_TOKEN: 'a'.repeat(40), VIEW_SIGNING_SECRET: 'a'.repeat(40) }));
  assert.throws(() => loadConfig({ PUBLISHER_TOKEN: 'short', VIEW_SIGNING_SECRET: 'b'.repeat(40) }));
});
test('no HTTP public production origin', () => {
  assert.throws(() => loadConfig({ PUBLIC_BASE_URL: 'http://example.com', PUBLISHER_TOKEN: 'a'.repeat(40), VIEW_SIGNING_SECRET: 'b'.repeat(40) }));
});
