# Local verification report

Package: `grokbot-live-task-cards` 1.0.0.

## Passed

| Check | Result |
| --- | --- |
| `npm test` | **80 tests passed; 0 failed; 0 skipped** |
| `npm run check` | **26 JavaScript modules passed syntax checks; all three create examples validated** |
| `npm run build` | **Build Output API directory generated successfully** |
| `python tests/browser-check.py` | **18 browser layout cases and 6 browser client checks passed** |

Local Node: v22.16.0. Local npm: 10.9.2. Linux x86_64. Browser version is recorded in `browser-checks.json`.

`unit-tests.tap`, `syntax-check.txt`, `build.txt`, and `browser-checks.json` contain the actual output/results. These are package tests, not results from the user's GitHub repository or VM.

## Coverage

Input/schema validation; exact 27/50 dot count; partial-fill 74% segmented bar; no invented stage percentage; fixed grayscale/navy palette; no action controls; read-key scope; writer authorization; escaped text and JSON bootstrap; no-store/no-referrer; bounded request size; real HTTP create/read/update; ten-slot concurrency; duplicate requests; revision conflicts; unknown provider outcomes; restart retention; historical URL identity; release/discard rules; original-message edit targeting; successful undefined edit results; missing-session failure; and pending-ack reconciliation.

The provider-boundary tests use doubles for Spectrum builders/send behavior. The Redis tests exercise the real REST adapter with a simulated command/CAS boundary, **not a running Redis server**. File-backed state, HTTP routing and the publisher client are actually exercised locally.

## Browser method

Browser layout checks render the shipped server HTML and CSS with existing image bytes inlined, avoiding browser network access. The six views are research, checks, stages, waiting, completed and unknown-count. Each is checked at 300 × 240, 300 × 300 and 390 × 390: no horizontal page overflow, no footer clipping, usable progress area, no form/button, and the exact flat navy background.

Browser client checks execute the shipped renderer/client logic with a synthetic read key and stubbed fetch. They verify count refresh, read-only credentials, stale revision rejection, delayed-update reporting, terminal rendering and reduced motion. This is not a deployed browser-to-Vercel end-to-end test.

## Not performed

- A live Vercel deployment or hosted-function route test.
- Real Upstash credentials/database or Lua execution against that service.
- Imports/calls against the user's actually installed Spectrum version.
- A change to the user's running Grokbot, queue or recipient permissions.
- A real iMessage send, original-bubble update or physical-device refresh.
- Provider session recovery after restarting the actual shared runtime.

The code and local evidence are supplied for installation and environment-specific integration. These remaining checks must not be relabeled as passed based on local mocks or a successful build.
