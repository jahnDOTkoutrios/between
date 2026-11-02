# Verification

## Automated suite

`node tests/tracking-ramp.test.cjs` runs 253 dependency-free checks against the
actual script functions in a mocked document/ScriptUI host. Coverage includes:

- Letters/spaces/Both eligibility and outgoing tracking boundaries.
- Curve interpolation, bounded custom handles, bell symmetry, and step sampling.
- Snapshots, replacement baselines, Cancel, Undo grouping, and preview reuse.
- Numeric properties and variable-axis validation.
- Unit/restart grouping, including 108 combinations of units, groups, and targets.
- Partial selections, frame ownership, resulting-line convergence/cycle handling.
- Preview-group inspection without document mutations, smart-quote enumerators,
  cached graph invalidation, and inactive Clear tracking behavior.
- Frame contraction/expansion with baseline restoration, live zero-first scope,
  exact effective tracking comparison, and changing-line cycle diagnostics.
- Underline activation, automatic baselines, and shared activation during replacement.
- Atomic paragraphs, partial selections, mixed baselines, narrow replacement,
  normalized preview reuse, and paragraph UI constraints.
- Resolving plural native paragraph specifiers before reading scalar indices.
- Glyph-gap metrics placement/crowding, soft-break bounds and snapshot remapping,
  and width-only processing preserving break ownership.

New performance coverage checks trailing numeric input, cancellation/disposal,
immediate Apply, bulk-read fallbacks, lazy snapshots, exact kept patches,
narrow replacement restoration, advanced-stage fallback and stale signatures.

## V8 seeded noise and keyword restart

The current suite retains all earlier coverage and adds comma-separated keyword
boundaries and deterministic Random, Smooth and Fractal noise. Noise checks cover:

- Exact Off/zero-Amount compatibility, bounded values and unchanged step buckets.
- Seed variation, exact 32-bit reference mixing and coherent smooth samples.
- Positive bounded word counts, disjoint complete groups, partial scopes and
  separate value/restart streams; inactive targets do not change other modes.
- Multi-attribute style blending, saved stacks, exact reapply, Cancel and Undo.
- Off-by-default UI, transactional panel edits, local slider/seed changes and
  restoring previous appearances when noise is disabled.
- Bounded Line length contours and isolation from auxiliary Line width.

18 focused native keyword checks passed in InDesign 2026 on macOS. Noise passed
26 native checks: all three fields repeat exactly; Cancel and saved reapply
preserve baselines; real panel controls have usable widths, start disabled when
Off and update only on Set; noisy smooth/stepped contours preserve paragraphs,
repeat their paths and restore geometry on Cancel. The panel was inspected
visually. 48 numeric samples also match between Node/V8 and native ExtendScript.
These checks used disposable documents and left user artwork unchanged.

## V8 fixed line sampling

16 added automated checks cover fixed baseline sampling without composition
iterations or forced breaks; exact assignments across resize, reapply and
overset; explicit resampling; Cancel and Undo; curve/noise edits; line units and
multi-attribute blends; independent saved stacks; scope/context changes;
stale-sample rejection; cache invalidation on Resample; Clear tracking;
conditional controls; default Follow layout; and wholly overset frame recall.

30 focused native assertions passed in InDesign 2026 on macOS. These cover real
width changes, saved sample/value retention, Resample and replacement history,
Cancel/Undo, completely overset frames and empty-frame resampling rejection,
save/reopen, actual tracking-driven recomposition, and native UI layout,
recalled controls and preview behavior. Tests used disposable documents. The
native controls were visually inspected; user artwork was preserved.

## V8 fractional pattern offset

16 added automated checks cover signed cyclic shifts across sampled line
boundaries, fractional interpolation at the wrap seam and step edges, integer
tracking precision, exact zero/full-cycle restoration and a single sample.
They also cover zero/off compatibility, unchanged source values, curve/noise
edits, invalid-number rollback, saved recipes/stacks, resize and overset,
Resample, style blends, local graph-only dragging, delayed typing, final Apply
and Cancel with pending changes.

23 focused native assertions passed in InDesign 2026 on macOS. These verify
actual tint assignments without recomposition, whole-field seam wrapping,
fractions, exact zero/full cycles, retained source boundaries across resize,
Resample, saved recipes and save/reopen, Cancel/Undo, word fragments and joint
font-size/skew blending. The native dialog was visually inspected. Its saved
offset loads with Preview off, signed slider units match the sampling mode,
dragging leaves formatting untouched, release previews the final fraction,
and Cancel restores the previously committed setup and appearance. Tests used
disposable documents and restored the user's original document and selection.

The web prototype's 114 existing tests also pass, including native noise parity.
No web prototype behavior changed in this update.

## V8 offset across restart types and integer slider

The automated suite now passes 253 checks. Six new checks cover complete-field
shifts across Never, Word, Sentence, Paragraph, Line, Frame and Keywords with
both word and character units; unchanged noise/topology; Follow layout plan
application; non-line saved stacks, exact reapply, zero replacement and Undo;
shared style-blend percentages; graph-only curve edits; and signed integer
slider snapping with fractional typed input. Prior fixed-sampling checks remain.
Zero/absent offsets retain the previous non-fixed allocation path.

30 focused native checks passed in InDesign 2026. All seven restart structures
apply their expected shifted values, return exactly to zero and restore the
baseline on Cancel. Further checks cover Follow layout tracking composition,
saved non-line offsets and unchanged reapply, native Distribution placement,
positive/negative integer snapping without writes during dragging, release
preview, typed fractions and Cancel restoring previous settings/formatting.
The controls were visually inspected in a disposable document.
The web prototype's 114 regression checks also pass; no web behavior changed.

## Historical v5 native verification

231 checks passed in Adobe InDesign 2026 on macOS. These are development-time
native checks and are not run by the Node test command. They covered:

- Actual word-gap measurements and numeric property application/restoration.
- Variable-font axis ranges and intermediate fill/stroke colors.
- Rendered glyph outlines at high baseline shift, skew, rotation, and scale.
- Contour bounds, anchors, Cancel/Undo, independent curves, and story threading.
- Fully justified resulting-line values and grouped distributions across linked frames.
- Sentence counts with quotes, abbreviations, decimals, and Unicode punctuation.
- Dense 5 pt metrics overlays retaining every annotation without overset.
- Grouped typography after frame contour shaping.
- Native UI group inspection, curve dragging, Gaussian graph refresh, metrics,
  fixed-break status, and a committed Undo group.
- Frame-scope Word/Character contraction and expansion, incoming/outgoing values,
  clear-first gaps, and exact restored baselines.
- Printable, visible metrics with measured glyph-gap placement, no accumulating
  row drift, tight-gap centering, and unchanged source leading. A 30-row PDF
  retained all 90 integer labels and was visually inspected.
- Cycling justified Word and Character line curves using managed soft breaks,
  whole-story fallback, exact final values, unchanged paragraph count, and restored
  hyphenation. Stable curves insert no breaks.
- Fixed-break Cancel/reapply without accumulation, cross-property history,
  zero-first tracking, and safe rejection after manual text edits.

The previous 164 native checks were rerun, plus 30 new checks for underline
weight/offset endpoints, automatic settings and flags, partial paragraph
selection, mixed indent baselines, narrower reapplication, hanging indents,
frame-scope paragraph continuations, Cancel and Undo. The actual UI was also
checked for all new property choices and paragraph-only control locking.

A further 31 native checks cover two/three-property stacks, exact kept values,
Cancel/Undo, duplicate rejection, Undo addition, kept-only preview, failed drafts,
color swatches, baked contours, managed breaks, cycling tracking/font-size
fixtures, clearing with outgoing overset, and the actual Add property/Apply all UI.

An additional six native assertions cover typed numeric input, Apply/Undo and
pending Cancel. The production 350 ms dialog accepted 2 → 27 → 275 without
calculating 2 or 27. The isolated pending-Cancel fixture widened its delay to
3000 ms to accommodate UI automation latency; Escape cancelled the pending
value and restored the original formatting. The 350 ms cancellation/deadline
logic is also covered deterministically by the automated suite.

Performance differential checks compare old/new formatting, unit boundaries,
distributions and all 462 annotation positions. See [performance notes](PERFORMANCE.md).

The slider follow-up adds two automated checks and a focused native rerun
with eight passing assertions: no preview calls or formatting changes during
movement, one full preview on release, final value retained, metrics rebuilt,
and a single Undo restoring formatting and removing annotations. The previous
231-assertion broad native run predates this isolated slider change.

## Historical v5 Line length follow-up

Eight additional automated checks cover percentage metadata/structure,
centered inset math, refitting counts, bounded cycle fallback, strict rejection,
UI structure/scope restoration, safe owned-whitespace restoration, malformed
ownership rejection and cross-property soft-break remapping.

77 focused assertions passed in native InDesign 2026: 72 API fixture assertions
and five actual UI assertions. Coverage includes one paragraph per fitted row,
equal indents, linear endpoints, wider rows taking more words, Gaussian/custom
curves and steps, original returns and outer spacing, full justification,
existing character skew and replacement history, short text, manual soft breaks,
overset baselines, narrow-width rollback, manual-edit rejection, metrics,
property stacks, Cancel/reapply and Undo. The UI was checked with a typed 90%
maximum and the forced Current frame/Line/Both/Never structure.

The rebuilt guide has three A2 pages, 17 examples and 25 editable specimen
frames. New long Gaussian and short linear specimens use the actual engine.
The long specimen was checked for one row per paragraph and equal indents;
all three PDF pages were rendered and visually reviewed. Only the existing
frame-scope comparison stories intentionally contain overset text.

## Historical v6 break-policy verification

117 automated checks pass. New coverage exercises the default-off toggle,
separation from Auto-stabilize, explicit no-break policy overriding the old
tracking flag, and compatibility with explicitly saved v5 break settings.

102 native assertions passed in the v6 source: 23 break-policy checks, 72
repeated legacy Line length checks, and seven actual UI assertions. No-break
Line length preserves exact text, paragraph count and paragraph formatting;
custom/stepped contours, metrics, reapply, original-frame preservation, both
switch directions, kept contours, Cancel and independent Undo were checked.
Tracking completes without inserted soft breaks when disabled. A deterministic
cycle in the automated suite confirms Fixed sampling is used without invoking
the insertion path. The actual UI starts off, switches on/off, applies the
selected mode and undoes text/geometry as one Tracking Ramp 6 transaction.

The guide was rebuilt in v6. Example 16 explicitly permits managed paragraph
breaks; example 17 preserves its single paragraph with a centered contour.
The contour follows frame height, so no-break width samples can cover only
part of the curve when the text is short. All exported PDF pages are rendered
and visually reviewed before publishing.

## Historical v7 style-blend verification

138 automated checks pass. Coverage adds joint numeric interpolation, inherited
values, attribute exclusions, missing/automatic settings, narrower replacement,
tracking-gap preservation and precise history ownership, kept blends and one
Undo, fresh definition updates versus frozen kept values, Gaussian word restarts,
short-route rotation, inheritance cycles, grouped-name/ID remapping, compatible
and incompatible colors, variable-font file identity across named instances,
percentage validation, automatic Text Color tokens and real ScriptUI selection
semantics in documents with no character styles.

150 native assertions passed in the v7 source:

- 35 API checks: 21 simultaneous numeric/color attributes, endpoints/midpoints,
  retained fonts/style assignments/on-off flags, source style integrity, inherited
  values, exclusions, gap behavior, automatic leading/Text Color restoration,
  narrower reapply, swatch cleanup, metrics, frozen stacks, variable axes and
  incompatible-font rollback, and coupled frame-scope overset restoration.
- Nine actual UI checks: normal operation without character styles, Style A/B
  selectors, the Blend attributes dialog, excluding tracking while blending
  other values, Apply and a single named v7 Undo.
- 11 exported-IDML checks: four pages, 28 named specimens, grouped endpoint
  style resolution, reapplication and exact Cancel restoration for 18-20.
- 95 repeated break-policy and Line length checks from the v6 implementation.

The rebuilt guide includes 20 examples across four A2 pages. Its endpoint styles
are editable in the Guide blends character-style group. All four PDF pages were
rendered and visually reviewed; only the preexisting scope comparisons have
intentional overset text.

## V8 saved-setup and original-endpoint verification

162 automated checks pass. New coverage exercises saved stack order and plain
recipes, unchanged reopening/Cancel, source-definition refresh, replacement
baseline ownership, forgetting and independent Undo, saved highlighted scope
controls, foreign linked frames, changed text, inferred mixed values/scales,
inherited priority, one-sided variable axes, automatic color/leading tokens,
bulk snapshot fallbacks and native paragraph-enumerator conversion. A lexical
smoke check catches known ExtendScript reserved declarations; native loading
remains the actual host syntax check.

294 native assertions passed:

- 62 blend/setup API: existing joint attributes and rollback plus original
  numeric/color/axis endpoints, None-stroke paint, mixed values, automatic
  leading, ordered reapply, source edits, Forget, ownership and stale text.
- 30 actual UI: unchanged reopening, Preview/Reapply, missing-style repair,
  Forget and independent Undo, restored highlighted scope, loaded Kept stages,
  inferred attribute controls and the Original text/Skip policy. Nine assertions
  exercise actual v7 metadata, untouched recovery, scope review, edited source
  definitions, creating a v8 recipe and Undo back to v7.
- 95 repeated break-policy and Line length assertions.
- 14 recalled layout assertions: contour and managed-paragraph stacks, exact
  Cancel/Undo, original break policy, tracking soft breaks and saved selections.
- 93 exported-IDML assertions: five pages, 31 named specimens, all 29 owning
  recipes, grouped endpoint resolution, refresh/Cancel, metrics ownership and
  named baseline swatches when color is excluded.

Seven native performance differential cases compare v7/v8 text, plan units,
sampled values and all 2,672 characters' captured formatting. All matched.
The timed v8 build predates final UI/portability polish; this is a development
comparison, not a timing guarantee. See [performance notes](PERFORMANCE.md).

The guide has five A2 pages, 23 numbered examples and 31 editable specimen
frames. Each owning specimen carries a real saved v8 setup. All five final PDF
pages were rendered and visually checked, including a high-resolution heading
check. Intentional frame-scope comparison overset remains; no other text spills.

## Manual smoke test

Use a disposable document for the checks below.

1. Create a text frame containing several sentences and words of different lengths.
2. Type a multi-digit Max value without pausing between digits. Confirm one
   update after a short pause. Apply must use the latest value; Cancel before
   the delay must restore the document without applying queued work.
   Run the script. Choose **Font size**, **Values per → Character**,
   **Restart curve per → Word**, and **Gaussian bell**; choose at least three
   characters per test word. Confirm each word receives the complete pattern.
3. Choose **Graph: Group**, then change its number. Confirm only the graph/readout changes. Drag a point;
   confirm the shared custom curve updates the document and the visible graph.
4. Press **Cancel**. Confirm original formatting, swatches, and metrics state return.
5. Run again with **Tracking → Word → restart per Sentence**, then Apply.
   Confirm the effect is kept as one named Undo action. Reapply a smaller range
   and confirm the previous effect does not accumulate.
6. Link two frames and choose **Entire story**. Test **Line → restart per Frame**
   and **Character → restart per Line** with modest tracking ranges. Confirm
   values agree with the final composed boundaries; overset has no line/frame group.
7. Enable **Metrics 5 pt** in Normal view. Confirm integer tracking labels appear
   between the text rows, below their source line, and disappear on Cancel.
   Apply and export a PDF; confirm labels print. Try tight leading: labels may
   clash but stay centered, and source leading must stay unchanged.
8. Use a full frame with overset text. In Current frame scope test Word and
   Character tracking, both increasing and decreasing it. Confirm newly fitting
   text joins the curve and text leaving the frame returns to its baseline.
   Repeat with Clear tracking and verify incoming gaps are zeroed.
9. Try a fully justified **Tracking → Word → restart per Line → Gaussian**,
   Min 0/Max 300. For a cycling layout, confirm the fixed-break count appears
   with Auto-stabilize and Allow added line breaks enabled; final values should match each line. Cancel must
   remove the inserted text; Apply/reapply must not accumulate breaks. A zero
   range should insert none. Disable Auto-stabilize to test strict rejection. Other property cycles should
   complete with a visible Fixed sampling status; final groups may differ.
10. Test **Line width** on an eligible frame. Confirm the anchor and envelope,
   linked/independent curve behavior, and exact original-path restoration on Cancel.

11. Test Underline weight on words and characters. Switch to Underline offset,
    try negative/positive values, Cancel, and reapply with a smaller scope.
    Excluded text should recover its original automatic values and flags.
12. Highlight the middle of two paragraphs. Test all three Paragraph indent
    properties: complete touched paragraphs change; adjacent paragraphs do not.
    Confirm Paragraph/Both/Never are locked and the former structure returns
    when switching back to a character property. Test a narrower reapply and Undo.

13. Set Skew, then + Add property and choose Tracking. Confirm the Kept strip,
    exact retained skew, Undo addition, and Apply all. One Undo must remove both.
    Cancel must restore everything, including breaks, swatches and contours.
    Turn draft preview off and confirm only the kept effects remain visible.

14. Select an unthreaded rectangular frame and choose Line length - centered.
    Start with Allow added line breaks OFF: confirm text and paragraph counts
    remain unchanged while a centered contour is used. Turn it ON.
    Try Linear and Gaussian with Min 40/Max 100%, fixed steps and Custom. Wider rows should fit more words; each fitted row should be
    a paragraph with equal left/right indents. Cancel restores original returns.
    Apply and reapply a wider range without accumulating paragraph returns.
    Try existing paragraph spacing, a short passage and overset. Outgoing
    overset should keep its baseline. Keep Line length, add Tracking, and Undo
    the committed stack once. Manual text edits must prevent unsafe replacement.

15. Create two character styles with different explicit size/tracking/color
    values. Choose Character-style blend and select both. Check endpoints,
    midpoint, Gaussian/restart-per-word and attribute exclusions. Font families,
    on/off flags and source style definitions should stay unchanged. Try missing
    settings, automatic leading in the target, narrower reapply, metrics and a
    kept blend plus another property. Test compatible variable-font instances
    and exclude axes to use a different target font. Export/reopen IDML and
    reapply using the saved grouped endpoint names.

16. Reopen a treated frame. Confirm Saved setup loaded, exact restored controls,
    visible kept stages and preview off. Cancel must leave formatting, labels
    and Undo untouched. Edit source styles between openings; Reapply all must
    refresh the sequence from its original baseline with one Undo.
17. Try a saved highlighted range, another linked frame, edited text and a
    deleted endpoint. The owning frame/range should be clear and unsafe
    replacement blocked. Choose a replacement style or explicitly Forget.
18. Forget while a saved setup is loaded. Keep text, shape, breaks and metrics;
    Undo should restore metadata. New preview remains off. Try a one-sided
    skew/stroke, mixed original font sizes, inferred axes and Auto leading.

Other InDesign versions, Windows, complex-script shaping, and document-specific
composer behavior need additional verification. Sentence boundaries are heuristic,
and some layout-dependent parameter combinations cannot converge even with
the optional tracking-only fixed-break fallback.

## v8 UI, swatches and stroke follow-up

Focused checks for this follow-up, rather than repeating the full previous
294-assertion native matrix:

- 168 automated checks pass. New coverage includes average graph sampling with
  a two-character first word, single-group accuracy, one Preview checkbox, Both
  default, word blend percentages and mixed/hidden stroke-width restoration.
- 23 focused native assertions pass in disposable InDesign 2026 documents: hidden
  1 pt stroke behind None paint, switching stroked endpoints away, inherited
  widths, word percentages including spaces, generated names/grouping, unchanged
  endpoint placement, equivalent-color reuse, effective tint interpolation,
  zero tint-generated swatches, Cancel, cleanup protection and text-edit Undo.
- The native dialog was visually inspected with Average and Group graphs,
  character-style controls, one bottom Preview checkbox and Colors cleanup.
- The five-page guide was rebuilt by the current engine. All pages were rendered
  and visually reviewed. Only the intentional frame-scope comparison is overset.

Reproduced cause: None-painted text can store a nonzero stroke width. Assigning
style-blended paint exposed that hidden width. A paint-only blend now owns and
preserves the visible stroke baseline, keeping previously None-painted text at
zero width; explicit width attributes remain intentional. Removed attributes
restore the full original paint/width baseline.

Seven additional native IDML checks pass for tint endpoint name resolution,
reapply without intermediate colors, exact Cancel, and persistent generated-color
and group ownership labels.

## v8 stroke fallback follow-up

The original fallback repro produced two failures: zero plus unspecified stroke
width borrowed fill paint behind an original None/1 pt baseline; a zero-to-positive
width ramp assigned paint at its zero endpoint. Seven new automated checks cover
these cases, literal None endpoints, effective width, baseline restoration and
concise aligned dropdowns. The dependency-free suite passes 175 checks.

23 focused native stroke checks pass, including matching latent 0.64 pt widths
with no defined paint, explicit None, None-to-painted interpolation, inherited
positive outlines, attribute exclusions, replacement, Cancel and Undo. A read-only
inspection confirmed the same latent-width/no-paint pattern in the reported
styles. Paint inference is removed whenever both endpoint styles omit paint.

21 additional native UI assertions verify the 240 px primary dropdown widths,
aligned captions, text fit and concise scope/restart values. The dialog was
also reviewed visually in InDesign 2026.
