import { assert } from './errors.mjs';

export const TEMPLATES = ['dots', 'segments', 'stages'];
export const STATUSES = ['queued', 'running', 'waiting', 'completed', 'failed', 'cancelled'];
export const STAGE_STATES = ['pending', 'active', 'done', 'blocked'];
export const HEADERS = ['none', 'study', 'hands'];
export const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
export const SLOT_NAMES = Array.from({ length: 10 }, (_, i) => `live-${i + 1}`);
export const STATUS_LABEL = {
  queued: 'Queued', running: 'In progress', waiting: 'Waiting',
  completed: 'Complete', failed: 'Failed', cancelled: 'Cancelled',
};

export function object(value, name, keys) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value),
    'INVALID_INPUT', `${name} must be an object.`);
  assert(Object.keys(value).every(k => keys.includes(k)),
    'UNKNOWN_FIELD', `${name} contains an unsupported field.`);
  return value;
}
export function text(value, name, max, optional = false) {
  if (optional && value === undefined) return '';
  assert(typeof value === 'string', 'INVALID_INPUT', `${name} must be text.`);
  const result = value.trim();
  assert((optional || result.length > 0) && [...result].length <= max && !/[\x00-\x1f\x7f]/.test(result),
    'INVALID_INPUT', `${name} must be ${optional ? '0' : '1'}–${max} characters on one line.`);
  return result;
}
export function identifier(value, name = 'id', max = 128) {
  const result = text(value, name, max);
  assert(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(result), 'INVALID_INPUT', `${name} has invalid characters.`);
  return result;
}
export function integer(value, name, min, max) {
  assert(Number.isSafeInteger(value) && value >= min && value <= max,
    'INVALID_INPUT', `${name} must be an integer from ${min} to ${max}.`);
  return value;
}
function choice(value, name, choices) {
  assert(choices.includes(value), 'INVALID_INPUT', `${name} must be one of: ${choices.join(', ')}.`);
  return value;
}

/** Validate and normalize public display data. No HTML, styles, actions or external URLs. */
export function parseContent(input) {
  const c = object(input, 'content', [
    'template', 'eyebrow', 'title', 'subtitle', 'status', 'stages', 'detail', 'progress', 'header',
  ]);
  const stages = c.stages;
  assert(Array.isArray(stages) && stages.length >= 2 && stages.length <= 4,
    'INVALID_INPUT', 'Use 2–4 meaningful stages. Labels are data, not hardcoded workflows.');
  const parsedStages = stages.map((s, i) => {
    object(s, `stages[${i}]`, ['id', 'label', 'state']);
    return { id: identifier(s.id, 'stage.id', 32), label: text(s.label, 'stage.label', 12),
      state: choice(s.state, 'stage.state', STAGE_STATES) };
  });
  assert(new Set(parsedStages.map(s => s.id)).size === parsedStages.length,
    'INVALID_INPUT', 'Stage IDs must be unique.');
  const active = parsedStages.filter(s => s.state === 'active').length;
  const blocked = parsedStages.filter(s => s.state === 'blocked').length;
  assert(active <= 1 && blocked <= 1, 'INVALID_INPUT', 'Show at most one current or blocked stage.');
  const status = choice(c.status, 'status', STATUSES);
  if (status === 'running') assert(active === 1 && blocked === 0, 'INVALID_INPUT', 'Running requires one active stage.');
  if (status !== 'running') assert(active === 0, 'INVALID_INPUT', 'Only running work can have an active stage.');
  if (status === 'queued') assert(parsedStages.every(s => s.state === 'pending'), 'INVALID_INPUT', 'Queued stages must be pending.');
  if (status === 'completed') assert(parsedStages.every(s => s.state === 'done'), 'INVALID_INPUT', 'Complete only after every displayed stage is done.');
  if (blocked) assert(['waiting', 'failed', 'cancelled'].includes(status), 'INVALID_INPUT', 'Blocked stage requires a non-running state.');
  object(c.detail, 'detail', ['title', 'subtitle']);
  let progress = null;
  if (c.progress !== null && c.progress !== undefined) {
    object(c.progress, 'progress', ['completed', 'total', 'unit']);
    const total = integer(c.progress.total, 'progress.total', 1, 1_000_000);
    progress = { completed: integer(c.progress.completed, 'progress.completed', 0, total), total,
      unit: text(c.progress.unit, 'progress.unit', 32) };
    if (status === 'completed') assert(progress.completed === total, 'INVALID_INPUT', 'Completed cards cannot have unfinished measured work.');
  }
  return {
    template: choice(c.template, 'template', TEMPLATES),
    eyebrow: text(c.eyebrow ?? 'TASK', 'eyebrow', 20),
    title: text(c.title, 'title', 40),
    subtitle: text(c.subtitle, 'subtitle', 65, true), status, stages: parsedStages,
    detail: { title: text(c.detail.title, 'detail.title', 24),
      subtitle: text(c.detail.subtitle, 'detail.subtitle', 50, true) },
    progress, header: choice(c.header ?? 'none', 'header', HEADERS),
  };
}
export function parseCreate(input) {
  const b = object(input, 'create', ['requestId', 'taskId', 'conversationRef', 'content']);
  return {
    requestId: identifier(b.requestId, 'requestId'), taskId: identifier(b.taskId, 'taskId'),
    // Conversation reference is opaque; semicolons and E.164-like IDs are allowed.
    conversationRef: text(b.conversationRef, 'conversationRef', 256), content: parseContent(b.content),
  };
}
export function parseUpdate(input) {
  const b = object(input, 'update', ['requestId', 'expectedRevision', 'content']);
  return { requestId: identifier(b.requestId, 'requestId'),
    expectedRevision: integer(b.expectedRevision, 'expectedRevision', 1, Number.MAX_SAFE_INTEGER),
    content: parseContent(b.content) };
}
export function emptyState() {
  return { schema: 1, version: 0, slots: Object.fromEntries(SLOT_NAMES.map(s => [s, null])), cards: {} };
}
export function checkState(s) {
  assert(s && s.schema === 1 && Number.isSafeInteger(s.version) && s.slots && s.cards,
    'STORE_CORRUPT', 'Stored schema is invalid; do not reset it automatically.', 503);
  const occupied = Object.values(s.slots).filter(Boolean);
  assert(SLOT_NAMES.every(k => Object.hasOwn(s.slots, k)) && Object.keys(s.slots).length === 10 &&
    new Set(occupied).size === occupied.length, 'STORE_CORRUPT', 'Slot registry is invalid.', 503);
  for (const [slot, id] of Object.entries(s.slots)) {
    if (id) assert(s.cards[id]?.slot === slot && !s.cards[id].archivedAt,
      'STORE_CORRUPT', 'Slot refers to a missing or archived card.', 503);
  }
  for (const r of Object.values(s.cards)) {
    assert(r && s.cards[r.id] === r && SLOT_NAMES.includes(r.slot), 'STORE_CORRUPT', 'Invalid card record.', 503);
    if (!r.archivedAt) assert(s.slots[r.slot] === r.id, 'STORE_CORRUPT', 'Active card is missing its slot.', 503);
  }
  return s;
}
