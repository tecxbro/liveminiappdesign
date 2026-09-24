# Design contract: Live Task Cards V1

## Source of the design

The three screenshots selected in the conversation define the layout direction: a header image, navy body, identity/status row, large task title, short subtitle, divider, stage row, and an icon-led progress area. The package implements that language as actual HTML/CSS, not a screenshot used as an interface.

The user's final instruction overrides accent colors visible in one selected reference: **all UI states are navy, white and neutral gray**. Other changes documented below are implementation decisions, not claims that the screenshots already provide a working progress system.

## Palette

All permitted UI colors are defined in `public/card.css`:

| Token | Value | Purpose |
| --- | --- | --- |
| `--navy` | `#07152a` | Flat body and negative space inside markers |
| `--white` | `#ffffff` | Primary text, completed work, active rings |
| `--muted` | `#bac1cb` | Secondary labels and freshness |
| `--pending` | `#657084` | Unfinished dots/segments and pending marker outlines |
| `--rule` | `#465266` | Decorative dividers |

No UI gradients. No neon or glow. No blue current-stage ring. No green completion. No amber waiting or red failure. Communicate status using the displayed word and an icon/shape, not a new hue. Do not derive UI colors from the header photograph.

## Typography and sizing

Use the system stack already familiar from the reference: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`. No font download or bundled font file.

At 300px width: 16px horizontal inset; title 18px/22px at weight 720; detail title 15px/18px; subtitle 11px/14px; metadata 9px/11px; stage labels 8px/10px. Stage markers are 22px circles. Existing future-button tokens remain 48px high and 24px radius, but V1 renders **zero buttons**.

The reference-shaped page is designed for 300 × 300. At 300 × 240 it uses a 40px header, tighter spacing and hides only the secondary top subtitle. It keeps the title, status, stages, current result and progress. Larger 390 × 390 views receive a modest type and spacing increase. These are implementation viewport targets, not asserted Photon platform limits.

The rendered page fills its host. Do not put the beige screenshot surround or a second speech-bubble tail inside the live page. The standalone review gallery adds a rounded preview frame; the actual embedded page does not duplicate container decoration.

## Shared anatomy

The optional header uses one approved local asset with `object-fit: cover`. The body order stays stable across updates: identity/status, title/subtitle, thin divider, stages, progress detail, last actual update time. Shorten wording before squeezing more content in. The full short label remains available in the DOM/accessibility text if visual ellipsis is needed.

The V1 defaults omit the Orchid label and rainbow icon. The text eyebrow defaults to `TASK`; it may name a relevant task category. Do not fabricate another company's branding.

## Stage states

`done` is a white filled circle with a navy check. `active` is a thick white ring with a navy center. `pending` is a gray outline. `blocked` is a white-outlined pause marker. Current work is named in text. There may be one active stage only, and only for a `running` task.

Stages are **data**: their IDs, labels and state can describe research, coding, preparing a report, fulfilling a previously approved task, or other real work. There are 2–4 stages; four is the default layout. Labels are not hardcoded to Plan/Code/Test/Ship.

## The three variants

### `dots`

Use for a measurable batch: 27 of 50 profiles verified, 18 of 32 files processed, and similar work. Up to 50 items get one dot each, filled left-to-right, row-by-row. Exactly 27 of 50 means exactly 27 white dots and 23 gray dots.

For larger totals the display uses a bounded 50-dot proportional meter with a partial fill where needed; the exact count remains in text and the accessibility label. Never imply that each displayed dot is one item in that mode. The count measures its named unit, not necessarily the whole project's completion.

### `segments`

Use for measurable checks or a count-based stage. The bar always has ten rounded segments. The count determines the fill and percentage. At 37/50, seven segments are full, the eighth is 40% filled, and the last two are empty: 74% of **those checks**.

If there is no honest denominator, send `progress: null`. The existing component shows stage progress rather than inventing 74% of an open-ended coding assignment.

### `stages`

Use for open-ended work or a process without a useful item total. Display the current named stage, one short line of detail, and the completed/current/pending stage dots. The activity ring is white/gray and explicitly indeterminate. “Step 3 / 4” is not “3 completed” and is not an automatic 75% completion estimate.

The order example is a read-only status for an already-authorized task. It adds no shopping/booking integration and no permission to spend.

## Terminal and waiting states

Completion is a plain white check, never green. Failed/cancelled states use a monochrome cross and accurate text. Waiting uses a monochrome pause and asks the user to respond in the normal chat. No card button is added.

If the last stage is Send/Deliver, do not mark it complete while the result is merely “ready to send.” Actual delivery has to be reported by the existing task workflow. The completed example therefore says the result was delivered, rather than copying that contradiction from an earlier mockup.

## Artwork

Two original supplied images are included under `public/assets`: `study.png` and `hands.png`. They were copied, not generated. They are optional presentation artwork, not evidence of work being done. `header: "none"` removes the image region entirely.

Choose the header once per new task. Reuse that selection for ordinary progress updates; rotate among approved assets between tasks, not every few seconds. New artwork is an explicit asset-library change, not part of task execution. Add it to `HEADER_ASSETS`, `HEADERS`, and the HTTP static allowlist, then test and deploy once. Do not pull arbitrary external image URLs from model output.

The selected reference screenshots remain review-only files. Their mountains, logos and blue accents are not production defaults.

## Motion and accessibility

Only the indeterminate activity ring moves. Do not reanimate an entire card on each data update or use simulated counting. Respect reduced-motion preferences. Include accessible labels for dot counts, progress bars and stage states. Do not expose every internal worker event as an announcement.

Freshness is the last real saved task update. A browser refresh must not change that time. A failed refresh says “Updates delayed”; it does not claim the job failed.

## Allowed changes at runtime

Change task title, small subtitle, task category, status, stage labels/states, detail text, and verified progress counts through the data API. Choose a shipped template/header when the card is created. Retain a stable layout within one task unless the user explicitly asks for another supported variant.

Do not write HTML, CSS, JavaScript, a new page, a new deployment, custom color values or new controls for a routine progress update. An explicit design change is a separate code change to this shared system and must preserve other active cards.
