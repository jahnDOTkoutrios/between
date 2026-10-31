# Verification

## Automated suite

`node tests/tracking-ramp.test.cjs` runs 94 dependency-free checks against the
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

## Native verification performed during development

225 checks passed in Adobe InDesign 2026 on macOS. These are development-time
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

## Manual smoke test

Use a disposable document for the checks below.

1. Create a text frame containing several sentences and words of different lengths.
2. Run the script. Choose **Font size**, **Values per → Character**,
   **Restart curve per → Word**, and **Gaussian bell**; choose at least three
   characters per test word. Confirm each word receives the complete pattern.
3. Change **Preview group**. Confirm only the graph/readout changes. Drag a point;
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
   with Auto-stabilize enabled and final values match each line. Cancel must
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

Other InDesign versions, Windows, complex-script shaping, and document-specific
composer behavior need additional verification. Sentence boundaries are heuristic,
and some layout-dependent parameter combinations cannot converge even with
the optional tracking-only fixed-break fallback.
