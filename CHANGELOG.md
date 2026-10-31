# Changelog

## 5.0.0

Additional features and fixes published without changing the version number:

- Debounce numeric previews until typing pauses for 350 ms; keep Apply immediate and discard pending work on Cancel.
- Throttle curve/slider previews from calculation completion; rebuild metrics on curve release.
- Batch native text/metrics reads and writes, retaining scalar fallbacks and both annotation correction passes.
- Replay exact patches for safe kept numeric properties; retain full replay for colors, axes, contours, text edits, and stale content signatures.
- Verify unchanged formatting and annotation positions against the previous v5, with native preview benchmarks.

- Add + Add property, a read-only Kept strip, Undo addition, and Apply all. Freeze kept numeric formatting and commit the whole stack as one Undo action; Cancel restores the entire session.
- Prevent duplicate properties in a stack and preserve kept colors, contours, and managed break ownership during replay.
- Add default Auto-stabilize: exact composition first, managed tracking breaks next, then labeled Fixed sampling without rescaling Min/Max. Frozen assignments remove the line-boundary redistribution feedback loop.
- Keep outgoing frame text and its clear-first baseline intact when trimming fallback targets.

- Add underline weight and offset with automatic activation, fractional values, saved automatic baselines, and shared activation preservation during replacement.
- Add paragraph left, right and first-line indents. Treat intersecting paragraphs atomically; preserve whole-paragraph baselines for partial selection, reapply, Cancel and Undo.
- Resolve native paragraph objects before storing their scalar story indices.
- Extend the minimal editable visual guide to two A2 pages with underline and indent specimens.

- Make metrics visible and printable; center 5 pt labels in the glyph gap below each line, including tight leading without changing it.
- Correct accumulating annotation drift and verify printed/PDF labels.
- Adapt current-frame scope to the final visible range in all unit modes, including zero-first tracking and text entering or leaving the frame.
- Accept exact effective tracking convergence even when line geometry changes; improve cycle diagnostics.
- Add optional managed soft line breaks when tracking Line units or Line restart curves cycle. Cancel/reapply and other property histories account for inserted/removed breaks.

Initial v5 features:

- Separate value units from curve restart groups.
- Add sentence, paragraph, and frame units; restart within words, sentences, paragraphs, lines, or frames.
- Sample each group's curve independently, with a preview-group inspector.
- Recompose when either units or restart groups depend on resulting lines/frames.
- Normalize visible InDesign special-character punctuation, including smart quotes, before sentence grouping and targeting.
- Format and position the complete metrics story so initially overset annotations are retained.
- Ignore Clear tracking when text-property application is disabled.

## 4.0.0

- Frame-width contours with linked or independent curves.
- Character fill color and tint.
- Native curve-editor repaint improvements.
- Faster preview reads and reuse of identical previews.

## 3.0.0

- Live document preview with Cancel restoration.
- Draggable custom curves and tracking metrics.
- Additional text properties and variable-font axes.
- Resulting-line composition and saved per-property replacement baselines.

## 2.0.0

- Word, line, and character distributions; spaces targeting; curve presets and steps.

## 1.0.0

- Initial tracking ramp prototype with Min/Max controls.
