# Tracking Ramp

**Text Distribution Studio for Adobe InDesign — v5.0.0**

Apply tracking and other text properties along a curve, then repeat that curve
inside words, sentences, paragraphs, composed lines, or linked frames.
A standalone ExtendScript `.jsx` with a ScriptUI interface; no plugin build or
runtime dependencies are needed in InDesign.

## Visual guide

A minimal, one-page A2 specimen sheet with short and long fading-themed text,
12 labeled examples, and 16 named editable specimen frames.

[View the PDF](docs/visual-guide/Tracking%20Ramp%20-%20Visual%20Guide.pdf) ·
[Download INDD](docs/visual-guide/Tracking%20Ramp%20-%20Visual%20Guide.indd) ·
[Download IDML](docs/visual-guide/Tracking%20Ramp%20-%20Visual%20Guide.idml) ·
[Explore the examples](docs/visual-guide/README.md)

[![Tracking Ramp visual guide: twelve typography and frame specimens](docs/visual-guide/preview.png)](docs/visual-guide/Tracking%20Ramp%20-%20Visual%20Guide.pdf)

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

- **Properties:** tracking, font size, baseline shift, variable-font axes, horizontal/vertical scale, character rotation, skew, character fill color/tint, and text stroke width/color/tint.
- **Curves:** linear, ease in/out, S-curve, Gaussian, sine, triangle, and custom draggable control points with shifted or multiple peaks.
- **Steps:** automatic per-group sampling or a shared fixed step limit capped to each group's length.
- **Live preview:** changes appear in the actual document. Cancel restores the pre-preview state; Apply keeps one named Undo transaction.
- **Resulting composition:** frame scope follows text moving in or out in every unit mode. Line/frame groups recalculate against the final layout; tracking line curves can use managed soft line breaks if natural composition cycles.
- **Frame contour:** minimum/maximum available width in %, pt, or mm; left/center/right anchoring; smooth or stepped sides; linked or independent curve.
- **Metrics:** printable, visible 5 pt overlays show integer tracking values centered in the gap below each text row. Tight leading may cause overlap; source leading is preserved.
- **Reapplication:** restores the previous saved baseline for a property before recalculating it. A separate Clear tracking option supports older effects.

## Important behavior

- Tracking **Letters** preserves the outgoing word gap, including the final glyph's tracking before a space. A single-letter word may have no internal tracking target.
- Units crossing a restart boundary are split into disjoint fragments. Groups with one unit receive the curve's starting value; a bell needs at least three sampled stages to show an interior peak.
- Sentence detection uses punctuation and common abbreviation/decimal handling. It is a heuristic; review ambiguous text.
- Current frame scope continually resamples the final visible text. Text leaving the frame returns to its baseline; newly fitting text joins the distribution. Line/frame structures exclude overset. Semantic units can include overset in entire-story scope.
- **Fix line breaks** is on by default for tracking curves using Line units or Line restart groups. If natural composition cannot settle, it inserts real soft line breaks at word gaps using a conservative Max-tracking layout. Reapply replaces its managed breaks; Cancel restores the text. Other properties retain them. After manual text edits, disable Replace to adopt the current breaks as ordinary text.
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

The suite was tested with Node.js v24.21.0 and passes **74 checks**. It evaluates
the actual script's functions using document and ScriptUI mocks; it does not
launch InDesign. An optional `TRACKING_RAMP_SOURCE` environment variable can
point it at another script file.

The v5 implementation also passed **164 checks in native InDesign 2026 on macOS**
during development. See [verification notes](docs/VERIFICATION.md) for the
coverage and a manual smoke-test procedure.

[Version notes](CHANGELOG.md)
