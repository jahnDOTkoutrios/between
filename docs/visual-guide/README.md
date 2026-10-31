# Fading, by degrees.

Three A2 pages, seventeen examples. The effects were applied in InDesign 2026 by the
actual Tracking Ramp v6 engine. Labels stay neutral so the text does the work.

[PDF](Tracking%20Ramp%20-%20Visual%20Guide.pdf) ·
[Editable INDD](Tracking%20Ramp%20-%20Visual%20Guide.indd) ·
[Interchange IDML](Tracking%20Ramp%20-%20Visual%20Guide.idml)

![Original specimens](preview.png)

![Underline and paragraph-indent specimens](preview-underlines.png)

![Centered line-length specimens](preview-line-length.png)

## Try it

Open the INDD or IDML. Expand **02 - Editable numbered specimens** in Layers.
Select a frame named **01…17 - … - EDIT ME**, then run `Tracking Ramp.jsx`.
Use the printed caption to recreate its settings. Keep **Replace previous effect**
on to replace the saved effect without accumulating values. To layer different
properties in one session, use **+ Add property**, then **Apply all**. Example 08A
is an actual kept Skew + Tracking stack. **Undo addition** returns the last kept
effect to editing; **Cancel** restores the whole session. Labels and rules are
on separate locked layers; metrics are on their own printable layer.

| No. | Example | Applied settings |
| --- | --- | --- |
| 01 | Longer text, tracking | Word; Linear; 0–180; Letters |
| 02 | Spaces only | Word; Linear; 0–850; Spaces |
| 03 | Justified line bells | Word; restart Line; Gaussian; 0–260; 5 pt metrics |
| 04 | Font-size bells | Character; restart Word; Gaussian; 14–48 pt |
| 05 | Baseline wave | Character; Sine; 0–14 pt; fixed 48 pt leading |
| 06 | Color reset | Word; restart Paragraph; Linear; Ink to Mist |
| 07 | Horizontal scale | Word; restart Sentence; Linear; 65–145% |
| 08 | Kept skew + tracking | Skew −20–20° Character, then Tracking 0–110 Word; separate Rotation −12–12° Sine |
| 09 | Weight and stroke | Word; variable Weight 800–100; Character stroke 0–1 pt |
| 10 | Frame contour | Centered, smooth; width 58–100%; independent Gaussian, bell width 29% |
| 11 | Live frame scope | Original vs Character tracking 0–100; Linear |
| 12 | Linked story | Frame; Linear; 0–140; Both; Entire story |
| 13 | Underline weight | Character Linear / Word Gaussian; 0.2–6 pt; Letters |
| 14 | Underline offset | Character Sine / Word Linear; −2–12 pt; weight held at 1 pt |
| 15 | Paragraph indents | Left/right 0–72 pt; first line −18–36 pt; four paragraphs |
| 16 | Longer line-length bell | Line length; Gaussian; centered 45–100%; added breaks ON |
| 17 | Shorter line-length ramp | Line length; Linear contour; centered 40–100%; added breaks OFF |

All examples use Auto steps. Indent samples use Paragraph/Both/Never, with
one value for each complete intersecting paragraph. Unless a caption specifies a restart group, the
curve runs once across the local scope. Semantic samples use Entire story;
03, 11, 16 and 17 use Current frame, and 12 uses Entire story across linked frames. Example 10 changes only frame width;
its faint contour is a guide rule. Example 11 intentionally has overset text:
the applied frame shows 213 characters versus 234 in the control, and outgoing
overset retains tracking 0. Example 12 is one continuous story in two frames.
Metrics remain tracking values even when another property is selected.

## Files and fonts

The INDD and IDML contain 25 uniquely named specimen frames with saved effect
history. The PDF has three 420 × 594 mm pages with live, selectable text. Arial,
Minion Pro, and Acumin Variable Concept were used; font files are not bundled.
Activate or substitute missing fonts before editing; substitution can reflow text.

[Build Visual Guide.jsx](Build%20Visual%20Guide.jsx) regenerates the pages with the
current repository engine. Keep it in this folder and run it from InDesign's
Scripts panel. It creates a new document, overwrites the guide INDD/IDML/PDF
beside the builder, and records `build-report.txt`. Render the PDF again to
refresh `preview.png` (page 1), `preview-underlines.png` (page 2), and `preview-line-length.png` (page 3). The builder needs the fonts listed above (or its listed
fallbacks), including a variable font with a Weight axis.

The export was visually reviewed. All seventeen example headings and twenty-five editable
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
