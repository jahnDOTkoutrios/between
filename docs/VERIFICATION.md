# Verification

## Automated suite

`node tests/tracking-ramp.test.cjs` runs 61 dependency-free checks against the
actual script functions in a mocked document/ScriptUI host. Coverage includes:

- Letters/spaces/Both eligibility and outgoing tracking boundaries.
- Curve interpolation, bounded custom handles, bell symmetry, and step sampling.
- Snapshots, replacement baselines, Cancel, Undo grouping, and preview reuse.
- Numeric properties and variable-axis validation.
- Unit/restart grouping, including 108 combinations of units, groups, and targets.
- Partial selections, frame ownership, resulting-line convergence/cycle handling.
- Preview-group inspection without document mutations, smart-quote enumerators,
  cached graph invalidation, and inactive Clear tracking behavior.

## Native verification performed during development

118 checks passed in Adobe InDesign 2026 on macOS. These are development-time
native checks and are not run by the Node test command. They covered:

- Actual word-gap measurements and numeric property application/restoration.
- Variable-font axis ranges and intermediate fill/stroke colors.
- Rendered glyph outlines at high baseline shift, skew, rotation, and scale.
- Contour bounds, anchors, Cancel/Undo, independent curves, and story threading.
- Fully justified resulting-line values and grouped distributions across linked frames.
- Sentence counts with quotes, abbreviations, decimals, and Unicode punctuation.
- Dense 5 pt metrics overlays retaining every annotation without overset.
- Grouped typography after frame contour shaping.
- Native UI group inspection, curve dragging, metrics, and a committed Undo group.

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
   above the text and disappear when the preview is cancelled.
8. Test **Line width** on an eligible frame. Confirm the anchor and envelope,
   linked/independent curve behavior, and exact original-path restoration on Cancel.

Other InDesign versions, Windows, complex-script shaping, and document-specific
composer behavior need additional verification. Sentence boundaries are heuristic,
and some layout-dependent parameter combinations cannot converge.
