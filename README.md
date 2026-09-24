# Live Task Cards

Three reusable, read-only task-progress layouts for Grokbot + Photon iMessage.

**Grokbot changes JSON data. It does not rewrite a website, generate an image, or redeploy a page for each update.**

## Start here

```sh
npm test
npm run check
npm run preview
```

Open `http://127.0.0.1:3000` locally. The gallery shows each layout at 300 × 300 and 300 × 240. All example progress is illustrative. This starts only a local page preview, not an iMessage connection or an actual task.

For an authenticated local publishing host:

```sh
npm run init
npm run dev
```

Run commands from this package directory. Node 22 or newer is required. There are **no runtime npm dependencies** and no bundled fonts. The existing messaging process supplies its installed Spectrum SDK.

## The three layouts

| `template` | Selected reference | Use |
| --- | --- | --- |
| `dots` | Research market | White/gray item matrix, current work, exact count |
| `segments` | Fix repository / QA checks | Ten white/gray segments and a percentage derived from a named measurable count |
| `stages` | Place order | Current stage, activity indicator, and completed-stage dots, without invented total-task percentages |

All share the same typography, spacing, header treatment and stage component. All body colors are fixed navy, white and neutral gray. The blue active indicators in the third reference are intentionally removed to follow the final color instruction. No gradients, green success states, glows, payment marks, forms or action buttons.

`references/` contains the three selected mockups for review. They are not served by the application. `public/assets/` contains two already-supplied artwork files, not newly generated art. No mountain image or rainbow brand icon is included in the runtime asset set. Use `header: "none"` for a card without artwork.

## What is implemented

- Shared server/browser HTML renderer and stylesheet; three data-driven layout variants.
- Initial server rendering, visible-page refresh, resume refresh and stale-response rejection.
- Authenticated create/update/read operations for the trusted publisher.
- Ten logical slots, `live-1` through `live-10`, not ten hosting projects.
- Durable slot and revision state: local file storage for development, Upstash Redis REST adapter for Vercel.
- Atomic slot claims, optimistic content revisions, idempotent create/update requests, provider-presentation claims, unknown-outcome handling and safe final release.
- Read-only card URLs with a scoped capability, separate from the write credential.
- An existing-runtime Spectrum adapter: sends once, edits the original message, and handles successful void edit results.
- CLI, example payloads, design guidelines, operating skill, installation and recovery instructions, tests and Vercel Build Output packaging.

## What is NOT claimed

No Vercel deployment, external Redis database, user's running Grokbot integration, real Spectrum call, or physical-device rendering was tested here. See `evidence/TEST_REPORT.md` for the exact local checks.

The included `MemoryTargets` keeps original Spectrum message objects only for the lifetime of the existing runtime process. On restart, card data and slot assignments survive, but provider-card edits require a supported original-session recovery path from that runtime. Without it the adapter returns `REQUIRES_ORIGINAL_SESSION`; it does not fabricate metadata or send a replacement bubble.

This is a small **single-user/setup host**, not a multi-tenant SaaS. A writer token is trusted publishing authority. Read links are bearer capabilities, not proof of who is looking at them. Keep displayed information minimal.

## How updates work

```text
Grokbot task/worker produces actual progress
  -> existing authorized executor invokes supplied runtime helper
  -> helper saves validated card JSON through the publishing API
  -> Vercel page shows that record
  -> existing Spectrum process edits the original message
```

No approval callback is needed: the user only reads the card. Questions, approvals and final deliverables stay in the existing conversation. The actual work continues where Grokbot already runs.

## Files to read

`HANDOFF.md` is the message to give Grokbot. `INSTALL.md` explains local/Vercel setup. `DESIGN.md` locks the visual system. `SKILL.md` is the bot's operating manual. `docs/API.md` specifies the implemented API. `docs/INTEGRATION.md` explains the existing-runtime hook and its recovery boundary.

## Storage and capacity

The limit is ten **current assignments**, not ten tasks ever created. One host serves every slot and historical card. A completed card releases its slot only after its final presentation is reconciled. A reused slot gets a new card identity; old URLs never show a different task.

Historical read-only records are retained for up to **30 days and 100 archived cards**, whichever limit is reached first, by default. These are explicit package defaults, configurable within the documented bounds. They do not expire running/waiting/unknown assignments. An expired historical URL returns unavailable, never a new occupant. Uncertain provider sends/updates retain their slot until reconciled.

## Deployable build

```sh
npm run build
```

Produces `.vercel/output` containing one Node.js function. No credentials are copied into that build. The production configuration requires Redis-backed storage. Installing this archive does not authorize creating paid infrastructure or bypassing platform approvals.
