# Preview performance

This v5 update reduces native InDesign calls and avoids calculating each digit
while entering a numeric value. The composition solver and final sampling
rules are unchanged.

## Changes

- Numeric fields use a 350 ms trailing delay, extended by each keystroke.
  Apply reads the latest fields immediately; Cancel discards queued work.
  The modal window continues processing typing and buttons during the wait.
- Curve and slider movement leave 250 ms after a completed preview before
  starting another. Release always requests the final result. Curve dragging
  defers metrics construction until release.
- Word/line bounds and numeric snapshots use validated bulk native reads,
  with the original scalar path when the host cannot supply those columns.
- Kept numeric properties replay exact saved patches instead of recomputing
  their curves and composition. Replacement-restored ranges are included.
  Colors, variable axes, contours, text edits and stale text signatures use
  the complete replay path.
- Metrics batch paragraph properties and geometry reads. Both correction
  passes, 5 pt type, glyph-gap positioning and every eligible label remain.

## Native measurements

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

The regression suite passes 104 automated checks and 231 native assertions.
See [verification](VERIFICATION.md) for scope, platform limits and native
UI timing-test details.
