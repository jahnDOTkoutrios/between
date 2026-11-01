# Preview performance

This optimization pass, retained in v8, reduces native InDesign calls and avoids calculating each digit
while entering a numeric value. The composition solver and final sampling
rules are unchanged.

## V8 blend measurements

Native InDesign 2026, macOS; 500 words / 2,672 characters; same text/frame/fonts
and configurations in v7 and the measured development v8 source. Sizes blend
10-14 pt, tracking 0-30, baseline 0-2 pt, RGB Ink/Mist colors where selected.
Axis cases use Acumin Variable Concept Weight 100-800 plus its complete axis
vector. Metrics is off. Snapshot/dump validation runs outside the timed preview.

| Case | v7 | v8 | Reduction |
| --- | ---: | ---: | ---: |
| Numeric blend, Word | 821 ms | 580 ms | 29% |
| Numeric + color blend, Word | 1313 ms | 735 ms | 44% |
| 21 attributes, Word | 3999 ms | 1077 ms | 73% |
| Size + axes, Word | 33962 ms | 5167 ms | 85% |
| Size + axes, Character | 37540 ms | 27180 ms | 28% |
| Numeric + color, Current frame | 1989 ms | 1420 ms | 29% |
| Color blend + tracking stack | 4857 ms | 3462 ms | 29% |

First two: medians of three changed previews (including Undo between previews).
Other cases: one run each. Stack timing includes Keep plus the next draft. The
timed v8 source precedes final UI/IDML polish. Seven differential outputs match
text, units, sampled values and captured formatting for all 2,672 characters;
comparison resolves swatches by name to account for separate document IDs.

For the 21-attribute case, snapshot time fell from 3120 ms to 2 ms because the
uniform original story can be read as a native formatting run. Word axes write
through homogeneous ranges instead of individual characters. Character axes
still require thousands of distinct native writes and remain slow. These are
fixture measurements, not promised speedups on arbitrary documents.

## V8 implementation and safeguards

- Read uniform character-formatting runs, with coverage checks and the existing
  bulk/scalar fallback. Paragraph properties retain native-enumerator handling.
- Bulk leading/colors preserve Auto and Text Color tokens; swatch names and
  font-axis metadata are cached within a snapshot. Fixed selected scopes avoid
  unrelated text; live frame scope retains a full baseline for incoming text.
- Merge adjacent identical output without changing units, group sampling or
  outgoing tracking-gap eligibility. Use compatible native range axis writes;
  mixed/unresolved fonts keep the character fallback.
- Reuse exact numeric-only kept blend patches. Colors, axes, contours, text edits
  and stale signatures retain the complete safe replay path.
- Cache endpoint compilation during local UI edits; invalidate for endpoint,
  attribute/policy changes, Refresh styles, reopening and final Apply/Reapply.
- Saved setups open preview-off. The existing 350 ms typing delay and slider
  release policy remain. Full composition convergence/fallback limits and the
  explicit added-break policy are preserved.

## Earlier optimizations

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

The current regression suite passes 162 automated checks. The historical v5
performance verification passed 231 native assertions, and a focused slider
rerun passed eight. Historical v7 adds 150 native assertions; v8 passes 294, documented separately.
See [verification](VERIFICATION.md) for scope, platform limits and native
UI timing-test details.

Line length is a separate, opt-in composition path. It fits rows sequentially
and can recompose up to eight passes. The earlier timing table does not
benchmark this new property. Existing numeric/slider input delays also apply.

Style blending compiles endpoint values once per requested configuration and
batches numeric/color writes per unit. Intermediate color swatches are cached
with 65 levels; variable-font compatibility checks are cached per font instance
within an application pass. Kept blends retain their resolved endpoint values.
The historical v5 table does not benchmark style blends; the v8 table above does.
