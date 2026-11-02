# Prototype test results

The first test is promising: both cached animation and repeated Pretext
preparation ran at approximately 120 delivered animation frames per second in
the test browser. For 97 words, cached JavaScript updates took **0.40 ms at p95**;
the repeated-preparation path took **0.50 ms at p95**. Pointer updates took
**0.50 ms at p95**. This is a small measured CPU saving, not evidence that a large
custom cache is necessary at this text length. Pretext's own warm cache is
already effective.

## Final desktop run

- Run timestamp: 2026-11-01T19:21:33.409Z.
- Browser: Chromium 156 in the desktop app's in-app browser on macOS.
- Viewport: 968 × 1194 CSS px, device-pixel ratio 2.
- Specimen width: 572 CSS px.
- One bundled Manrope variable font; actual size, weight, tracking and color.
- 65 sampled type states, fixed line membership, continuously interpolated color.
- Each timed case collects about 2.1 seconds after a 300 ms warmup.
- Idle median RAF cadence: 120.5 fps. FPS here means delivered RAF callbacks,
  not an independently verified monitor refresh rate or GPU measurement.

| Sample | Method | Delivered fps | JS update p95 | Slow frames |
| --- | --- | ---: | ---: | ---: |
| Phrase (7 words) | Cached | 120.0 | 0.10 ms | 0 / 253 |
| Phrase (7 words) | Reprepare | 120.0 | 0.20 ms | 0 / 254 |
| Phrase (7 words) | Pointer · cached | 120.0 | 0.20 ms | 0 / 253 |
| Paragraph (97 words) | Cached | 124.1 | 0.40 ms | 0 / 262 |
| Paragraph (97 words) | Reprepare | 119.9 | 0.50 ms | 0 / 252 |
| Paragraph (97 words) | Pointer · cached | 120.0 | 0.50 ms | 0 / 252 |

The paragraph used 82 unique words × 65 states = 5330 stored width
measurements, approximately 41.6 KiB for the numeric width arrays alone.
Preparation took 80.7 ms of active work, 91.8 ms including cooperative yields.
This excludes initial font loading and includes cache reuse from the phrase;
it is not a browser cold-start benchmark. Rebuilding occurs after text/type
edits, not for each animation frame.

## Accuracy and interaction

All **14/14 browser checks passed** in both desktop and narrow runs. The final
desktop checks include all four attributes at both endpoints. They cover:

- Pretext widths against real DOM word widths at five morph amounts: maximum
  discrepancy **0.0078 px** in the final desktop run.
- No word overlap or width overflow in the default specimens at those amounts.
- Exact endpoint properties, independent pointer states and fixed line membership.

Seven dependency-free Node tests pass for endpoint/midpoint interpolation,
color interpolation, bounded type sampling, pointer falloff, paragraph
segmentation, measurement invalidation and benchmark timing math.
The production build passes.

Browser interactions were also checked manually: scrub to B, Play/Pause,
mouse-driven and keyboard-driven pointer morphing, size edits and Reset,
custom text with paragraph breaks, switching samples, and stopping a benchmark.
The browser reported no console warnings or errors during these checks.

## Narrow viewport

At 390 × 844 CSS px, the controls switch to two endpoint columns
above the specimen, with no horizontal page overflow. All 14 geometry checks
passed, and the six timed cases delivered about 120 fps. This was the same
computer with a browser viewport override, **not a mobile-device test**.

## What this establishes

A small interactive style-morph prototype is practical with this architecture.
A word-level DOM renderer, one animation loop and stable lines are sufficient
for the tested phrase and paragraph. There is no evidence here that WebGL,
workers or a custom glyph renderer are needed for this scale.

It does **not** establish the performance of continuous unquantized font axes,
per-character rendering, many thousands of words, full paragraph reflow,
justification or complex-script shaping. Changes to actual font size, weight
and tracking still require browser layout/painting. Longer specimens extend
past the viewport: all words update, but only visible text needs painting.
The reprepare comparison repeats word preparation against Pretext's warm
internal cache; it is not a complete paragraph-reflow or DOM-measurement baseline.

Further measurement could compare 129/257 type states and a larger specimen,
then a separate live-reflow test.

## Optional properties and interactions

The expanded prototype adds paired optional properties through a single + menu,
with mode-specific controls behind the adjacent ⋯ button. It retains the white
background, consistent 13 px interface type and absence of permanent helper copy.

The final extension benchmark ran at 2026-11-01T20:06:45.775Z in the same desktop
browser, viewport and pixel ratio. All **19/19 browser checks passed**, including
combined transform containment, transformed widths against DOM measurements,
exact opacity/outline endpoints, independent wave values and uniform line wipes.

| Paragraph, 97 words | Delivered fps | JS update p95 | Slow frames |
| --- | ---: | ---: | ---: |
| Cached core properties | 120.0 | 0.6 ms | 0 |
| Reprepare core properties | 120.2 | 0.6 ms | 0 |
| Proximity, core properties | 120.5 | 0.8 ms | 0 |
| Wave, combined effects | 69.4 | 0.8 ms | 77 |
| Line wipe, combined effects | 111.9 | 1.2 ms | 17 |
| Press response, combined effects | 69.0 | 0.8 ms | 92 |

The combined B endpoint uses opacity 35%, vertical shift −18 px, rotation 8°,
skew −8°, width/height 110% and a 0.8 px outline, alongside the core typography.
These cases cost more browser rendering time despite small JavaScript updates.
Slow frames are judged against the approximately 120 fps idle cadence, so a
stable roughly 60–70 fps case still records slow frames. This is a desktop
measurement, not a guarantee for mobile hardware or arbitrary text lengths.

Outline width now shares the 65 font sampling states. A preceding run with
continuous outline widths delivered 60.9 fps for the combined wave; the sampled
run delivered 69.4 fps. This is a small local comparison, not a general speedup
claim. Opacity, transform and color interpolation remain continuous.

Manual browser checks covered adding/removing every optional property, neutral
formatting after removal, Wipe by word/line and reversed direction, Wave playback,
wheel-driven Scroll, Press/release, popover dismissal and 390 px responsive layout.
No horizontal page overflow was found at that narrow viewport. All **23 Node
tests** and the production build pass; the added regression checks outline-color
animation when all numeric endpoints match. No console warnings or errors were
reported during the UI checks.

Reports: [combined effects before outline sampling](benchmarks/optional-features.json)
and [final sampled-outline run](benchmarks/sampled-outline.json). Both retain the
full timings, frame counts, browser metadata and checks.

## Raw reports and previews

- [Final desktop report](benchmarks/desktop.json)
- [Narrow viewport report](benchmarks/narrow-viewport.json)
- [Initial desktop run](benchmarks/desktop-initial.json), before minor UI refinements
- [Latest locally saved benchmark](benchmarks/latest.json), overwritten by a new dev-server run
- [Desktop preview](preview.jpg)
- [Narrow preview](narrow-preview.jpg)

## Curves, scopes and character rendering

The structural extension keeps word rendering as the default and adds a separate
cached grapheme path for Letter/Character. Curve mode distributes the chosen
profile; Wipe, Wave and Proximity use cached unit memberships and restart groups.
Scope is independent of the unit and restart rule. The graph updates with preset,
shape and point edits; dragging never rebuilds font measurements.

The expanded browser comparison ran at **2026-11-01T20:29:57.049Z**, again at
968 × 1194 CSS px and DPR 2. All **23/23 checks passed**. In addition to the
previous checks, it verifies individual grapheme widths against actual DOM
bounds (maximum discrepancy **0.00784 px**), no character overlap/overflow,
word-restarted letter curves and scope exclusion. The 97-word paragraph rendered
**537 grapheme/space nodes**, with 34 unique measured graphemes × 65 states.
The raw report retains the legacy `uniqueWords` field name for this count.

| Paragraph, 97 words | Delivered fps | JS update p95 | Slow frames |
| --- | ---: | ---: | ---: |
| Cached words | 119.9 | 0.5 ms | 0 / 254 |
| Pointer, cached words | 120.0 | 0.8 ms | 0 / 254 |
| Letter curves | 119.1 | 1.7 ms | 2 / 251 |
| Letter wave | 104.7 | 2.2 ms | 32 / 220 |

Character measurements took 2.7 ms active / 14.9 ms including cooperative yields
in this warm run. These figures apply to this desktop and specimen, with only
visible text requiring painting. They do not establish performance for thousands
of characters, combined heavy outlines/transforms, or mobile devices.
Individual grapheme rendering changes cross-character kerning and ligatures;
word mode retains the original whole-word shaping path. Joined emoji and combining
accents remain single graphemes, but complex-script shaping is outside this test.

All **36 Node tests** and the production build pass. Manual checks include counted
word restarts, sentence scope, switching back to whole-word rendering, custom
curve keyboard edits and drag, point addition/removal, steps, line grouping and
narrow-screen popover containment. Numeric input retains its typing delay.

[Raw curve/scope report](benchmarks/curves-scopes.json).

## Base typography and endpoint inheritance

Base now provides shared font family, automatic/manual line height and defaults
for active properties. Explicit A/B fields override it, and each field can resume
inheritance through its reset arrow. New Font/Line height rows start inherited;
the initial four-property morph remains explicitly configured.

The extended browser run at **2026-11-01T20:48:08.799Z** passed **27/27 checks**.
It verifies serif/mono measured widths through the family switch (maximum error
**0.00762 px**), a discrete family change exactly at 50%, actual 40/80/120 px row
spacing through a 40→120 px leading blend, and shared system-sans widths at A,
midpoint and B (maximum error **0.00723 px**). Manrope, Serif, Mono and System sans
are thus covered by actual DOM geometry comparisons.

The short font-family/leading override animation delivered **120.0 fps**, with
**0.2 ms p95 JavaScript updates** and no slow frames in 253 samples. The default
97-word case remained about 120 fps; letter curves measured 119.1 fps / 1.8 ms,
and the letter wave 103.3 fps / 2.4 ms. These are local warm desktop measurements,
not a promise for all installed fonts, systems or longer text.

All **46 Node tests** and the production build pass. Additional manual browser
checks cover changing Base while B is overridden, restoring inheritance, clearing
leading to Auto, removing/re-adding typography rows, resetting Base and endpoints,
retaining pending numeric edits during sample changes, and the narrow UI. The
interface font remains unchanged by the specimen's shared font setting.

[Raw Base typography report](benchmarks/base-typography.json).

## Open numeric ranges

Arbitrary style minima/maxima and spinner grids are removed. Shared Base and
endpoint inputs accept subpixel values and larger dimensions; transforms support
multiple turns and signed scales. Timing, radius and width controls have positive
numeric domains without the original design ceilings. Gaussian normalization is
stable at very small/large positive widths and when the peak reaches either end.

All **55 Node tests** and the production build pass. New checks cover fractional
sizes, signed scales through zero, rotations across every quadrant/multiple turns,
finite bounds, skew singularities, narrow waves, extreme Gaussian widths and
short/long playback periods. Playback keeps a phase offset instead of multiplying
an unlimited duration into an absolute timestamp.

Browser interactions verified **0.125 px**, **0 px** and **180.5 px** font sizes,
**−25 px** tracking, **720°** rotation and **−250%** horizontal scale. Actual DOM
boxes stayed finite; zero-size text produced a zero-width box. A skew crossing a
vertical pole kept the last valid preview, displayed its reason and recovered
when corrected to 60°. No console errors were reported during those checks.

The existing full comparison passed **27/27 browser checks** again, including
word/grapheme geometry, transformed bounds, endpoint properties, scope and shared
font/leading behavior. Timings varied with RAF cadence, so this run is used as a
regression check rather than a speedup claim. Extremely tight tracking and manual
leading may overlap intentionally; the default specimens retain their previous
layout checks. Browser/CSS limits still apply beyond the app's numeric validation.

[Raw open-range regression report](benchmarks/open-ranges.json).

## Live reflow toggle

Live reflow is off by default. It fits current cached word/grapheme advances,
updates automatic line spacing and reuses the same DOM nodes while animating.
Toggling it off restores the original conservative composition. Explicit leading,
paragraph boundaries, scopes and property inheritance remain available.

The expanded run at **2026-11-01T21:17:33.750Z** passed **37/37 browser checks**.
The 97-word sample changed from **12 lines at A to 25 at B** in word mode, or
13→25 in the independently rendered character mode. Across five amounts, maximum
DOM width discrepancies were **0.00779 px** for words and **0.00771 px** for
characters, with no default-specimen frame clipping or overlap. Browser checks
also verified node identity reuse, bounded line-curve fitting and restoring
stable lines on disable.

| Paragraph, 97 words | Delivered fps | JS update p95 | Slow frames |
| --- | ---: | ---: | ---: |
| Stable cached words | 120.0 | 0.6 ms | 0 / 252 |
| Live reflow | 120.0 | 0.8 ms | 0 / 253 |
| Live line curves | 120.0 | 1.5 ms | 0 / 253 |
| Live letter wave | 86.5 | 3.7 ms | 71 / 183 |

These remain warm desktop measurements at 968 × 1194 CSS px and DPR 2. Long
paragraphs extend beyond the viewport; all nodes update but only visible text
needs painting. No mobile-device or universal frame-rate claim is made.

The line-restarted Gaussian cases used sampled-assignment fallback at all four
checked amounts in both rendering paths. They remained fitted and within the
six-pass budget. This does not claim exact final-line curves in cycling cases:
the last sampled assignments are kept until input changes, allowing composition
to remain responsive without inserting breaks. A stationary Proximity gesture
similarly keeps its event-sampled anchors while response settles.

All **68 Node tests** and the production build pass. The new tests cover current
width fitting, outgoing-space handling, canonical grapheme IDs, counted restarts,
line cycles and response latching, stationary-pointer settling, final-line group
consistency, explicit/automatic leading, blank paragraphs, zero-size/oversized
text and reuse/restoration through repeated toggles. Manual UI checks cover
short/long samples, curve/character controls and the responsive checkbox layout.

[Raw live-reflow report](benchmarks/live-reflow.json).

## Property removal visibility

Removal is now a persistent muted × beside each property in both A and B;
either button removes the paired rows and uses Base for that property. The
existing entered values are retained for re-adding. Immediate property edits
also cancel stale pending numeric previews, so a removed effect cannot return
when a typing timer fires.

The existing 68 tests and production build pass. A focused browser pass verified
removal from both columns, opacity returning from 20% to Base 100%, remembered
values on re-add, and entering 50% immediately before removal without a later
preview restoring it. Desktop and 390 px layouts remain readable. The full
performance benchmark was not repeated for this small control change.


## Skew spacing, theme and local font loading

- Reproduced a 0° → 40° skew increasing the first word advance from 99.36 px
  to 137.96 px. The renderer had used the full sheared ink rectangle as advance.
- Flow now excludes skew; ink geometry remains separate for painted bounds and
  automatic leading. Shear overhang is reserved once at each frame edge.
- Final browser reproduction: 99.36 px advance at both 0° and 40°, with the
  first word's ink inside the left frame edge. Stable/live word and character
  rendering also have regression tests.
- Verified dark surfaces, theme persistence across development reloads, adapted
  default colors and preservation of a custom color through a theme switch.
- Loaded Georgia.ttf via the real local file picker; confirmed the generated
  FontFace was rendered by both endpoints, exposed in A/B choices, and could be
  overridden independently on B. Failed decode and unsupported file paths have
  automated cleanup checks. Files stay in memory for the current page session.
- 71 Node checks pass; production build succeeds. This is correctness validation,
  not a new animation performance benchmark.


### Skew direction and quiet remove controls

Positive skew now leans right and negative skew left. The renderer and combined
rotation/skew bounds use the same typographic sign convention. Browser checks
confirmed both transform directions and that removal icons have opacity 0 off
the row and opacity 1 on an active row. They remain available through keyboard
focus. 72 automated tests and the production build pass.


## Refresh persistence and Restore defaults

- 79 Node checks pass, including Base inheritance, inactive overrides, custom
  curve points, mode profiles, safe schema validation, malformed JSON, unavailable
  storage and complete default setup. Production build succeeds.
- Actual refresh retained A size 23, B size 68, B skew 20, A color #cc8877,
  custom two-paragraph text, Gaussian character distribution, restart every
  three words, four steps, peak 0.35, slider 73%, live reflow and dark mode.
- The locally opened Georgia.ttf survived refresh with its stable font ID and
  actual rendered family. Base leading 58 and B's separate system-sans override
  survived. Curve duration 8.2 seconds also survived.
- Refresh immediately after typing B size 70 retained 70. Refresh immediately
  after entering Steps 5 flushed the pending curve edit and restored 5.
- Restore defaults followed by refresh returned original text, four core
  properties, sizes 30/46, Manrope/Auto leading, linear word distribution,
  restart Never, zero steps, Scrub at 0%, live reflow off and light mode. Loaded
  Georgia remained available in the font library. Playback reopened paused.


## Alignment and shared dropdown styling

85 automated tests and the production build pass. Added alignment coverage for
stable/live word and character rendering, paragraph/blank-line endings,
justification without letter stretching, oversized lines, aligned pointer
anchors, cache invalidation, saved setup compatibility and defaults.

Browser checks measured centered and right-aligned edges within 0.008 px.
Justified word and character modes filled wrapped lines in both stable and live
layouts (character live widths within 0.006 px); paragraph final lines remained
left aligned. Alignment and live reflow survived refresh. The centered SVG's
horizontal and vertical offsets from its button center were exactly 0 px.

Checked app-themed select buttons and popup menus in light and dark modes.
Actual keyboard navigation (Home, Down, Return) chose Center successfully.
Base-select preserves browser-managed option selection, focus and semantics;
fallback browsers retain native pickers. Left alignment keeps the original
single-pass paint path, and alignment edits reuse the prepared font cache.


## Native text selection

89 tests and the production build pass. Added checks for logical word spaces,
blank paragraph breaks, stable/live character gaps, justified spacing, inherited
opacity/baseline and zero repeat writes on cached idle frames.

Browser reproduction before the change selected `Thelightleavesslowly` with
separate word highlight boxes. The same word-mode drag now selects
`The light leaves slowly.` with one joined highlight. Character selections keep
spaces once, and live character Select All retained two paragraphs separated by
a blank line. Paragraph separator spans did not shift glyph baselines (0 px
spread among equal-style glyphs on a line).

UI label dragging cannot select labels or buttons. App Select All is scoped to
specimen text and does not highlight numeric controls. The textarea's native
Select All still selects its full editable value. Selection colors use system
Highlight/HighlightText, with no fixed palette or synthetic highlight overlay.


## Text-block width

91 web tests and the production build pass. Saved setup checks cover Auto,
fractional widths, ordinary/large widths, reset, older setup compatibility and
invalid values while retaining other typography.

Browser verification changed a 624 px Auto block to exactly 320 px; stable line
count changed from 2 to 5. The 320 px width and Live reflow setting survived an
actual refresh. An entered 2000 px preference fitted the 624 px available space
while keeping 2000 in the control. Restore defaults returned the control to Auto
and the block to the available 624 px. Width changes reuse the prepared model;
recording its composed width also avoids a duplicate ResizeObserver mount.


## Width ruler and current-style refitting

96 tests and the production build pass. New regression checks cover fitting
current states instead of the larger endpoint, stable/live word and character
identities after resizing, fixed membership during morphing, blank paragraphs,
alignment, native-selection whitespace and cached font-model reuse. Additional
line-curve cases retain the exact fitted targets to avoid post-fit overflow.

In-browser, a 300 px box had matching line counts with Live reflow off and on.
Narrowing to 160 px produced five lines with Live reflow off, and the ruler/box
width survived an actual refresh. Auto returned to the full 624 px workspace.
A real pointer drag changed 380 px to about 220 px and immediately refitted to
four lines. Width is absent from Base and is now the ruler above the specimen.

## Fixed source sampling and offsets

132 web checks pass. The 18 added checks cover signed/fractional wrapping, all
restart modes and scopes, coherent source noise, virtual Style A composition,
stable glyph identities (including repeated letters/emoji), immutable source
lines across resize/refresh/B metric preparation, explicit Resample and context
changes, live composition without source feedback, fitted stable snapshots,
unchanged color-only frame geometry, DOM node retention and zero repeated-frame
writes. UI checks cover conditional controls, coalesced sliders, integer dragging
with fractional input, delayed/invalid positive width input, pending input flush
and Restore defaults. Existing 114 checks remain passing.

The production build passes. Browser checks confirmed changed colors with an
unchanged frame at 75% versus 125%; exact character colors across actual width
936 → 600 px, Live reflow and refresh; changed values on Resample; non-line word
restart offsets; default restoration; light/dark popover fit; and no console
errors. Browser testing used a separate local origin to preserve user settings.

Sampling changes line topology only. Source widths come from cached Style A
measurements; offset/curve edits and animation retain the same source. Whole-word
wrapping, the existing 65 metric states and the lack of InDesign hyphenation remain
prototype limits. No new timing benchmark is claimed for this follow-up.
