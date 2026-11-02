# Fading, by degrees.

Five A2 pages, twenty-three examples. The effects were applied in InDesign 2026 by the
actual Tracking Ramp v8 engine. Labels stay neutral so the text does the work.

[PDF](Tracking%20Ramp%20-%20Visual%20Guide.pdf) ·
[Editable INDD](Tracking%20Ramp%20-%20Visual%20Guide.indd) ·
[Interchange IDML](Tracking%20Ramp%20-%20Visual%20Guide.idml)

![Original specimens](preview.png)

![Underline and paragraph-indent specimens](preview-underlines.png)

![Centered line-length specimens](preview-line-length.png)

![Character-style blend specimens](preview-style-blend.png)

![Original endpoints and saved setups](preview-saved-setups.png)

## Try it

Open the INDD or IDML. Expand **02 - Editable numbered specimens** in Layers.
Select a frame named **01…23 - … - EDIT ME**, then run `Tracking Ramp.jsx`.
Saved setup loaded recalls its controls with preview off. Use Preview/Reapply
when ready, or use the printed caption to recreate its settings. Keep **Replace previous effect**
on for fresh drafts. A recalled setup restores its whole stack baseline.
Forget saved setup keeps its appearance and stops recall with a separate Undo. To layer different
properties in one session, use **+ Add property**, then **Apply all**. Examples 08A and 23
are actual saved two-property stacks. **Undo addition** returns the last kept
effect to editing; **Cancel** restores the whole session. Labels and rules are
on separate locked layers; metrics are on their own printable layer.

| No. | Example | Applied settings |
| --- | --- | --- |
| 01 | Longer text, tracking | Word; Linear; 0–180; letters and spaces |
| 02 | Stepped tracking | Word; Ease out; 0–260; 4 steps; letters and spaces |
| 03 | Justified line bells | Word; restart Line; Gaussian; 0–260; 5 pt metrics |
| 04 | Font-size bells | Character; restart Word; Gaussian; 14–48 pt |
| 05 | Baseline wave | Character; Sine; 0–14 pt; fixed 48 pt leading |
| 06 | Color reset | Word; restart Paragraph; Linear; Ink to Ink 30% tint; no intermediate swatches |
| 07 | Horizontal scale | Word; restart Sentence; Linear; 65–145% |
| 08 | Kept skew + tracking | Skew −20–20° Character, then Tracking 0–110 Word; separate Rotation −12–12° Sine |
| 09 | Weight and stroke | Word; variable Weight 800–100; Character stroke 0–1 pt |
| 10 | Frame contour | Centered, smooth; width 58–100%; independent Gaussian, bell width 29% |
| 11 | Live frame scope | Original vs Character tracking 0–100; Linear |
| 12 | Linked story | Frame; Linear; 0–140; Both; Entire story |
| 13 | Underline weight | Character Linear / Word Gaussian; 0.2–6 pt; letters and spaces |
| 14 | Underline offset | Character Sine / Word Linear; −2–12 pt; weight held at 1 pt |
| 15 | Paragraph indents | Left/right 0–72 pt; first line −18–36 pt; four paragraphs |
| 16 | Longer line-length bell | Line length; Gaussian; centered 45–100%; added breaks ON |
| 17 | Shorter line-length ramp | Line length; Linear contour; centered 40–100%; added breaks OFF |
| 18 | Long character-style blend | Word; Linear; 0–100%; size 14–30 pt, tracking 0–160, shift 0–6 pt, Ink–Mist |
| 19 | Blend inside each word | Character; restart Word; Gaussian; 32–72 pt, tracking 0–160, Ink–Mist; baseline excluded |
| 20 | Variable-font style endpoints | Word; Linear inverted; 40–24 pt and Weight 800–100; compatible variable font |
| 21 | One-sided skew and stroke | Word; Linear; Original text; skew 0–24° and stroke 0–2 pt from None paint |
| 22 | Mixed original sizes | Word; Linear; original 24/18 pt to 30 pt, skew to 18°; both-missing attributes unchanged |
| 23 | Remember a full stack | Word; character-style blend A–B, then Tracking 0–80; complete setup saved |

All examples use Auto steps except 02 (four steps). Letters and internal spaces are included. Indent samples use Paragraph/Never, with
one value for each complete intersecting paragraph. Unless a caption specifies a restart group, the
curve runs once across the local scope. Semantic samples use Entire story;
03, 11, 16 and 17 use Current frame, and 12 uses Entire story across linked frames. Example 10 changes only frame width;
its faint contour is a guide rule. Example 11 intentionally has overset text:
outgoing overset retains tracking 0. Example 12 is one continuous story in two frames.
Metrics remain tracking values even when another property is selected.

## Files and fonts

The INDD and IDML contain 31 uniquely named specimen frames with saved effect
history. The PDF has five 420 × 594 mm pages with live, selectable text. Arial,
Minion Pro, and Acumin Variable Concept were used; font files are not bundled.
Activate or substitute missing fonts before editing; substitution can reflow text.

[Build Visual Guide.jsx](Build%20Visual%20Guide.jsx) regenerates the pages with the
current repository engine. Keep it in this folder and run it from InDesign's
Scripts panel. It creates a new document, overwrites the guide INDD/IDML/PDF
beside the builder, and records `build-report.txt`. Render the PDF again to
refresh `preview.png` (page 1), `preview-underlines.png` (page 2), `preview-line-length.png` (page 3), `preview-style-blend.png` (page 4), and `preview-saved-setups.png` (page 5). The builder needs the fonts listed above (or its listed
fallbacks), including a variable font with a Weight axis.

The export was visually reviewed. All twenty-three example headings and thirty-one editable
specimen names were verified; no unintended text is overset. The two frame-scope
comparison stories intentionally extend beyond their frames. This specimen is a
visual guide, not an exhaustive compatibility test.

Auto-stabilize is enabled in the examples. Allow added line breaks is off
by default, with explicit opt-in for 03 and 16. Fixed sampling keeps assigned
values as text reflows when an exact composition cannot settle.

Example 16 fits each row before creating managed paragraph returns and equal
left/right indents. Replace restores owned whitespace before refitting;
original paragraph returns remain. Paragraph-aware styles may repeat.
Example 17 keeps its original paragraph and uses a centered frame contour;
the faint outline shows the shape. Its curve follows frame height, so short
text can use only part of the curve. Cancel and Undo restore text and geometry
in both modes. Both require one ordinary unthreaded rectangular frame.

Examples 18-20 use Character-style blend. Their editable endpoints are in
Character Styles > Guide blends. Example 18 resolves four inherited/shared
attributes; 19 selects only size, tracking and color; 20 blends size and complete
variable-font axes together. Font families, on/off switches and source styles
are preserved. Intermediate results are local overrides, and grouped endpoint
names survive an IDML roundtrip. Blend attributes reports skipped values and
lets you exclude supported attributes. Keep Replace on to restore the previous
baseline before rereading changed endpoint styles.

Every treated specimen stores a v8 setup in its story, owned by its frame.
The linked story in 12 is owned by 12A; selecting 12B explains which frame to
use. The untreated 11A control has no setup. There are 29 owning setups across
31 frames. All 29 reopen/reapply from the exported IDML, with exact Cancel
restoration; metrics and original named colors survive the roundtrip.

Examples 21-22 use the Guide blends styles Original A/Original B. Their inferred
endpoints come from pre-effect text and are labeled in Blend attributes. The
group contains ten editable endpoint/base styles. Example 23 recalls both
properties; Undo addition returns its kept blend to editing. Edit its A/B styles
between openings, then Reapply all to refresh the entire sequence.

Graph defaults to an average of actual normalized samples across restart groups.
Restart → Keywords accepts a comma-separated list such as `restart, now`.
Choose After keyword to start the next curve on the following word, or At keyword
to start it on the matching word. Scope start always begins a curve; matching
ignores capitalization and surrounding punctuation. Values per still determines
the units inside each group. Keyword settings are recalled with saved setups.
Choose Group to inspect one word without changing the page. Generated colors
are in the collapsible Tracking Ramp group; original guide endpoints stay outside.
Colors... provides safe grouping and unused-generated-color cleanup. Same-base
tint sample 06 creates no intermediate colors. One bottom Preview checkbox
controls document preview.

**Noise…** adds repeatable variation to these examples without changing the
base curve. It starts Off. Random gives independent samples, Smooth gives
gradual variation and Fractal layers several scales. Choose Property values,
Words per restart (Restart → Word), or both. For example, Every 4 words with
Amount 50% varies groups from 2 to 6 words; values stay inside Min/Max. The seed
and targets are recalled with the frame's setup. Set updates the main preview;
Cancel discards panel edits. Each kept property can use its own noise setup.

For a reflow pattern, use example 03's Restart → Line, then choose
**Line sampling → Fixed** in Composition, Apply, and change the frame width.
Formatting stays with the originally sampled text as new lines form.
**Resample lines** replaces the sample at the current width after restoring the
active property's baseline. It turns Preview on; Cancel restores the old sample.
Reopening and Reapply preserve fixed sampling, including sampled overset text.
Newly visible text outside the sample keeps its baseline until resampling.
Fixed mode adds no breaks. Follow layout remains the default.

**Pattern offset** under Distribution shifts the sampled values through
the text, even for tint/color properties that leave composition unchanged.
Try 0, 0.5, 1 and -1 with Values per Character or Word and Restart → Line.
Values cross the original line boundaries and wrap at the sample's ends.
Fractions interpolate adjacent values; zero restores the exact source pattern.
The slider updates the document on release. Saved setups remember the offset;
Resample replaces the source at the current width while retaining that offset.

Pattern offset now sits under Distribution and also works with Word, Sentence,
Paragraph, Frame, Keywords and Never restarts, and with Follow layout. Dragging
snaps to whole units; type fractions for smooth intermediate animation frames.

For drifting bands without resizing the final text block, choose Character,
Restart Line and Fixed sampling. Sample width starts at 100%; try 75–125% with
Linear, Invert and Tint 10–100%. Release the slider to sample new lines at the
virtual width; the final frame returns to its original dimensions. Curve and
offset edits keep that sample. Resample uses the saved percentage of the current
frame width. Narrow sampling retains the original visible tail; overset is excluded.
