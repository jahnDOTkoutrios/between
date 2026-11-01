# Preview performance

This optimization pass, included in v7, reduces native InDesign calls and avoids calculating each digit
while entering a numeric value. The composition solver and final sampling
rules are unchanged.

## Changes

- Numeric fields use a 350 ms trailing delay, extended by each keystroke.
  Apply reads the latest fields immediately; Cancel discards queued work.
  The modal window continues processing typing and buttons during the wait.
- Slider movement updates the numeric field and graph locally; document
  composition and metrics run on release. Custom-curve movement leaves 250 ms
  after a completed preview before starting another, and defers metrics
  construction until release. Release always requests the final result.
- Word/line bounds and numeric snapshots use validated bulk native reads,
  with the original scalar path when the host cannot supply those columns.
- Kept numeric properties replay exact saved patches instead of recomputing
  their curves and composition. Replacement-restored ranges are included.
  Colors, variable axes, contours, text edits and stale text signatures use
  the complete replay path.
- Metrics batch paragraph properties and geometry reads. Both correction
  passes, 5 pt type, glyph-gap positioning and every eligible label remain.

## Historical native measurements (development v5 builds)

Adobe InDesign 2026 on macOS; 500 words, 2672 characters; all text fits.
The baseline is the immediately preceding v5 source. Both versions use the
same document fixture and settings. Single/stack results are medians of three
changed preview requests; metrics is one dense run per version. Measurements
exclude the new typing delay and include native preview/Undo work.

| Preview | Previous v5 | Updated v5 | Time reduction |
| --- | ---: | ---: | ---: |
| One property | 828 ms | 556 ms | 33% |
| Two-property stack | 2507 ms | 1296 ms | 48% |
| With tracking metrics | 12368 ms | 1440 ms | 88% |

Metrics construction itself fell from 11504 ms to 843 ms in these runs.
The fixture generates 462 eligible annotations: Letters tracking can exclude
single-letter words. All 462 labels matched exactly in text, size, x and y.
Source formatting, distribution values, unit boundaries, overlay bounds and
printability also matched the baseline.

These are local development measurements, not universal speed guarantees.
Long stories, justification, variable fonts and repeated composition passes
still cost time. Numeric input that pauses longer than 350 ms can preview an
intermediate value. The update does not reduce final curve accuracy, label
count or composition iteration limits to obtain these gains.

The current regression suite passes 138 automated checks. The historical v5
performance verification passed 231 native assertions, and a focused slider
rerun passed eight. V7 adds 150 native assertions, documented separately.
See [verification](VERIFICATION.md) for scope, platform limits and native
UI timing-test details.

Line length is a separate, opt-in composition path. It fits rows sequentially
and can recompose up to eight passes. The earlier timing table does not
benchmark this new property. Existing numeric/slider input delays also apply.

Style blending compiles endpoint values once per requested configuration and
batches numeric/color writes per unit. Intermediate color swatches are cached
with 65 levels; variable-font compatibility checks are cached per font instance
within an application pass. Kept blends retain their resolved endpoint values.
The historical timing table does not benchmark the new multi-attribute property.
