# Tracking Ramp

**Text Distribution Studio for Adobe InDesign — v7.0.0**

Apply tracking and other text properties along a curve, then repeat that curve
inside words, sentences, paragraphs, composed lines, or linked frames.
A standalone ExtendScript `.jsx` with a ScriptUI interface; no plugin build or
runtime dependencies are needed in InDesign.

## Visual guide

A minimal, four-page A2 visual guide with short and long fading-themed text,
20 labeled examples, and 28 named editable specimen frames. The second page
covers underline weight, underline offset, and paragraph indents. The third
page adds long and short Line length specimens; the fourth demonstrates
character-style blends with editable endpoint styles.

[View the PDF](docs/visual-guide/Tracking%20Ramp%20-%20Visual%20Guide.pdf) ·
[Download INDD](docs/visual-guide/Tracking%20Ramp%20-%20Visual%20Guide.indd) ·
[Download IDML](docs/visual-guide/Tracking%20Ramp%20-%20Visual%20Guide.idml) ·
[Explore the examples](docs/visual-guide/README.md)

[![Tracking Ramp visual guide: twelve typography and frame specimens](docs/visual-guide/preview.png)](docs/visual-guide/Tracking%20Ramp%20-%20Visual%20Guide.pdf)

<details>
<summary>Underlines and paragraph indents</summary>

![Underline and paragraph-indent specimens](docs/visual-guide/preview-underlines.png)

</details>

## Install and run

1. Download [Tracking Ramp.jsx](https://raw.githubusercontent.com/jahnDOTkoutrios/indesign-tracking-ramp/main/Tracking%20Ramp.jsx), or clone this repository.
2. In InDesign, open **Window → Utilities → Scripts**.
3. Right-click the **User** folder and choose **Reveal in Finder** / **Reveal in Explorer**. Copy `Tracking Ramp.jsx` into the Scripts Panel folder revealed there.
4. Select a text frame, highlight text, or place the text cursor inside a frame. Double-click **Tracking Ramp.jsx** in the Scripts panel.

Tested in **Adobe InDesign 2026 on macOS**. This is an ExtendScript `.jsx` script,
not a UXP `.idjs` plugin. Other InDesign versions and Windows are unverified.

## Choose the structure

| Control | Purpose | Choices |
| --- | --- | --- |
| Scope | Which text participates | Highlighted text, current frame, entire linked story |
| Values per | What receives one value | Character, word, sentence, paragraph, line, frame |
| Restart curve per | Where the complete curve starts again | Never, word, sentence, paragraph, line, frame |
| Change | Which characters are eligible | Letters, interword spaces, both |
| Preview group | Which group's samples appear in the graph | Inspect a group without changing the document |

**Min/Max, steps, and the curve are shared by all groups.** Each group receives
its own complete sampled distribution. To keep one continuous curve across
the scope, set **Restart curve per → Never**.

Examples:

- **Font size → Character → restart per Word → Gaussian:** each word gets a small → large → small pattern.
- **Tracking → Word → restart per Sentence:** tracking rises and falls across each sentence.
- **Tracking → Character → restart per Line:** the full curve repeats in every resulting line.
- **Baseline shift → Line → restart per Frame:** each linked frame gets its own rise-and-fall pattern.

## Features

- **Properties:** tracking, font size, baseline shift, variable-font axes, horizontal/vertical scale, character rotation, skew, character fill color/tint, text stroke width/color/tint, underline weight/offset, left/right/first-line paragraph indents, centered per-line length, and Character-style blend.
- **Curves:** linear, ease in/out, S-curve, Gaussian, sine, triangle, and custom draggable control points with shifted or multiple peaks.
- **Steps:** automatic per-group sampling or a shared fixed step limit capped to each group's length.
- **Responsive input:** numeric previews wait for a 350 ms typing pause; Apply uses the latest value immediately. Sliders update the graph during dragging and the document on release. Custom-curve document previews remain throttled.
- **Live preview and stacking:** adjust one property, click **+ Add property**, choose the next property, and continue. A read-only Kept strip and Undo addition appear for stacks. Apply all commits one named Undo transaction; Cancel restores the whole session.
- **Allow added line breaks:** separate from Auto-stabilize and off by default for every property. Enable it to permit managed tracking soft breaks or per-line paragraph breaks for Line length.
- **Auto-stabilize composition:** starts with exact resulting composition, then uses **Fixed sampling** when needed. Managed tracking breaks are tried only with explicit permission. Min/Max are not rescaled.
- **Line length — centered:** with added breaks off, preserve paragraphs and use a centered frame contour from top to bottom. With breaks on, fit each row with equal left/right indents and managed paragraph breaks. Switching modes restores owned whitespace/geometry; Cancel and Undo restore the starting state.
- **Frame contour:** minimum/maximum available width in %, pt, or mm; left/center/right anchoring; smooth or stepped sides; linked or independent curve.
- **Metrics:** printable, visible 5 pt overlays show integer tracking values centered in the gap below each text row. Tight leading may cause overlap; source leading is preserved.
- **Reapplication:** restores the previous saved baseline for a property before recalculating it. A separate Clear tracking option supports older effects.

## Blend two character styles

Choose **Character-style blend**, then **Style A** and **Style B**. Min/Max
become blend percentages (0 = A, 100 = B). The existing curve, value units and
restart controls drive every included attribute together. **Blend attributes…**
lets you exclude attributes and explains unsupported or missing values.

Shared supported values are automatic, including inherited values. Numeric
settings, compatible RGB/CMYK/Lab process colors and complete axes on the same
variable-font file can blend. Unspecified/automatic endpoints, spot colors,
gradients, font-family changes and discrete switches are preserved/skipped.
Source styles and character-style assignments remain untouched; results are
local formatting. Reapply rereads the styles; kept blends retain frozen values.

[![Character-style blend examples](docs/visual-guide/preview-style-blend.png)](docs/visual-guide/Tracking%20Ramp%20-%20Visual%20Guide.pdf)

## Preview performance

Historical optimization measurements in native InDesign 2026 on the same
500-word fixture (development v5 builds; the optimization is included in v7):

| Preview | Before | Updated v5 |
| --- | ---: | ---: |
| One property | 0.828 s | 0.556 s |
| Two-property stack | 2.507 s | 1.296 s |
| With tracking metrics | 12.368 s | 1.440 s |

Single/stack figures are medians of three previews; metrics is one run per
version. Formatting matched the baseline, including all 462 labels and their
positions. These are local measurements, not timing guarantees. See
[performance notes](docs/PERFORMANCE.md) for the method and safeguards.

<details>
<summary>Line length examples</summary>

![Centered line-length specimens](docs/visual-guide/preview-line-length.png)

</details>

## Important behavior

- Tracking **Letters** preserves the outgoing word gap, including the final glyph's tracking before a space. A single-letter word may have no internal tracking target.
- Units crossing a restart boundary are split into disjoint fragments. Groups with one unit receive the curve's starting value; a bell needs at least three sampled stages to show an interior peak.
- Sentence detection uses punctuation and common abbreviation/decimal handling. It is a heuristic; review ambiguous text.
- For character properties, Current frame scope continually resamples the final visible text. Text leaving the frame returns to its baseline; newly fitting text joins the distribution. Line/frame structures exclude overset. Semantic units can include overset in entire-story scope.
- **Auto-stabilize composition** is on by default; **Allow added line breaks** is off. With added breaks enabled, Tracking can insert real soft line breaks at word gaps using a conservative Max-tracking layout. Reapply replaces managed breaks; Cancel restores the text. If fixed sampling is needed, final lines/frames may differ from the sampled groups. Outgoing frame text returns to its baseline; newly fitting text may retain its baseline. Disable Auto-stabilize for strict convergence.
- Each property can appear once per stack. Kept values are frozen; Undo addition returns the last kept effect to editing and discards the current draft. A kept contour remains fixed while adding further properties. After manual text edits, disable Replace to adopt existing managed breaks as ordinary text.
- Underline properties enable underlining on eligible targets and preserve original automatic values for replacement/Cancel.
- Indents use whole intersecting paragraphs, including any continuation beyond the selected scope. Values per is Paragraph, Change is Both, and Restart is Never; previous structure choices return when selecting another property.
- Line length uses Current frame / Line / Both / Never. It requires one unthreaded rectangular frame with one ordinary column, equal insets, auto-sizing off and no frame transform. Automatic lists/drop caps are excluded. With added breaks on, it changes paragraph structure and paragraph-aware styles may repeat. With them off, the width curve follows frame height, so short text may use only part of it. Existing paragraph indents remain in the no-break mode.
- Frame contour shapes only the selected frame. It requires one ordinary column, equal insets, auto-sizing off, and an unrotated/unsheared frame at 100% scale.
- Baseline shift does not increase leading. Large scale, skew, rotation, or shift values can overlap text or extend beyond a frame.
- Multiple-frame selection, table cells, notes, text on paths, and grouped-frame selection are not supported.

See the [full user guide](docs/USER-GUIDE.txt) for property ranges, curve editing,
metrics, frame shaping, replacement behavior, and composition limits.

## Development and verification

Run the dependency-free regression suite with Node.js:

```sh
node tests/tracking-ramp.test.cjs
```

The suite was tested with Node.js v24.21.0 and passes **138 checks**. It evaluates
the actual script's functions using document and ScriptUI mocks; it does not
launch InDesign. An optional `TRACKING_RAMP_SOURCE` environment variable can
point it at another script file.

V7 passed **150 native assertions in InDesign 2026 on macOS**: 35 style-blend
checks, nine actual UI checks, 11 IDML roundtrip checks and 95 repeated
line-length/break-policy checks. Earlier coverage is recorded separately in the
[verification notes](docs/VERIFICATION.md). All four guide pages were rendered
and visually checked.

[Version notes](CHANGELOG.md)
