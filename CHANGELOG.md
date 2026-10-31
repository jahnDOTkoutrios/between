# Changelog

## 5.0.0

Additional features and fixes published without changing the version number:

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
