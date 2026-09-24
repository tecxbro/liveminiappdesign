// Import this factory into your EXISTING shared Spectrum process, not into the Vercel host.
// The caller supplies the already installed spectrum-ts builders; this package installs no SDK.
import { PublisherClient } from '../src/client.mjs';
import { createSpectrumPresenter, createTaskCardRuntime, MemoryTargets } from '../src/spectrum-presenter.mjs';

export function attachLiveTaskCards({ app, edit, originalTargets, baseUrl, publisherToken }) {
  const client = new PublisherClient({ baseUrl, token: publisherToken });
  const presenter = createSpectrumPresenter({ app, edit, targets: originalTargets });
  return createTaskCardRuntime({ client, presenter });
}

/*
Inside the existing runtime, once:

import { app, edit } from 'spectrum-ts';
import { attachLiveTaskCards } from './live-task-cards/examples/existing-runtime.mjs';
import { MemoryTargets } from './live-task-cards/src/spectrum-presenter.mjs';

const liveCards = attachLiveTaskCards({
  app, edit,
  originalTargets: new MemoryTargets(), // Uptime-only unless your existing host has verified session recovery.
  baseUrl: process.env.LIVE_CARDS_BASE_URL,
  publisherToken: process.env.LIVE_CARDS_PUBLISHER_TOKEN,
});

// Within your existing authorized queue/executor handler, with the original Space:
const started = await liveCards.start(createPayload, originalSpace);
const changed = await liveCards.update(started.record.id, updatePayload, originalSpace);

// Register these exported functions through your existing validated invocation mechanism.
// Do not invent enqueue flags, instantiate another Spectrum, or route to the first configured line.
*/
