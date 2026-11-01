# Changelog

## 7.0.0

- Add Character-style blend with Style A/B selectors and a 0-100% blend range. Apply multiple supported attributes together using existing curves, steps, units and restart groups.
- Automatically resolve shared numeric values, inherited character-style values, compatible process colors and complete variable-font axes. Optional Blend attributes checkboxes select a subset and show skipped values.
- Support 22 attribute types: size, tracking, absolute leading, baseline, scales, rotation/skew, fill/stroke tints and colors, underline/strikethrough dimensions/tints/colors, and variable-font axes.
- Preserve source styles, character-style assignment, font families and discrete on/off settings. Intermediate results are local overrides; a fresh reapply reads the current style definitions.
- Use short-path rotation and a bounded 65-level color cache with exact endpoint/midpoint samples. Preserve existing color-property sampling outside style blends.
- Match variable fonts by file and axis definitions so named instances can blend. Reject incompatible target fonts atomically; axes can be excluded to use other numeric attributes.
- Preserve outgoing tracking gaps in Letters mode while other attributes cover complete letters. Excluded tracking boundaries are not claimed in replacement history.
- Restore automatic leading, automatic Text Color tokens, all previous attributes outside narrower targets, and frozen kept blends with one Cancel/Undo transaction.
- Resolve grouped style names across IDML ID changes. Keep numeric input delay, slider release updates and the default-off added-break policy.
- Extend the minimal visual guide to four A2 pages, 20 examples and 28 named editable frames, with editable endpoint styles and three style-blend specimens.

## 6.0.0

Consolidates the additions originally shipped after the initial v5 release.
The initial v5 features remain listed under 5.0.0 below.

- Separate Allow added line breaks from Auto-stabilize; default new drafts to off. Tracking can use Fixed sampling without inserting soft breaks.
- Let Line length preserve paragraphs with a centered frame contour when breaks are off, or use managed per-line paragraph indents when enabled. Switching modes restores owned whitespace/geometry before applying the new mode.
- Update the application title and Undo action to Tracking Ramp 6 while retaining compatible saved effect metadata.
- Update the visual guide with an explicit breaks-on / breaks-off comparison.

- Add Line length — centered: percentage widths per fitted row, equal left/right indents, and managed paragraph breaks. Keep original paragraph boundaries and spacing at their outer edges.
- Preserve text indices by replacing owned whitespace; restore and refit on replacement, and retain cross-property histories through managed tracking breaks.
- Support curves, steps, stacking, printable metrics, Cancel and a single Undo. Restrict the first pass to one ordinary unthreaded rectangular frame.
- Extend the minimal editable visual guide to three A2 pages, adding long Gaussian and short linear line-length examples.

- Debounce numeric previews until typing pauses for 350 ms; keep Apply immediate and discard pending work on Cancel.
- Update slider fields and graphs during dragging; defer document composition and metrics to release. Throttle custom-curve previews from calculation completion and rebuild metrics on curve release.
- Batch native text/metrics reads and writes, retaining scalar fallbacks and both annotation correction passes.
- Replay exact patches for safe kept numeric properties; retain full replay for colors, axes, contours, text edits, and stale content signatures.
- Verify unchanged formatting and annotation positions against the previous v5, with native preview benchmarks.

- Add + Add property, a read-only Kept strip, Undo addition, and Apply all. Freeze kept numeric formatting and commit the whole stack as one Undo action; Cancel restores the entire session.
- Prevent duplicate properties in a stack and preserve kept colors, contours, and managed break ownership during replay.
- Add default Auto-stabilize: exact composition first, optional managed tracking breaks when permitted, then labeled Fixed sampling without rescaling Min/Max. Frozen assignments remove the line-boundary redistribution feedback loop.
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

## 5.0.0

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
