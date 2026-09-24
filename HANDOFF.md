# Give this package to Grokbot

Install and connect the supplied `live-task-cards` implementation. Do not rewrite it or generate new designs/images.

The selected styles are already implemented: `dots`, `segments`, and `stages`. Use a flat navy body with white and gray only, including active/completed states. This is read-only task progress, not an approval/payment system.

1. Read `README.md`, `DESIGN.md`, `INSTALL.md`, and `SKILL.md`. Keep the three reference screenshots for visual comparison only. Use the two supplied header assets or no header; do not reintroduce the mountains, Orchid identity or rainbow icon.

2. Extract this package into its own directory, leaving the running messaging program and unrelated files intact. Run the included tests and syntax/example checks. Start the local preview and inspect the three templates at 300 × 300 and 300 × 240. The screenshots are layout references; do not reproduce inaccurate visual counts or colored active indicators.

3. Confirm the existing approved Vercel host and durable storage configuration. This package ships a working Redis REST adapter and local development store. Production needs the configured Redis endpoint/token, two distinct generated secrets, and the real production origin. Do not create paid resources or change permissions without the existing authorization. Use one hosting project, not ten projects.

4. Connect `examples/existing-runtime.mjs` inside the existing shared Spectrum runtime using its installed `app` and `edit` exports, its actual authorized `Space`, and its original-card target/session registry. Register the supplied `start`, `update`, and `sync` operations through the existing trusted execution path. Do not create another Spectrum connection or introduce Grok API usage. The current enqueue command's interface is not established by this package: inspect it rather than inventing flags.

5. Keep the returned card ID and revision in the existing task context. Use the ten logical slots automatically. Ordinary tasks only change JSON: title, stage names/states, detail, status and measured progress. No new HTML/CSS/JS per task, no per-update image generation and no deployment for a counter change.

6. Preserve the original Spectrum message/session for in-place updates. The supplied uptime-only target store deliberately fails closed after restart. Reuse a verified existing recovery mechanism where available; do not invent one. Keep this limitation explicit until the actual installed SDK/runtime path has been tested.

7. Verify one authorized real card: original send, two in-place updates, reopen, final update, slot release, then slot reuse without changing the first card's history. Confine any live test to the expressly authorized conversation. Do not automatically send test cards to other people.

Return exact installation paths, changes made to the existing runtime, test results, and separate states for code installed, host deployed, runtime connected, and device verified. Do not call an accepted SDK send “device verified.”
