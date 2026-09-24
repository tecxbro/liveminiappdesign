import { renderCard } from '/card-template.mjs';
const initial = document.getElementById('card-data');
let view = initial ? JSON.parse(initial.textContent) : null;
let timer, inFlight = false, stopped = false, failures = 0;
const root = document.getElementById('card-root');
const params = new URLSearchParams(location.search);
const key = params.get('k');
const intervalMs = 10_000;
const terminal = new Set(['completed', 'failed', 'cancelled']);

function freshness() {
  if (!view) return;
  const time = root.querySelector('time');
  if (!time) return;
  const date = new Date(view.updatedAt);
  time.textContent = `Updated ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  time.title = date.toLocaleString();
}
function note(message) {
  const el = root.querySelector('.refresh-note');
  if (el) el.textContent = message;
}
function schedule(ms = intervalMs) {
  clearTimeout(timer);
  if (!stopped && key && !document.hidden && view && !terminal.has(view.content.status)) {
    timer = setTimeout(refresh, ms);
  }
}
async function refresh() {
  if (inFlight || stopped || document.hidden || !view || !key) return;
  inFlight = true;
  try {
    const response = await fetch(`/api/view/${encodeURIComponent(view.slot)}/${encodeURIComponent(view.id)}`, {
      headers: { Authorization: `Bearer ${key}` }, cache: 'no-store', credentials: 'omit',
      signal: AbortSignal.timeout(8000), redirect: 'error',
    });
    if (response.status === 404 || response.status === 410) {
      stopped = true;
      root.innerHTML = '<div class="unavailable">This card is no longer available.</div>';
      return;
    }
    if (!response.ok) throw new Error('refresh unavailable');
    const next = await response.json();
    if (next.id !== view.id || next.slot !== view.slot) throw new Error('identity mismatch');
    if (Number.isSafeInteger(next.revision) && next.revision > view.revision) {
      view = next; root.innerHTML = renderCard(view); freshness();
    }
    failures = 0; note('');
  } catch { failures++; note('Updates delayed'); }
  finally { inFlight = false; schedule(Math.min(60_000, intervalMs * 2 ** Math.min(failures, 3))); }
}
freshness(); schedule();
document.addEventListener('visibilitychange', () => {
  clearTimeout(timer);
  if (!document.hidden && !stopped) { freshness(); refresh(); }
});
window.addEventListener('pageshow', () => { if (!stopped) refresh(); });
// Polling reads task state only. It never wakes Grokbot or executes any user action.
