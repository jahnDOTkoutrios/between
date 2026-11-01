#target "indesign"

/* Tracking Ramp 8.0.0 — ExtendScript / ScriptUI, no dependencies.
 * Target collection, distribution, and application are separate deliberately:
 * stable snapshots feed character/word/sentence/paragraph/line/frame units,
 * then each restart group receives its own complete curve distribution.
 */
(function () {
    var TITLE = "Tracking Ramp 8";
    // Preserve compatible v3/v4/v5/v6/v7 effect baselines when applying v8.
    var HISTORY_KEY = "TrackingRamp.v3.history";
    var TOKEN_KEY = "TrackingRamp.v3.preview";
    var COLOR_KEY = "TrackingRamp.v8.generatedColor";
    var COLOR_GROUP_KEY = "TrackingRamp.v8.colorGroup";
    var LOW = -1000;
    var HIGH = 10000;

    function typeName(object) {
        try { return object.constructor.name; } catch (_) { return ""; }
    }

    function fail(message) { throw new Error(message); }

    function boundsOf(text) {
        if (!text.characters.length) { return null; }
        return {
            start: text.characters.firstItem().index,
            end: text.characters.lastItem().index
        };
    }

    function visibleBounds(frame) {
        var lines = frame.lines, count = lines.length;
        if (!count) { return null; }
        var first = boundsOf(lines.firstItem()), last = boundsOf(lines.lastItem());
        if (first && last) { return { start: first.start, end: last.end }; }
        // Empty edge lines are uncommon; retain the complete fallback.
        var start = null, end = null;
        for (var i = 0; i < count; i++) {
            var bounds = boundsOf(lines.item(i));
            if (bounds) { if (start === null) { start = bounds.start; } end = bounds.end; }
        }
        return start === null ? null : { start: start, end: end };
    }

    function collectionBounds(collection) {
        var count = collection.length, starts, ends, result = [];
        if (!count) { return result; }
        try {
            starts = collection.everyItem().characters.firstItem().index;
            ends = collection.everyItem().characters.lastItem().index;
            if (count === 1 && typeof starts === "number" && typeof ends === "number") { starts = [starts]; ends = [ends]; }
            if (!(starts instanceof Array) || !(ends instanceof Array) || starts.length !== count || ends.length !== count) { throw new Error("No scalar bounds column"); }
            for (var i = 0; i < count; i++) {
                if (typeof starts[i] !== "number" || typeof ends[i] !== "number" || !isFinite(starts[i]) || !isFinite(ends[i]) || starts[i] > ends[i]) { throw new Error("Unresolved bounds"); }
                result.push({ start: starts[i], end: ends[i] });
            }
            return result;
        } catch (_) {
            result = [];
            for (var k = 0; k < count; k++) { result.push(boundsOf(collection.item(k))); }
            return result;
        }
    }

    function assertMainStoryText(text) {
        // Cell/footnote indices are local to their own text, not story indices.
        var parent = text;
        for (var i = 0; parent && i < 20; i++) {
            var kind = typeName(parent);
            if (kind === "Story" || kind === "TextFrame") { return; }
            if (kind === "Cell" || kind === "Footnote" || kind === "Endnote" ||
                    kind === "Note" || kind === "TextPath") {
                fail("Tracking Ramp supports ordinary text frames. Table cells, notes, and text on paths are not supported yet.");
            }
            try { parent = parent.parent; } catch (_) { break; }
        }
        fail("Select ordinary text in a text frame.");
    }

    function resolveTarget() {
        if (!app.documents.length) { fail("Open a document first."); }
        if (app.selection.length !== 1) {
            fail("Select one text frame, highlight some text, or place the text cursor in a frame.");
        }
        var selected = app.selection[0];
        var kind = typeName(selected);
        var frame = null;
        var selectionBounds = null;
        var story;
        if (kind === "TextFrame") {
            frame = selected;
            story = frame.parentStory;
        } else {
            var accepted = /^(Text|Word|Character|Paragraph|Line|TextStyleRange|InsertionPoint)$/;
            if (!accepted.test(kind)) { fail("Select a text frame or text with the Type tool."); }
            assertMainStoryText(selected);
            story = selected.parentStory;
            if (kind !== "InsertionPoint") { selectionBounds = boundsOf(selected); }
            if (selected.parentTextFrames.length) {
                frame = selected.parentTextFrames[0];
                if (typeName(frame) !== "TextFrame") { fail("Text on a path is not supported yet."); }
            }
        }
        story.recompose();
        var scopes = [];
        if (selectionBounds) {
            scopes.push({ label: "Highlighted text", kind: "selection", bounds: selectionBounds });
        }
        if (frame) {
            var frameBounds = visibleBounds(frame);
            if (frameBounds) {
                scopes.push({ label: "Current frame (live composition)", kind: "frame", bounds: frameBounds });
            }
        }
        var storyBounds = boundsOf(story);
        if (storyBounds) {
            scopes.push({ label: "Entire story (all linked frames + overset)", kind: "story", bounds: storyBounds });
        }
        if (!scopes.length) { fail("There is no text to process."); }
        return { story: story, frame: frame, document: app.activeDocument, scopes: scopes };
    }

    var specialText = null;
    function normalizeContents(value) {
        if (typeof value === "string") { return value; }
        if (value instanceof Array) { return value.join(""); }
        if (specialText === null) {
            specialText = {};
            var characters = { DOUBLE_LEFT_QUOTE: "\u201c", DOUBLE_RIGHT_QUOTE: "\u201d", SINGLE_LEFT_QUOTE: "\u2018", SINGLE_RIGHT_QUOTE: "\u2019",
                SINGLE_STRAIGHT_QUOTE: "'", DOUBLE_STRAIGHT_QUOTE: "\"", ELLIPSIS_CHARACTER: "\u2026", EM_DASH: "\u2014", EN_DASH: "\u2013",
                NONBREAKING_HYPHEN: "\u2011", COPYRIGHT_SYMBOL: "\u00a9", DEGREE_SYMBOL: "\u00b0", REGISTERED_TRADEMARK: "\u00ae",
                TRADEMARK_SYMBOL: "\u2122", BULLET_CHARACTER: "\u2022", PARAGRAPH_SYMBOL: "\u00b6", SECTION_SYMBOL: "\u00a7",
                ARABIC_COMMA: "\u060c", ARABIC_SEMICOLON: "\u061b", ARABIC_QUESTION_MARK: "\u061f", HEBREW_MAQAF: "\u05be",
                HEBREW_GERESH: "\u05f3", HEBREW_GERSHAYIM: "\u05f4", HEBREW_SOF_PASUK: "\u05c3" };
            if (typeof SpecialCharacters !== "undefined") {
                for (var name in characters) {
                    try { var item = SpecialCharacters[name]; if (item !== undefined) { specialText[String(item)] = characters[name]; specialText[String(Number(item))] = characters[name]; } } catch (_) {}
                }
            }
        }
        var key = String(value);
        return specialText.hasOwnProperty(key) ? specialText[key] : value;
    }

    function contentKind(value) {
        value = normalizeContents(value);
        if (value instanceof Array) { value = value.join(""); }
        if (typeof value === "string") {
            if (/^[ \u00a0\u2000-\u200a\u202f\u205f\u3000]+$/.test(value)) { return "space"; }
            if (/\s/.test(value) || /^[\x00-\x1f\x7f\u00ad\u200b-\u200f\u2028-\u202e\u2060\ufeff\ufffc]$/.test(value)) {
                return "break";
            }
            return value.length ? "text" : "break";
        }
        // Some typographic spaces are returned as enumerators, not strings.
        var names = ["EM_SPACE", "EN_SPACE", "FLUSH_SPACE", "HAIR_SPACE", "NONBREAKING_SPACE",
            "THIN_SPACE", "FIGURE_SPACE", "PUNCTUATION_SPACE", "THIRD_SPACE", "QUARTER_SPACE",
            "SIXTH_SPACE", "FIXED_WIDTH_NONBREAKING_SPACE"];
        if (typeof SpecialCharacters !== "undefined") {
            for (var i = 0; i < names.length; i++) {
                try { if (value == SpecialCharacters[names[i]]) { return "space"; } } catch (_) {}
            }
        }
        return "break"; // Anchored objects, tabs and control markers are never targets.
    }

    function capture(story, bounds) {
        var range = story.characters.itemByRange(bounds.start, bounds.end);
        // itemByRange can resolve as one Text span; expand its characters
        // explicitly to obtain one scalar contents/index pair per character.
        var objects = null, allContents = null;
        try { allContents = range.characters.everyItem().contents; } catch (_) {}
        if (!(allContents instanceof Array) || allContents.length !== bounds.end - bounds.start + 1) { allContents = null; objects = range.characters.everyItem().getElements(); }
        var data = { bounds: bounds, characters: [], words: [], lines: [], frames: [], after: null };
        if (bounds.end + 1 < story.characters.length) { data.after = contentKind(story.characters.item(bounds.end + 1).contents); }
        var i, span;
        for (i = 0; i < (allContents ? allContents.length : objects.length); i++) {
            var content = normalizeContents(allContents ? allContents[i] : objects[i].contents);
            data.characters.push({ index: bounds.start + i, kind: contentKind(content), text: typeof content === "string" ? content : "" });
        }
        var words = collectionBounds(range.words);
        for (i = 0; i < words.length; i++) {
            span = words[i];
            if (span) { data.words.push({ start: Math.max(bounds.start, span.start), end: Math.min(bounds.end, span.end) }); }
        }
        // Story.lines can expose overset lines. Frame-owned lines describe
        // the actual composition visible in the story's text containers.
        var containers = story.textContainers;
        for (var f = 0; f < containers.length; f++) {
            if (typeName(containers[f]) !== "TextFrame") { continue; }
            var lines = collectionBounds(containers[f].lines), frameStart = null, frameEnd = null;
            for (i = 0; i < lines.length; i++) {
                span = lines[i];
                if (span && span.end >= bounds.start && span.start <= bounds.end) {
                    data.lines.push({ start: Math.max(bounds.start, span.start), end: Math.min(bounds.end, span.end) });
                    if (frameStart === null) { frameStart = Math.max(bounds.start, span.start); } frameEnd = Math.min(bounds.end, span.end);
                }
            }
            if (frameStart !== null) { data.frames.push({ start: frameStart, end: frameEnd, id: containers[f].id }); }
        }
        data.frames.sort(function (a, b) { return a.start - b.start; });
        data.lines.sort(function (a, b) { return a.start - b.start; });
        return data;
    }

    function runsIn(data, span, kind, interwordOnly) {
        var runs = [];
        var start = null;
        var previous = null;
        var chars = data.characters;
        // Character indices are contiguous in a captured ordinary story range.
        var first = Math.max(0, span.start - data.bounds.start);
        var last = Math.min(chars.length - 1, span.end - data.bounds.start);
        for (var i = first; i <= last + 1; i++) {
            var item = i <= last ? chars[i] : null;
            if (item && item.kind === kind && (previous === null || item.index === previous + 1)) {
                if (start === null) { start = item.index; }
                previous = item.index;
            } else {
                if (start !== null) {
                    var left = start - data.bounds.start - 1;
                    var right = previous - data.bounds.start + 1;
                    if (!interwordOnly || (left >= first && right <= last &&
                            chars[left].kind === "text" && chars[right].kind === "text")) {
                        runs.push({ start: start, end: previous });
                    }
                }
                start = previous = null;
                if (item && item.kind === kind) { start = previous = item.index; }
            }
        }
        return runs;
    }

    function paragraphSpans(data) {
        var result = [], start = data.bounds.start, chars = data.characters;
        for (var i = 0; i < chars.length; i++) {
            if (chars[i].text === "\r" || chars[i].text === "\u2029") {
                result.push({ start: start, end: chars[i].index }); start = chars[i].index + 1;
            }
        }
        if (start <= data.bounds.end) { result.push({ start: start, end: data.bounds.end }); }
        return result;
    }
    function sentenceSpans(data) {
        // A deliberately small, deterministic punctuation segmenter. Native
        // character indices stay intact, including non-BMP character contents.
        var paragraphs = paragraphSpans(data), result = [], chars = data.characters, origin = data.bounds.start;
        var terminals = /^[.!?\u2026\u3002\uff01\uff1f\u061f]$/;
        var closers = /^[.!?\u2026\u3002\uff01\uff1f\u061f"'\u2019\u201d\u00bb\u300d\u300f)\]}]$/;
        function textAt(index) { return index >= 0 && index < chars.length ? chars[index].text || "" : ""; }
        function gap(index) { return chars[index].kind === "space" || /^\s+$/.test(textAt(index)); }
        for (var p = 0; p < paragraphs.length; p++) {
            var first = paragraphs[p].start - origin, last = paragraphs[p].end - origin, start = first;
            for (var i = first; i <= last; i++) {
                var ch = textAt(i); if (!terminals.test(ch)) { continue; }
                if (ch === ".") {
                    if (/^\d$/.test(textAt(i - 1)) && /^\d$/.test(textAt(i + 1))) { continue; }
                    var token = ".", b = i - 1;
                    while (b >= first && !gap(b) && i - b < 40) { token = textAt(b) + token; b--; }
                    token = token.replace(/^["'\u2018\u201c\u00ab([{]+/, "");
                    if (/^(?:mr|mrs|ms|dr|prof|sr|jr|st|mt|vs|etc|e\.g|i\.e|fig|no|nr|bzw|ca|z\.b)\.$/i.test(token) ||
                            /^[A-Za-z]\.$/.test(token) || /^(?:[A-Za-z]\.){2,}$/.test(token)) { continue; }
                }
                var end = i;
                while (end + 1 <= last && closers.test(textAt(end + 1))) { end++; }
                var eastAsian = /^[\u3002\uff01\uff1f]$/.test(ch);
                if (end < last && !gap(end + 1) && !eastAsian) { i = end; continue; }
                while (end + 1 <= last && gap(end + 1)) { end++; }
                result.push({ start: origin + start, end: origin + end }); start = end + 1; i = end;
            }
            if (start <= last) { result.push({ start: origin + start, end: origin + last }); }
        }
        return result;
    }
    function structureSpans(data, kind, includeWordGap) {
        var spans;
        if (!kind || kind === "never") { return [{ start: data.bounds.start, end: data.bounds.end }]; }
        if (kind === "word") { spans = data.words; }
        else if (kind === "line") { spans = data.lines; }
        else if (kind === "frame") { spans = data.frames || []; }
        else if (kind === "paragraph") { if (!data.paragraphs) { data.paragraphs = paragraphSpans(data); } spans = data.paragraphs; }
        else if (kind === "sentence") { if (!data.sentences) { data.sentences = sentenceSpans(data); } spans = data.sentences; }
        else { fail("Unknown text structure: " + kind); }
        var result = [];
        for (var i = 0; i < spans.length; i++) {
            var end = spans[i].end;
            if (includeWordGap && kind === "word") { end = i + 1 < spans.length ? spans[i + 1].start - 1 : data.bounds.end; }
            result.push({ start: Math.max(data.bounds.start, spans[i].start), end: Math.min(data.bounds.end, end), id: spans[i].id });
        }
        return result;
    }
    function usesComposition(settings) {
        return /^(line|frame)$/.test(settings.mode) || /^(line|frame)$/.test(settings.restart || "never");
    }

    function isParagraphProperty(id) { return /^(leftIndent|rightIndent|firstLineIndent)$/.test(id); }
    function effectiveSettings(settings) {
        if (!isParagraphProperty(settings.property) && settings.property !== "lineLength") { return settings; }
        var copy = {}; for (var key in settings) { copy[key] = settings[key]; }
        copy.mode = settings.property === "lineLength" ? "line" : "paragraph"; copy.restart = "never"; copy.target = "both";
        return copy;
    }
    function captureEffect(story, bounds, settings) {
        var data = capture(story, bounds);
        if (isParagraphProperty(settings.property)) {
            data.wholeParagraphs = [];
            var paragraphs = story.characters.itemByRange(bounds.start, bounds.end).paragraphs.everyItem().getElements();
            for (var i = 0; i < paragraphs.length; i++) {
                var span = boundsOf(paragraphs[i]); if (span) { data.wholeParagraphs.push(span); }
            }
        }
        return data;
    }
    function collectUnits(data, settings) {
        if (isParagraphProperty(settings.property)) {
            var paragraphs = data.wholeParagraphs || paragraphSpans(data), paragraphUnits = [];
            for (var p = 0; p < paragraphs.length; p++) { paragraphUnits.push({ spans: [{ start: paragraphs[p].start, end: paragraphs[p].end }] }); }
            return paragraphUnits;
        }
        var units = [], chars = data.characters, eligibleSpaces = {}, i, j;
        var gaps = runsIn(data, data.bounds, "space", true);
        for (i = 0; i < gaps.length; i++) {
            for (j = gaps[i].start; j <= gaps[i].end; j++) { eligibleSpaces[j] = true; }
        }
        function spansFor(span) {
            var spans = [], start = null, previous = null;
            var first = Math.max(0, span.start - data.bounds.start);
            var last = Math.min(chars.length - 1, span.end - data.bounds.start);
            for (var k = first; k <= last + 1; k++) {
                var ch = k <= last ? chars[k] : null;
                var allowed = false;
                if (ch) {
                    allowed = ch.kind === "text" && settings.target !== "spaces";
                    if (ch.kind === "space" && settings.target !== "letters" && eligibleSpaces[ch.index]) {
                        allowed = true;
                        if (settings.mode === "line") {
                            // Exclude spaces at the final composed line edge.
                            var a = k, z = k;
                            while (a > first && chars[a - 1].kind === "space") { a--; }
                            while (z < last && chars[z + 1].kind === "space") { z++; }
                            allowed = a > first && z < last;
                        }
                    }
                    if (allowed && settings.target === "letters" &&
                            (!settings.property || settings.property === "tracking")) {
                        var nextKind = k + 1 < chars.length ? chars[k + 1].kind : data.after;
                        // Tracking on a word's last glyph changes the outgoing
                        // gap even when the space itself still has tracking 0.
                        if (nextKind === "space") { allowed = false; }
                    }
                }
                if (allowed) {
                    if (start === null) { start = ch.index; }
                    previous = ch.index;
                } else if (start !== null) {
                    spans.push({ start: start, end: previous }); start = previous = null;
                }
            }
            return spans;
        }
        if (settings.mode === "character") {
            var all = spansFor(data.bounds);
            for (i = 0; i < all.length; i++) {
                for (j = all[i].start; j <= all[i].end; j++) { units.push({ spans: [{ start: j, end: j }] }); }
            }
        } else if (settings.mode === "word" && settings.target === "spaces") {
            for (i = 0; i < gaps.length; i++) { units.push({ spans: [gaps[i]] }); }
        } else {
            var groups = structureSpans(data, settings.mode || "word", false);
            for (i = 0; i < groups.length; i++) {
                var end = groups[i].end;
                if (settings.mode === "word" && settings.target === "both" && i + 1 < groups.length) {
                    end = Math.min(data.bounds.end, groups[i + 1].start - 1);
                }
                var spans = spansFor({ start: groups[i].start, end: end });
                if (spans.length) { units.push({ spans: spans }); }
            }
        }
        return units;
    }

    function customValue(t, points, smooth) {
        if (!points || points.length < 2) { return t; }
        var i = 0;
        while (i + 1 < points.length - 1 && t > points[i + 1].x) { i++; }
        var a = points[i], b = points[i + 1], width = b.x - a.x;
        if (width <= 0) { return a.y; }
        var u = Math.max(0, Math.min(1, (t - a.x) / width));
        if (!smooth) { return a.y + (b.y - a.y) * u; }
        function slope(index) {
            if (index === 0) { return (points[1].y - points[0].y) / (points[1].x - points[0].x); }
            if (index === points.length - 1) { return (points[index].y - points[index - 1].y) / (points[index].x - points[index - 1].x); }
            var left = (points[index].y - points[index - 1].y) / (points[index].x - points[index - 1].x);
            var right = (points[index + 1].y - points[index].y) / (points[index + 1].x - points[index].x);
            if (left * right <= 0) { return 0; }
            return 2 * left * right / (left + right);
        }
        var u2 = u * u, u3 = u2 * u;
        return Math.max(0, Math.min(1, (2 * u3 - 3 * u2 + 1) * a.y +
            (u3 - 2 * u2 + u) * width * slope(i) + (-2 * u3 + 3 * u2) * b.y +
            (u3 - u2) * width * slope(i + 1)));
    }

    function curveValue(t, settings) {
        var curve = settings.curve;
        var power = settings.power || 2;
        var value;
        if (curve === "custom") { value = customValue(t, settings.points, settings.smooth); }
        else if (curve === "linear") { value = t; }
        else if (curve === "ease-in") { value = Math.pow(t, power); }
        else if (curve === "ease-out") { value = 1 - Math.pow(1 - t, power); }
        else if (curve === "smooth") { value = t * t * (3 - 2 * t); }
        else if (curve === "gaussian") {
            var width = (settings.width || 22) / 100;
            var edge = Math.exp(-0.5 * Math.pow(0.5 / width, 2));
            value = (Math.exp(-0.5 * Math.pow((t - 0.5) / width, 2)) - edge) / (1 - edge);
        } else if (curve === "sine") { value = Math.sin(Math.PI * t); }
        else if (curve === "triangle") { value = 1 - Math.abs(2 * t - 1); }
        else { fail("Unknown curve: " + curve); }
        return Math.max(0, Math.min(1, value));
    }

    function isBell(curve) { return /^(gaussian|sine|triangle)$/.test(curve); }

    function buildDistribution(count, settings) {
        var steps = settings.steps === 0 ? count : Math.min(count, settings.steps);
        var weights = [], peak = 0, levels = [], values = [];
        var i, weight;
        for (i = 0; i < steps; i++) {
            weight = curveValue(steps > 1 ? i / (steps - 1) : 0, settings);
            // Remove sine's floating-point residue at its endpoint.
            if (isBell(settings.curve) && (i === 0 || i === steps - 1)) { weight = 0; }
            weights.push(weight);
            peak = Math.max(peak, weight);
        }
        for (i = 0; i < steps; i++) {
            weight = weights[i];
            // Sample normalization gives exact Max at both middle samples for
            // even-sized bells. Two endpoints alone cannot represent a peak.
            if (isBell(settings.curve) && peak > 0) { weight /= peak; }
            if (settings.invert) { weight = 1 - weight; }
            var raw = settings.min + (settings.max - settings.min) * weight;
            var precision = !settings.property || settings.property === "tracking" ? 1 : 1000;
            levels.push(Math.round(raw * precision) / precision);
        }
        for (i = 0; i < count; i++) {
            // Center the stage buckets. Mirror the right half to resolve exact
            // bucket-boundary ties symmetrically, keeping bells centered.
            var bucket = Math.floor((i + 0.5) * steps / count);
            if (i > (count - 1) / 2) {
                bucket = steps - 1 - Math.floor((count - i - 0.5) * steps / count);
            }
            values.push(levels[Math.max(0, Math.min(steps - 1, bucket))]);
        }
        return { steps: steps, levels: levels, values: values };
    }

    function parseNumber(input, min, max, integer) {
        var text = String(input).replace(/^\s+|\s+$/g, "");
        if (!(integer ? /^[+-]?\d+$/ : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/).test(text)) { return null; }
        var number = Number(text);
        return !isFinite(number) || number < min || number > max ? null : number;
    }

    // Small JSON codec for ExtendScript hosts without a built-in JSON object.
    // Document labels are parsed as data; they are never evaluated as code.
    function encode(value) {
        if (value === null || typeof value === "undefined") { return "null"; }
        if (typeof value === "number") { return isFinite(value) ? String(value) : "null"; }
        if (typeof value === "boolean") { return value ? "true" : "false"; }
        if (typeof value === "string") {
            return '"' + value.replace(/[\\"\x00-\x1f]/g, function (c) {
                var escapes = { '"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
                if (escapes[c]) { return escapes[c]; }
                return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
            }) + '"';
        }
        var values = [], i;
        if (value instanceof Array) {
            for (i = 0; i < value.length; i++) { values.push(encode(value[i])); }
            return "[" + values.join(",") + "]";
        }
        for (i in value) { if (value.hasOwnProperty(i)) { values.push(encode(String(i)) + ":" + encode(value[i])); } }
        return "{" + values.join(",") + "}";
    }
    function decode(text) {
        var position = 0;
        function whitespace() { while (/\s/.test(text.charAt(position)) && position < text.length) { position++; } }
        function read(depth) {
            if (depth > 80) { fail("Effect history is too deeply nested."); }
            whitespace(); var c = text.charAt(position), value, key;
            if (c === '"') {
                position++; value = "";
                while (position < text.length) {
                    c = text.charAt(position++);
                    if (c === '"') { return value; }
                    if (c === "\\") {
                        c = text.charAt(position++);
                        if (c === "u") {
                            var hex = text.substr(position, 4);
                            if (!/^[0-9a-fA-F]{4}$/.test(hex)) { fail("Invalid effect history."); }
                            value += String.fromCharCode(parseInt(hex, 16)); position += 4;
                        } else {
                            var map = { '"': '"', "\\": "\\", "/": "/", n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
                            if (!map.hasOwnProperty(c)) { fail("Invalid history escape."); } value += map[c];
                        }
                    } else { if (c.charCodeAt(0) < 32) { fail("Invalid history string."); } value += c; }
                }
            } else if (c === "[" || c === "{") {
                var array = c === "["; value = array ? [] : {}; position++; whitespace();
                if (text.charAt(position) === (array ? "]" : "}")) { position++; return value; }
                while (position < text.length) {
                    if (array) { value.push(read(depth + 1)); }
                    else {
                        key = read(depth + 1); whitespace();
                        if (typeof key !== "string" || /^(?:__proto__|constructor|prototype)$/.test(key) || text.charAt(position++) !== ":") { fail("Invalid history key."); }
                        value[key] = read(depth + 1);
                    }
                    whitespace(); c = text.charAt(position++);
                    if (c === (array ? "]" : "}")) { return value; }
                    if (c !== ",") { fail("Invalid history separator."); }
                }
            } else {
                var rest = text.substring(position), match = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(rest);
                if (match) {
                    position += match[0].length;
                    if (match[0] === "true") { return true; }
                    if (match[0] === "false") { return false; }
                    if (match[0] === "null") { return null; }
                    return Number(match[0]);
                }
            }
            fail("Cannot read saved effect history.");
        }
        if (text.length > 12000000) { fail("Saved effect history is too large."); }
        var result = read(0); whitespace(); if (position !== text.length) { fail("Invalid trailing history data."); }
        return result;
    }
    function signature(story) {
        var text = String(story.contents), hash = 2166136261;
        for (var i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) | 0;
        }
        return story.characters.length + ":" + hash;
    }
    function documentOf(story) {
        var parent = story;
        for (var i = 0; parent && i < 10; i++) {
            if (typeName(parent) === "Document") { return parent; }
            parent = parent.parent;
        }
        return app.activeDocument;
    }
    function axisInfo(font) {
        var axes = [];
        try {
            var count = font.numDesignAxes;
            if (!count) { return axes; }
            var names = font.designAxesName, ranges = font.designAxesRange;
            if (typeof names === "string") { names = [names]; }
            if (typeof ranges[0] === "number") { ranges = [ranges]; }
            for (var i = 0; i < count; i++) {
                axes.push({ name: String(names[i]), index: i, min: Number(ranges[i][0]), max: Number(ranges[i][1]) });
            }
        } catch (_) {}
        return axes;
    }
    function styleBlendRegistry() {
        return [
            {id:"pointSize",label:"Font size",low:.1,high:1296}, {id:"tracking",label:"Tracking",low:-1000,high:10000,integer:true},
            {id:"leading",label:"Leading (absolute)",low:.1,high:1296}, {id:"baselineShift",label:"Baseline shift",low:-1000,high:1000},
            {id:"horizontalScale",label:"Horizontal scale",low:1,high:1000}, {id:"verticalScale",label:"Vertical scale",low:1,high:1000},
            {id:"characterRotation",label:"Character rotation",low:-360,high:360,angle:true}, {id:"skew",label:"Skew",low:-85,high:85},
            {id:"fillTint",label:"Character tint",low:0,high:100}, {id:"strokeWeight",label:"Stroke width",low:0,high:100},
            {id:"strokeTint",label:"Stroke tint",low:0,high:100}, {id:"underlineWeight",label:"Underline weight",low:0,high:100},
            {id:"underlineOffset",label:"Underline offset",low:-1000,high:1000}, {id:"underlineTint",label:"Underline tint",low:0,high:100},
            {id:"strikeThroughWeight",label:"Strikethrough weight",low:0,high:100}, {id:"strikeThroughOffset",label:"Strikethrough offset",low:-1000,high:1000},
            {id:"strikeThroughTint",label:"Strikethrough tint",low:0,high:100},
            {id:"fillColor",label:"Character color",kind:"color"}, {id:"strokeColor",label:"Stroke color",kind:"color"},
            {id:"underlineColor",label:"Underline color",kind:"color"}, {id:"strikeThroughColor",label:"Strikethrough color",kind:"color"},
            {id:"designAxes",label:"Variable-font axes",kind:"axes"}
        ];
    }
    function stylePath(style) {
        var parts = [String(style.name)], parent = style.parent;
        while (parent && typeName(parent) === "CharacterStyleGroup") { parts.unshift(String(parent.name)); parent = parent.parent; }
        return parts.join(" / ");
    }
    function characterStyleList(doc) {
        var result = [], styles = doc.allCharacterStyles || [], noneID = null;
        try { noneID = doc.characterStyles.item(0).id; } catch (_) {}
        for (var i = 0; i < styles.length; i++) {
            if (styles[i].isValid !== false && styles[i].id !== noneID) { result.push(styles[i]); }
        }
        return result;
    }
    function findBlendStyle(doc, id, name) {
        var styles = doc.allCharacterStyles || [], named = null;
        for (var i = 0; i < styles.length; i++) {
            var path = stylePath(styles[i]);
            if (styles[i].id === id && (!name || path === name)) { return styles[i]; }
            if (name && path === name) { named = styles[i]; }
        }
        if (named) { return named; }
        fail("Choose two available character styles. A saved style may have been renamed or deleted.");
    }
    function missingStyleValue(value) {
        if (value === undefined || value === null || value === "") { return true; }
        try { if (value == NothingEnum.NOTHING) { return true; } } catch (_) {}
        return false;
    }
    function styleValue(style, property, doc) {
        var visited = {};
        for (var depth = 0; style && depth < 100; depth++) {
            if (visited[style.id]) { fail("Character-style inheritance contains a cycle."); } visited[style.id] = true;
            var value; try { value = style[property]; } catch (_) { value = null; }
            if (!missingStyleValue(value)) { return value; }
            var parent; try { parent = style.basedOn; } catch (_) { return null; }
            if (!parent || missingStyleValue(parent)) { return null; }
            if (typeof parent === "string") { try { parent = findBlendStyle(doc, null, parent); } catch (_) { return null; } }
            if (parent.isValid === false) { return null; } style = parent;
        }
        return null;
    }
    function styleInheritance(style, doc) {
        var names=[],visited={},noneID=null;try{noneID=doc.characterStyles.item(0).id;}catch(_){}
        for(var depth=0;style&&depth<100;depth++){
            var parent;try{parent=style.basedOn;}catch(_){break;}
            if(!parent||missingStyleValue(parent)){break;}if(typeof parent==="string"){try{parent=findBlendStyle(doc,null,parent);}catch(_){break;}}
            if(parent.isValid===false||parent.id===noneID||visited[parent.id]){break;}visited[parent.id]=true;names.push(stylePath(parent));style=parent;
        }
        return names;
    }
    function numericStyleValue(value, info) {
        return typeof value === "number" && isFinite(value) && value >= info.low && value <= info.high;
    }
    function processStyleColor(value) {
        try {
            if (!value || value.isValid === false || value.model != ColorModel.PROCESS) { return null; }
            var channels = value.colorValue, result = [];
            if (!channels || (channels.length !== 3 && channels.length !== 4)) { return null; }
            for (var i = 0; i < channels.length; i++) { if (typeof channels[i] !== "number" || !isFinite(channels[i])) { return null; } result.push(channels[i]); }
            var base=null,tint=100;try{base=value.baseColor;if(base&&base.isValid){tint=Number(value.tintValue);}}catch(_){}
            return {id:value.id,name:String(value.name),space:Number(value.space),channels:result,baseID:base?base.id:value.id,tint:tint};
        } catch (_) { return null; }
    }
    function blendFontIdentity(font) {
        var location = "", family = "";
        try { location = String(font.location || ""); family = String(font.fontFamily || ""); } catch (_) {}
        return location ? location + "|" + family + "|" + encode(axisInfo(font)) : String(font.name);
    }
    function styleFont(style, doc) {
        var font = styleValue(style, "appliedFont", doc);
        if (typeof font === "string") {
            try { var face = styleValue(style, "fontStyle", doc), candidate = app.fonts.itemByName(font + (face ? "\t" + face : "")); if (candidate.isValid) { font = candidate; } } catch (_) {}
        }
        return font && typeof font !== "string" && font.isValid !== false ? font : null;
    }
    function compileStyleBlend(doc, settings) {
        var a = findBlendStyle(doc, settings.styleA, settings.styleAName), b = findBlendStyle(doc, settings.styleB, settings.styleBName);
        var registry = styleBlendRegistry(), attrs = [], available = [], ignored = [], excluded = [], selected = settings.styleAttributes, useOriginal = settings.missingStyle === "original";
        function enabled(id) { if (selected === undefined || selected === null) { return true; } for (var n = 0; n < selected.length; n++) { if (selected[n] === id) { return true; } } return false; }
        for (var i = 0; i < registry.length; i++) {
            var info = registry[i], av = styleValue(a, info.id, doc), bv = styleValue(b, info.id, doc), attr = null;
            if (missingStyleValue(av) && missingStyleValue(bv)) { continue; }
            if (info.kind === "color") {
                var ac = processStyleColor(av), bc = processStyleColor(bv);
                if (useOriginal && ((ac && missingStyleValue(bv)) || (bc && missingStyleValue(av)))) { attr = {id:info.id,label:info.label,kind:"color",a:ac,b:bc,originalA:!ac,originalB:!bc}; }
                else if (ac && bc && ac.space === bc.space && ac.channels.length === bc.channels.length) { attr = {id:info.id,label:info.label,kind:"color",a:ac,b:bc}; }
                else { ignored.push(info.label + ": requires two process colors in the same color space"); }
            } else if (info.kind === "axes") {
                var am=missingStyleValue(av)||(av && av.length===0),bm=missingStyleValue(bv)||(bv && bv.length===0);
                if(am&&bm){continue;}
                var af=styleFont(a,doc),bf=styleFont(b,doc),originalAxes=useOriginal && am!==bm;
                var axisFont=originalAxes?(am?bf:af):af,axes=axisFont?axisInfo(axisFont):[],valid=axisFont&&axes.length;
                if(af&&bf&&blendFontIdentity(af)!==blendFontIdentity(bf)){valid=false;}
                if(!originalAxes && (!af||!bf||am||bm)){valid=false;}
                var aa=am?null:[],ba=bm?null:[];
                try{valid=valid && (am?originalAxes:av.length===axes.length) && (bm?originalAxes:bv.length===axes.length);}catch(_){valid=false;}
                if(valid){for(var ax=0;ax<axes.length;ax++){
                    if((!am&&!numericStyleValue(av[ax],{low:axes[ax].min,high:axes[ax].max})) || (!bm&&!numericStyleValue(bv[ax],{low:axes[ax].min,high:axes[ax].max}))){valid=false;break;}
                    if(!am){aa.push(av[ax]);}if(!bm){ba.push(bv[ax]);}
                }}
                if(valid){attr={id:info.id,label:info.label,kind:"axes",a:aa,b:ba,originalA:am,originalB:bm,font:String(axisFont.name),fontKey:blendFontIdentity(axisFont),axes:axes};}
                else{ignored.push(info.label+": requires complete axes on the same variable font");}
            } else if (useOriginal && ((numericStyleValue(av, info) && missingStyleValue(bv)) || (numericStyleValue(bv, info) && missingStyleValue(av)))) {
                attr = {id:info.id,label:info.label,kind:"number",a:missingStyleValue(av)?null:av,b:missingStyleValue(bv)?null:bv,
                    originalA:missingStyleValue(av),originalB:missingStyleValue(bv),integer:!!info.integer,angle:!!info.angle};
            } else if (numericStyleValue(av, info) && numericStyleValue(bv, info)) {
                attr = {id:info.id,label:info.label,kind:"number",a:av,b:bv,integer:!!info.integer,angle:!!info.angle};
            } else { ignored.push(info.label + ": missing, automatic, or outside the supported range"); }
            if (attr) { if (attr.originalA || attr.originalB) { attr.label += " (" + (attr.originalA ? "A" : "B") + ": original text)"; } available.push({id:attr.id,label:attr.label}); if (enabled(attr.id)) { attrs.push(attr); } else { excluded.push(attr.label); } }
        }
        if (useOriginal && enabled("strokeColor") && missingStyleValue(styleValue(a,"strokeColor",doc)) && missingStyleValue(styleValue(b,"strokeColor",doc))) {
            for (var si=0;si<attrs.length;si++) { if(attrs[si].id==="strokeWeight") {
                var paint={id:"strokeColor",label:"Stroke color (original text / fill)",kind:"color",a:null,b:null,originalA:true,originalB:true,strokePaint:true};
                attrs.push(paint);available.push({id:paint.id,label:paint.label});break;
            } }
        }
        if (!attrs.length) { fail(available.length ? "Select at least one blend attribute." : "These styles have no shared supported blend attributes. Define numeric values or compatible colors in both styles."); }
        return {version:1,styleA:stylePath(a),styleB:stylePath(b),inheritanceA:styleInheritance(a,doc),inheritanceB:styleInheritance(b,doc),attributes:attrs,available:available,ignored:ignored,excluded:excluded};
    }
    function blendDefinitionProperties(definition) {
        if (!definition || definition.version !== 1 || !definition.attributes || !definition.attributes.length) { fail("Choose character styles for the blend."); }
        var registry = styleBlendRegistry(), result = [], seen = {};
        for (var i = 0; i < definition.attributes.length; i++) {
            var attr = definition.attributes[i], valid = false;
            for (var j = 0; j < registry.length; j++) { if (registry[j].id === attr.id && (registry[j].kind || "number") === attr.kind) { valid = true; break; } }
            if (!valid || seen[attr.id]) { fail("Unsupported or repeated style-blend attribute."); } seen[attr.id] = true;
            if (attr.kind === "number" && ((!attr.originalA && !numericStyleValue(attr.a, registry[j])) || (!attr.originalB && !numericStyleValue(attr.b, registry[j])))) { fail("Invalid numeric style-blend endpoint."); }
            if (attr.kind === "axes" && (!attr.axes || !attr.axes.length || (!attr.originalA && (!attr.a || attr.a.length !== attr.axes.length)) || (!attr.originalB && (!attr.b || attr.b.length !== attr.axes.length)))) { fail("Invalid variable-font blend endpoints."); }
            result.push(attr.id);
        }
        // Paint and width/tint are coupled in InDesign. Own their baselines even
        // when a source style defines paint alone, so replacement is reversible.
        if(seen.strokeColor && !seen.strokeWeight){result.push("strokeWeight");}
        var tintProps={fillColor:"fillTint",strokeColor:"strokeTint",underlineColor:"underlineTint",strikeThroughColor:"strikeThroughTint"};
        for(var paintID in tintProps){if(seen[paintID]&&!seen[tintProps[paintID]]){result.push(tintProps[paintID]);}}
        return result;
    }
    function prepareStyleBlend(settings, doc) {
        if (!settings || settings.property !== "styleBlend") { return settings; }
        if (typeof settings.min !== "number" || typeof settings.max !== "number" || !isFinite(settings.min) || !isFinite(settings.max) || settings.min < 0 || settings.max > 100 || settings.min > settings.max) { fail("Style blend Min/Max must be percentages from 0 to 100, with Min no greater than Max."); }
        var result = {}; for (var key in settings) { result[key] = settings[key]; }
        result.blendDefinition = settings.blendDefinition || compileStyleBlend(doc, settings);
        result.styleAName = result.blendDefinition.styleA; result.styleBName = result.blendDefinition.styleB;
        blendDefinitionProperties(result.blendDefinition); return result;
    }
    function styleBlendNumber(attr, percent) {
        var t = Math.max(0, Math.min(1, percent / 100)), delta = attr.b - attr.a, value;
        if (t === 0) { value = attr.a; } else if (t === 1) { value = attr.b; }
        else { if (attr.angle) { delta = ((delta % 360) + 540) % 360 - 180; } value = attr.a + delta * t; }
        if (attr.angle) { while (value > 360) { value -= 360; } while (value < -360) { value += 360; } }
        return attr.integer ? Math.round(value) : Math.round(value * 1000) / 1000;
    }
    function blendNextKind(plan, index) {
        var offset = index + 1 - plan.data.bounds.start;
        return offset < plan.data.characters.length ? plan.data.characters[offset].kind : plan.data.after;
    }
    function styleTrackingSpans(plan, span) {
        var spans = [], start = null;
        for (var i = span.start; i <= span.end + 1; i++) {
            if (i <= span.end && blendNextKind(plan, i) !== "space") { if (start === null) { start = i; } }
            else if (start !== null) { spans.push({start:start,end:i-1}); start = null; }
        }
        return spans;
    }
    function blendBaselineRow(rows, index) {
        var low=0,high=rows.length-1;
        while(low<=high){var middle=Math.floor((low+high)/2),r=rows[middle];if(index<r.start){high=middle-1;}else if(index>r.end){low=middle+1;}else{return r;}}
        fail("The original text baseline is unavailable for this blend. Reapply from its saved setup.");
    }
    function originalBlendEndpoint(attr, row, story, index, doc, peer) {
        var value=row.values[attr.id];
        if(attr.kind==="color") {
            var paint=null;
            if(value && value.swatch!==undefined){paint=processStyleColor(doc.swatches.itemByID(value.swatch));}
            if(!paint && (attr.strokePaint || (value && value.nativeColorString))){paint=processStyleColor(story.characters.item(index).fillColor);}
            if(!paint && attr.id==="strokeColor"){paint=peer;}
            if(!paint){fail("Original "+attr.label+" is not a compatible process color. Define it in both styles or use Missing values: Skip.");}
            return paint;
        }
        if(attr.kind==="axes"){
            if(!value || value.length!==attr.axes.length){fail("Original variable-font axes are unavailable. Use the endpoint variable font or exclude axes.");}
            var vector=[];for(var ax=0;ax<attr.axes.length;ax++){if(!numericStyleValue(value[ax],{low:attr.axes[ax].min,high:attr.axes[ax].max})){fail("Original variable-font axes are incompatible with the endpoint.");}vector.push(value[ax]);}return vector;
        }
        if(attr.id==="leading" && value && value.automaticLeading){var ch=story.characters.item(index);value=Number(ch.pointSize)*Number(ch.autoLeading)/100;}
        var registry=styleBlendRegistry();for(var i=0;i<registry.length;i++){if(registry[i].id===attr.id && numericStyleValue(value,registry[i])){return value;}}
        fail("Original "+attr.label+" is automatic or unsupported. Define a numeric value in both styles or use Missing values: Skip.");
    }
    function applyStyleBlend(story, plan, doc) {
        var attrs=plan.settings.blendDefinition.attributes,cache={},fontKeys={},hasOriginal=false,pending=null,hasStrokePaint=false,hasStrokeWeight=false,paletteCache={};
        for(var ai=0;ai<attrs.length;ai++){if(attrs[ai].originalA||attrs[ai].originalB||attrs[ai].kind==="color"){hasOriginal=true;}if(attrs[ai].id==="strokeColor"){hasStrokePaint=true;}if(attrs[ai].id==="strokeWeight"){hasStrokeWeight=true;}}
        function fontKey(font){var name="font:"+String(font.name);if(!fontKeys.hasOwnProperty(name)){fontKeys[name]=blendFontIdentity(font);}return fontKeys[name];}
        function axesOn(range,attr,amount){
            var uniform=null;try{uniform=range.appliedFont;if(uniform instanceof Array){uniform=uniform.length===1?uniform[0]:null;}if(!uniform || !uniform.name){uniform=null;}}catch(_){}
            if(uniform && typeof range.setNthDesignAxis==="function"){
                if(fontKey(uniform)!==(attr.fontKey||attr.font)){fail("Variable-axis blending requires target text from the same variable-font file as "+attr.font+". Exclude Variable-font axes to use another font.");}
                for(var a=0;a<attr.axes.length;a++){range.setNthDesignAxis(attr.axes[a].index,attr.a[a]+(attr.b[a]-attr.a[a])*amount/100);}return;
            }
            var chars=range.characters.everyItem().getElements();
            for(var c=0;c<chars.length;c++){
                if(fontKey(chars[c].appliedFont)!==(attr.fontKey||attr.font)){fail("Variable-axis blending requires target text from the same variable-font file as "+attr.font+". Exclude Variable-font axes to use another font.");}
                for(var a=0;a<attr.axes.length;a++){chars[c].setNthDesignAxis(attr.axes[a].index,attr.a[a]+(attr.b[a]-attr.a[a])*amount/100);}
            }
        }
        function flush(){
            if(!pending){return;}var range=story.characters.itemByRange(pending.start,pending.end),hasValues=false;
            for(var p in pending.values){hasValues=true;break;}if(hasValues){range.properties=pending.values;if(pending.values.strokeWeight!==undefined){range.strokeWeight=pending.values.strokeWeight;}}
            if(pending.tracking!==null){var spans=styleTrackingSpans(plan,pending);for(var t=0;t<spans.length;t++){story.characters.itemByRange(spans[t].start,spans[t].end).tracking=pending.tracking;}}
            if(pending.axis){axesOn(range,pending.axis,pending.amount);}pending=null;
        }
        for(var u=0;u<plan.units.length;u++){
            var amount=plan.distribution.values[u];
            for(var sp=0;sp<plan.units[u].spans.length;sp++){
                var span=plan.units[u].spans[sp],cursor=span.start;
                while(cursor<=span.end){
                    var base=hasOriginal?blendBaselineRow(plan.blendBaseline||[],cursor):null,end=base?Math.min(span.end,base.end):span.end;
                    for(var q=0;q<attrs.length;q++){if(base && attrs[q].id==="leading" && (attrs[q].originalA||attrs[q].originalB) && base.values.leading && base.values.leading.automaticLeading){end=cursor;}}
                    var values={},valueKey={},tracking=null,axisAttr=null,tintOverrides={};
                    for(var a=0;a<attrs.length;a++){
                        var attr=attrs[a],av=attr.a,bv=attr.b;
                        if(attr.originalA){av=originalBlendEndpoint(attr,base,story,cursor,doc,bv);}
                        if(attr.originalB){bv=originalBlendEndpoint(attr,base,story,cursor,doc,av);}
                        if(attr.kind==="number"){
                            var n=styleBlendNumber({a:av,b:bv,integer:attr.integer,angle:attr.angle},amount);
                            if(attr.id==="tracking" && plan.settings.target==="letters"){tracking=n;}else{values[attr.id]=n;}valueKey[attr.id]=n;
                        }else if(attr.kind==="color"){
                            if(av.space!==bv.space || av.channels.length!==bv.channels.length){fail("Original and endpoint colors must share a process color space. Define both endpoints or use Missing values: Skip.");}
                            var key=av.id+":"+bv.id+":"+Math.round(amount*64/100);
                            if(!cache[key]){cache[key]=blendPaint(doc,{colorA:av.id,colorB:bv.id,paletteCache:paletteCache},amount,64);}var paint=cache[key];values[attr.id]=paint.swatch;valueKey[attr.id]="color:"+String(paint.swatch.id);
                            if(paint.tint!==null){
                                var tintID={fillColor:"fillTint",strokeColor:"strokeTint",underlineColor:"underlineTint",strikeThroughColor:"strikeThroughTint"}[attr.id],ta=base.values[tintID],tb=ta;
                                for(var ti=0;ti<attrs.length;ti++){if(attrs[ti].id===tintID){ta=attrs[ti].originalA?base.values[tintID]:attrs[ti].a;tb=attrs[ti].originalB?base.values[tintID]:attrs[ti].b;break;}}
                                tintOverrides[tintID]=styleBlendNumber({a:(av.tint===undefined?100:av.tint)*ta/100,b:(bv.tint===undefined?100:bv.tint)*tb/100},amount);
                            }
                        }else{axisAttr={a:av,b:bv,axes:attr.axes,font:attr.font,fontKey:attr.fontKey};var axisKey=[];for(var ak=0;ak<attr.axes.length;ak++){axisKey.push(av[ak]+(bv[ak]-av[ak])*amount/100);}valueKey.designAxes=axisKey;}
                    }
                    for(var tintID in tintOverrides){values[tintID]=valueKey[tintID]=tintOverrides[tintID];}
                    if(hasStrokePaint && !hasStrokeWeight){
                        var originalPaint=base.values.strokeColor,hidden=originalPaint && /^(\[?None\]?)$/.test(originalPaint.name||"");
                        values.strokeWeight=valueKey.strokeWeight=hidden?0:base.values.strokeWeight;
                    }
                    var formatKey=encode(valueKey);
                    if(pending && pending.end+1===cursor && pending.key===formatKey){pending.end=end;}
                    else{flush();pending={start:cursor,end:end,key:formatKey,values:values,tracking:tracking,axis:axisAttr,amount:amount};}cursor=end+1;
                }
            }
        }
        flush();
    }
    function styleBlendSavedSnapshot(rows, plan) {
        if (plan.settings.property !== "styleBlend" || plan.settings.target !== "letters") { return rows; }
        var ownsTracking=false;for(var a=0;a<plan.settings.blendDefinition.attributes.length;a++){if(plan.settings.blendDefinition.attributes[a].id==="tracking"){ownsTracking=true;break;}}if(!ownsTracking){return rows;}
        var result = [], lastKey = null;
        for (var r = 0; r < rows.length; r++) { for (var i = rows[r].start; i <= rows[r].end; i++) {
            var values = {}, any = false;
            for (var p in rows[r].values) { if (p !== "tracking" || blendNextKind(plan, i) !== "space") { values[p] = rows[r].values[p]; any = true; } }
            if (!any) { lastKey = null; continue; } var key = encode(values);
            if (key === lastKey && result[result.length - 1].end === i - 1) { result[result.length - 1].end = i; }
            else { result.push({start:i,end:i,values:values}); lastKey = key; }
        } }
        return result;
    }

    function propertyInfo(id, axis) {
        var map = {
            tracking: ["Tracking", "1/1000 em", -1000, 10000, 0, 200, true],
            pointSize: ["Font size", "pt", 0.1, 1296, 12, 36, false],
            baselineShift: ["Baseline shift", "pt", -1000, 1000, -5, 5, false],
            horizontalScale: ["Horizontal scale", "%", 1, 1000, 80, 120, false],
            verticalScale: ["Vertical scale", "%", 1, 1000, 80, 120, false],
            characterRotation: ["Character rotation", "degrees", -360, 360, -15, 15, false],
            skew: ["Skew", "degrees", -85, 85, -15, 15, false],
            strokeWeight: ["Text stroke width", "pt", 0, 100, 0, 2, false],
            strokeTint: ["Text stroke tint", "%", 0, 100, 0, 100, false],
            strokeColor: ["Text stroke color", "blend %", 0, 100, 0, 100, false],
            fillColor: ["Character color", "blend %", 0, 100, 0, 100, false],
            fillTint: ["Character tint", "%", 0, 100, 0, 100, false],
            underlineWeight: ["Underline weight", "pt", 0, 100, 0.25, 3, false],
            underlineOffset: ["Underline offset", "pt", -1000, 1000, 0, 8, false],
            leftIndent: ["Paragraph left indent", "pt", 0, 1000, 0, 36, false],
            rightIndent: ["Paragraph right indent", "pt", 0, 1000, 0, 36, false],
            firstLineIndent: ["Paragraph first-line indent", "pt", -1000, 1000, 0, 36, false],
            lineLength: ["Line length", "% frame width", 1, 100, 40, 100, false],
            styleBlend: ["Character-style blend", "blend %", 0, 100, 0, 100, false]
        };
        if (id === "designAxes") {
            if (!axis) { return { label: "Variable-font axis", unit: "axis units", low: 0, high: 1000, min: 0, max: 1000, integer: false }; }
            return { label: "Variable-font " + axis.name, unit: "axis units", low: axis.min, high: axis.max, min: axis.min, max: axis.max, integer: false };
        }
        var info = map[id];
        if (!info) { fail("Unknown property: " + id); }
        return { label: info[0], unit: info[1], low: info[2], high: info[3], min: info[4], max: info[5], integer: info[6] };
    }
    function propertiesFor(settings) {
        if (settings.property === "styleBlend") { return blendDefinitionProperties(settings.blendDefinition); }
        if (settings.property === "lineLength") { return ["leftIndent", "rightIndent", "firstLineIndent", "lastLineIndent", "spaceBefore", "spaceAfter", "hyphenation", "keepWithNext", "keepAllLinesTogether", "keepLinesTogether", "startParagraph", "justification"]; }
        if (/^underline/.test(settings.property)) { return ["underline", settings.property]; }
        if (/^stroke/.test(settings.property)) { return ["strokeWeight", "strokeColor", "strokeTint"]; }
        if(settings.property==="fillColor"){return ["fillColor","fillTint"];}
        return [settings.property];
    }
    function readProperty(character, property) {
        var value;
        try { value = character[property];if(value instanceof Array && property!=="designAxes" && value.length===1){value=value[0];} } catch (_) { return null; }
        if (/^(underline|hyphenation|keepAllLinesTogether|keepLinesTogether)$/.test(property)) { return !!value; }
        if (property === "leading") { try { if (value == Leading.AUTO) { return {automaticLeading:true}; } } catch (_) {} }
        if (/^(strokeColor|fillColor|underlineColor|strikeThroughColor)$/.test(property)) { return typeof value === "string" ? {nativeColorString:value} : { swatch: value.id, name: value.name }; }
        if (property === "designAxes") {
            var font=character.appliedFont;if(font instanceof Array){font=font.length===1?font[0]:null;}if(!font || !axisInfo(font).length){return null;}
            if(value instanceof Array && value.length===1 && value[0] instanceof Array){value=value[0];}
            var axes = [];
            if (typeof value.length === "number") { for (var i = 0; i < value.length; i++) { axes.push(Number(value[i])); } }
            else { axes.push(Number(value)); }
            return axes;
        }
        return Number(value);
    }
    function writeProperty(story, span, property, value, doc) {
        if (value === null) { return; }
        var range = story.characters.itemByRange(span.start, span.end);
        if (property === "leading" && value && value.automaticLeading) { range.leading = Leading.AUTO; return; }
        if (/^(strokeColor|fillColor|underlineColor|strikeThroughColor)$/.test(property)) {
            if (value.nativeColorString) { range[property] = value.nativeColorString; return; }
            var swatch = doc.swatches.itemByID(value.swatch);
            if (!swatch.isValid || String(swatch.name)!==String(value.name)) { swatch = doc.swatches.itemByName(value.name); }
            if (!swatch.isValid) { fail("A saved formatting swatch was renamed or deleted. Choose its replacement or Forget saved setup."); }
            range[property] = swatch;
        } else { range[property] = /^(underline|hyphenation|keepAllLinesTogether|keepLinesTogether)$/.test(property) ? !!value : value; }
    }
    function snapshotValue(value, property, cache) {
        if(property==="leading"){try{if(value==Leading.AUTO){return {automaticLeading:true};}}catch(_){}if(typeof value!=="number" || !isFinite(value)){throw new Error("Unresolved leading");}return value;}
        if(/Color$/.test(property)){
            if(typeof value==="string"){return {nativeColorString:value};}
            if(value===cache.lastColor && cache.lastColorValue){return cache.lastColorValue;}
            var id=value.id,key="swatch:"+id;if(typeof id!=="number"){throw new Error("Unresolved swatch");}
            if(!cache[key]){cache[key]={swatch:id,name:String(value.name)};}cache.lastColor=value;cache.lastColorValue=cache[key];return cache[key];
        }
        if(typeof value!=="number" || !isFinite(value)){throw new Error("Unresolved numeric column");}return value;
    }
    function takeRunSnapshot(story, properties, bounds) {
        // Native formatting runs avoid thousands of identical character reads.
        // Paragraph properties and unresolved mixed runs keep the scalar path.
        var count=bounds?bounds.end-bounds.start+1:story.characters.length;
        for(var p=0;p<properties.length;p++){if(/^(leftIndent|rightIndent|firstLineIndent|lastLineIndent|spaceBefore|spaceAfter|hyphenation|keepWithNext|keepAllLinesTogether|keepLinesTogether|startParagraph|justification)$/.test(properties[p])){return null;}}
        try{
            var collection=bounds?story.characters.itemByRange(bounds.start,bounds.end).textStyleRanges:story.textStyleRanges;
            if(!collection || !collection.length || collection.length>Math.max(1,count/4)){return null;}
            var objects=collection.everyItem().getElements(),rows=[],next=bounds?bounds.start:0,limit=bounds?bounds.end:count-1,key=null;
            for(var i=0;i<objects.length;i++){
                var span=boundsOf(objects[i]);if(!span){return null;}var start=Math.max(next,span.start),end=Math.min(limit,span.end);
                if(start!==next || end<start){return null;}var values={};
                for(var j=0;j<properties.length;j++){
                    var property=properties[j],raw=objects[i][property];if(raw instanceof Array && property!=="designAxes" && raw.length===1){raw=raw[0];}
                    try{if(raw==NothingEnum.NOTHING){return null;}}catch(_){}
                    var value=readProperty(objects[i],property);if(typeof value==="number" && !isFinite(value)){return null;}
                    if(/Color$/.test(property) && (!value || (!value.nativeColorString && typeof value.swatch!=="number"))){return null;}values[property]=value;
                }
                var current=encode(values);if(current===key){rows[rows.length-1].end=end;}else{rows.push({start:start,end:end,values:values});key=current;}next=end+1;
            }
            return next===limit+1?rows:null;
        }catch(_){return null;}
    }
    function takeSnapshot(story, properties, bounds) {
        var runs=takeRunSnapshot(story,properties,bounds);if(runs){return runs;}
        var start=bounds?bounds.start:0,count=bounds?bounds.end-start+1:story.characters.length;
        var collection=bounds?story.characters.itemByRange(bounds.start,bounds.end).characters:story.characters;
        var characters=null,rows=[],previousKey=null,columns={},cache={},axisFonts={};
        for(var b=0;b<properties.length;b++){
            var prop=properties[b];if(/^(designAxes|underline|hyphenation|keepAllLinesTogether|keepLinesTogether)$/.test(prop)){continue;}
            try{
                var bulk=collection.everyItem()[prop],column=[];
                if(bulk instanceof Array && bulk.length===count){if(prop!=="leading" && !/Color$/.test(prop)){columns[prop]=bulk;}else{for(var c=0;c<count;c++){column.push(snapshotValue(bulk[c],prop,cache));}columns[prop]=column;}}
                else if(!(bulk instanceof Array)){columns[prop]={uniform:snapshotValue(bulk,prop,cache)};}
            }catch(_){}
        }
        for(var i=0;i<count;i++){
            var values={};
            for(var j=0;j<properties.length;j++){
                var property=properties[j],column=columns[property];
                if(column!==undefined){var cell=column instanceof Array?column[i]:column.uniform;values[property]=(property==="leading" || /Color$/.test(property))?cell:Number(cell);continue;}
                if(!characters){characters=collection.everyItem().getElements();}
                if(property==="designAxes"){
                    var font=characters[i].appliedFont,key="font:"+String(font.name);
                    if(!axisFonts.hasOwnProperty(key)){axisFonts[key]=axisInfo(font).length>0;}
                    var axes=characters[i].designAxes,copy=[];
                    if(axisFonts[key]){if(axes instanceof Array || (axes && typeof axes.length==="number")){for(var x=0;x<axes.length;x++){copy.push(Number(axes[x]));}}else{copy.push(Number(axes));}values[property]=copy;}else{values[property]=null;}
                }else if(property==="leading" || /Color$/.test(property)){
                    try{values[property]=snapshotValue(characters[i][property],property,cache);}catch(_){values[property]=readProperty(characters[i],property);}
                }else{values[property]=readProperty(characters[i],property);}
            }
            var encoded=encode(values);if(encoded===previousKey){rows[rows.length-1].end=start+i;}else{rows.push({start:start+i,end:start+i,values:values});previousKey=encoded;}
        }
        return rows;
    }
    function restoreSnapshot(story, rows, doc) {
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].start < 0 || rows[i].end >= story.characters.length || rows[i].end < rows[i].start) { fail("Saved text bounds no longer match this story."); }
            for (var property in rows[i].values) {
                if (!/^(tracking|pointSize|baselineShift|horizontalScale|verticalScale|characterRotation|skew|strokeWeight|strokeColor|strokeTint|fillColor|fillTint|designAxes|underline|underlineWeight|underlineOffset|leftIndent|rightIndent|firstLineIndent|lastLineIndent|spaceBefore|spaceAfter|hyphenation|keepWithNext|keepAllLinesTogether|keepLinesTogether|startParagraph|justification|leading|underlineTint|underlineColor|strikeThroughWeight|strikeThroughOffset|strikeThroughTint|strikeThroughColor)$/.test(property)) { fail("Unsupported saved property."); }
                writeProperty(story, rows[i], property, rows[i].values[property], doc);
            }
        }
    }
    function touchedIndices(units) {
        var touched = {};
        for (var i = 0; i < units.length; i++) {
            for (var j = 0; j < units[i].spans.length; j++) {
                var span = units[i].spans[j];
                for (var k = span.start; k <= span.end; k++) { touched[k] = true; }
            }
        }
        return touched;
    }
    function filterSnapshot(rows, touched) {
        var selected = [];
        for (var r = 0; r < rows.length; r++) {
            var start = null;
            for (var i = rows[r].start; i <= rows[r].end + 1; i++) {
                if (i <= rows[r].end && touched[i]) { if (start === null) { start = i; } }
                else if (start !== null) { selected.push({ start: start, end: i - 1, values: rows[r].values }); start = null; }
            }
        }
        return selected;
    }
    function boundsFor(target, scope) {
        if (scope.kind === "frame") { return visibleBounds(target.frame); }
        if (scope.kind === "story") { return boundsOf(target.story); }
        return scope.bounds;
    }
    function geometryKey(data) {
        var parts = [data.bounds.start, data.bounds.end];
        for (var i = 0; i < data.lines.length; i++) { parts.push(data.lines[i].start + ":" + data.lines[i].end); }
        var frames = data.frames || [];
        for (var f = 0; f < frames.length; f++) { parts.push("f" + frames[f].id + ":" + frames[f].start + ":" + frames[f].end); }
        return parts.join("|");
    }
    function makePlan(data, settings) {
        settings = effectiveSettings(settings);
        var baseUnits = collectUnits(data, settings), restart = settings.restart || "never";
        var spans = structureSpans(data, restart, true), units = [], groups = [], values = [], cursor = 0;
        var minSteps = null, maxSteps = 0, shortGroups = 0;
        for (var g = 0; g < spans.length; g++) {
            var bounds = { start: spans[g].start, end: spans[g].end };
            if (restart === "line" || restart === "frame") {
                while (bounds.start <= bounds.end && data.characters[bounds.start - data.bounds.start].kind !== "text") { bounds.start++; }
                while (bounds.end >= bounds.start && data.characters[bounds.end - data.bounds.start].kind !== "text") { bounds.end--; }
            }
            if (bounds.end < bounds.start) { continue; }
            var groupUnits = [];
            if (restart === "never") { groupUnits = baseUnits; }
            else {
                while (cursor < baseUnits.length && baseUnits[cursor].spans[baseUnits[cursor].spans.length - 1].end < bounds.start) { cursor++; }
                for (var u = cursor; u < baseUnits.length && baseUnits[u].spans[0].start <= bounds.end; u++) {
                    var pieces = [];
                    for (var s = 0; s < baseUnits[u].spans.length; s++) {
                        var source = baseUnits[u].spans[s], a = Math.max(bounds.start, source.start), z = Math.min(bounds.end, source.end);
                        if (a <= z) { pieces.push({ start: a, end: z }); }
                    }
                    if (pieces.length) { groupUnits.push({ spans: pieces }); }
                }
            }
            if (!groupUnits.length) { continue; }
            var distribution = buildDistribution(groupUnits.length, settings);
            groups.push({ start: bounds.start, end: bounds.end, structureIndex: g, count: groupUnits.length, offset: units.length, distribution: distribution });
            minSteps = minSteps === null ? distribution.steps : Math.min(minSteps, distribution.steps);
            maxSteps = Math.max(maxSteps, distribution.steps);
            if (distribution.steps < 3) { shortGroups++; }
            for (var i = 0; i < groupUnits.length; i++) { units.push(groupUnits[i]); values.push(distribution.values[i]); }
        }
        if (!units.length && settings.textEnabled !== false) { fail("No matching targets in this structure. Frame/line groups exclude overset; Tracking Letters excludes outgoing gaps."); }
        return { data: data, units: units, groups: groups, settings: settings,
            distribution: { steps: maxSteps, minSteps: minSteps || 0, values: values, levels: groups.length === 1 ? groups[0].distribution.levels : [], shortGroups: shortGroups }, passes: 1 };
    }
    function trackingPlansEquivalent(applied, desired, baseline) {
        function valuesOf(plan) {
            var values = {};
            for (var i = 0; i < plan.units.length; i++) {
                for (var j = 0; j < plan.units[i].spans.length; j++) {
                    var span = plan.units[i].spans[j];
                    for (var k = span.start; k <= span.end; k++) { values[k] = plan.distribution.values[i]; }
                }
            }
            return values;
        }
        var a = valuesOf(applied), b = valuesOf(desired), key;
        for (key in a) { if (a[key] !== (b.hasOwnProperty(key) ? b[key] : baseline[key])) { return false; } }
        for (key in b) { if (b[key] !== (a.hasOwnProperty(key) ? a[key] : baseline[key])) { return false; } }
        return true;
    }
    function compositionCycleMessage(previous, current) {
        var detail = "";
        if (previous) {
            var count = Math.max(previous.lines.length, current.lines.length);
            function wordsIn(data, line) {
                var words = 0; if (!line) { return 0; }
                for (var w = 0; w < data.words.length; w++) { if (data.words[w].end >= line.start && data.words[w].start <= line.end) { words++; } }
                return words;
            }
            for (var i = 0; i < count; i++) {
                var a = previous.lines[i], b = current.lines[i];
                if (!a || !b || a.start !== b.start || a.end !== b.end) {
                    detail = " Line " + (i + 1) + " changes between " + wordsIn(previous, a) + " and " + wordsIn(current, b) + " words under this curve."; break;
                }
            }
        }
        return "Composition oscillates." + detail + " Try a smaller range or different curve/steps. No unstable formatting was kept.";
    }
    function settleLines(adapter, settings) {
        var seen = {}, data = adapter.capture(), previous = null, plan;
        for (var pass = 1; pass <= 24; pass++) {
            var before = geometryKey(data);
            if (seen[before]) { fail(compositionCycleMessage(previous, data)); }
            seen[before] = true;
            plan = makePlan(data, settings);
            adapter.restore(); adapter.apply(plan); adapter.recompose();
            var after = adapter.capture();
            if (geometryKey(after) === before) { plan.passes = pass; plan.data = after; return plan; }
            if (adapter.matches) {
                var resulting = makePlan(after, settings);
                if (adapter.matches(plan, resulting)) { resulting.passes = pass; resulting.data = after; return resulting; }
            }
            previous = data; data = after;
        }
        fail("Line composition did not settle in 24 passes. Reduce the range or use word/character mode.");
    }
    function compositionFailure(error) { return /oscillates|did not settle/.test(error.message); }
    function clippedPlan(plan, bounds) {
        var next = {}, key, values = [], groups = [], units = [];
        for (key in plan) { next[key] = plan[key]; }
        for (var g = 0; g < plan.groups.length; g++) {
            var sourceGroup = plan.groups[g], groupValues = [], offset = units.length;
            for (var i = sourceGroup.offset; i < sourceGroup.offset + sourceGroup.count; i++) {
                var spans = [], sourceUnit = plan.units[i];
                for (var j = 0; j < sourceUnit.spans.length; j++) {
                    var span = sourceUnit.spans[j], a = Math.max(span.start, bounds.start), z = Math.min(span.end, bounds.end);
                    if (a <= z) { spans.push(isParagraphProperty(plan.settings.property) ? { start: span.start, end: span.end } : { start: a, end: z }); }
                }
                if (spans.length) { units.push({ spans: spans }); values.push(plan.distribution.values[i]); groupValues.push(plan.distribution.values[i]); }
            }
            if (groupValues.length) {
                groups.push({ start: sourceGroup.start, end: sourceGroup.end, structureIndex: sourceGroup.structureIndex,
                    offset: offset, count: groupValues.length,
                    distribution: { steps: Math.min(sourceGroup.distribution.steps, groupValues.length), values: groupValues, levels: sourceGroup.distribution.levels } });
            }
        }
        var minSteps = null, maxSteps = 0, shortGroups = 0;
        for (g = 0; g < groups.length; g++) { var n = groups[g].distribution.steps; minSteps = minSteps === null ? n : Math.min(minSteps, n); maxSteps = Math.max(maxSteps, n); if (n < 3) { shortGroups++; } }
        next.units = units; next.groups = groups;
        var data = {}; for (key in plan.data) { data[key] = plan.data[key]; }
        data.bounds = { start: Math.max(plan.data.bounds.start, bounds.start), end: Math.min(plan.data.bounds.end, bounds.end) }; next.data = data;
        next.distribution = { steps: maxSteps, minSteps: minSteps || 0, values: values, levels: groups.length === 1 ? groups[0].distribution.levels : [], shortGroups: shortGroups };
        return next;
    }
    function fixedSampling(adapter, settings, frameScope) {
        adapter.restore(); adapter.recompose();
        var plan = makePlan(adapter.capture(), settings), originalUnits = encode(plan.units);
        // Samples are assigned once. Trimming can only remove targets, so a
        // boundary word cannot restart the distribution feedback loop.
        for (var pass = 1; pass <= 64; pass++) {
            adapter.restore(); adapter.apply(plan); adapter.recompose();
            var after = adapter.capture(), clipped = frameScope ? clippedPlan(plan, after.bounds) : plan;
            if (!clipped.units.length) { fail("The effect leaves no visible targets. Reduce the range or choose Entire story."); }
            if (encode(clipped.units) === encode(plan.units) && (!settings.clearTracking || !frameScope || encode(clipped.data.bounds) === encode(plan.data.bounds))) {
                plan.sampleBounds = { start: plan.data.bounds.start, end: plan.data.bounds.end }; plan.data = after; plan.passes = pass; plan.fixedSampling = true;
                plan.trimmedSampling = encode(plan.units) !== originalUnits; return plan;
            }
            plan = clipped;
        }
        fail("The effect leaves no stable visible target range. Reduce the range or choose Entire story.");
    }

    function generatedColorKey(space, channels) { return String(space)+" "+channels.join("-"); }
    function ownedColorGroup(doc) {
        var stem="Tracking Ramp",name=stem,index=0,group;
        while(true){group=doc.colorGroups.itemByName(name);if(!group.isValid){group=doc.colorGroups.add(name);group.insertLabel(COLOR_GROUP_KEY,"1");return group;}if(group.extractLabel(COLOR_GROUP_KEY)==="1"){return group;}index++;name=stem+" — generated"+(index>1?" ("+index+")":"");}
    }
    function groupGeneratedColor(doc, color) {
        if(!doc.colorGroups){return;}var group=ownedColorGroup(doc);
        if(!color.parentColorGroup || color.parentColorGroup.id!==group.id){group.colorGroupSwatches.add(color);}
    }
    function blendSwatch(doc, settings, value, buckets) {
        var a=doc.swatches.itemByID(settings.colorA),b=doc.swatches.itemByID(settings.colorB);
        if(!a.isValid||!b.isValid){fail("Choose two available colors.");}
        if(a.space!=b.space){fail("For color blending, choose two colors in the same color space (RGB, CMYK, or Lab).");}
        var resolution=buckets||63,t=Math.round(Math.max(0,Math.min(1,value/100))*resolution)/resolution;
        if(t===0 || a.id===b.id){return a;}if(t===1){return b;}
        var av=a.colorValue,bv=b.colorValue,values=[];
        for(var i=0;i<av.length;i++){values.push(Math.round((av[i]+(bv[i]-av[i])*t)*1000)/1000);}
        var key=generatedColorKey(a.space,values),oldName="TR3 "+key,palette=settings.paletteCache||{},swatch=palette[key]||doc.colors.itemByName(oldName);
        if(swatch.isValid && (swatch.model!=ColorModel.PROCESS || generatedColorKey(swatch.space,swatch.colorValue)!==key)){swatch={isValid:false};}
        if(!palette.ready){
            var colors=doc.colors.everyItem().getElements();
            for(i=0;i<colors.length;i++){var savedKey=colors[i].extractLabel?colors[i].extractLabel(COLOR_KEY):"";if(savedKey&&colors[i].model==ColorModel.PROCESS&&generatedColorKey(colors[i].space,colors[i].colorValue)===savedKey){palette[savedKey]=colors[i];}}
            palette.ready=true;
        }
        if(!swatch.isValid && palette[key] && palette[key].isValid){swatch=palette[key];}
        if(!swatch.isValid){
            var stem="TR · "+a.name+" → "+b.name+" · "+Math.round(t*100)+"%",name=stem,n=2;
            while(doc.colors.itemByName(name).isValid){name=stem+" ("+(n++)+")";}
            swatch=doc.colors.add({name:name,model:ColorModel.PROCESS,space:a.space,colorValue:values});
        }
        // Never rename an older swatch: saved baselines resolve it by name.
        if(swatch.insertLabel){swatch.insertLabel(COLOR_KEY,key);groupGeneratedColor(doc,swatch);}
        palette[key]=swatch;return swatch;
    }
    function blendPaint(doc, settings, value, buckets) {
        var a=processStyleColor(doc.swatches.itemByID(settings.colorA)),b=processStyleColor(doc.swatches.itemByID(settings.colorB));
        if(!a||!b){return {swatch:blendSwatch(doc,settings,value,buckets),tint:null};}
        if(a.baseID===b.baseID && (a.tint!==100||b.tint!==100)){
            return {swatch:doc.swatches.itemByID(a.baseID),tint:styleBlendNumber({a:a.tint,b:b.tint},value)};
        }
        if(a.tint!==100||b.tint!==100){fail("Tint endpoints must share the same base color. Use two process colors for other blends.");}
        return {swatch:blendSwatch(doc,settings,value,buckets),tint:null};
    }
    function protectedColorNames(doc) {
        var keep={};function scan(value,key){
            if(value===null||value===undefined){return;}
            if(typeof value==="string"){keep["name:"+value]=true;}
            else if(typeof value==="number" && /^(swatch|colorA|colorB)$/.test(key||"")){keep["id:"+value]=true;}
            else if(typeof value==="object"){for(var k in value){scan(value[k],k);}}
        }
        var stories=doc.stories.everyItem().getElements();
        for(var i=0;i<stories.length;i++){var raw=stories[i].extractLabel(HISTORY_KEY);if(raw){scan(decode(raw));}raw=stories[i].extractLabel(SETUP_KEY);if(raw){scan(decode(raw));}}
        return keep;
    }
    function manageGeneratedColors(doc, removeUnused) {
        var result={grouped:0,removed:0},keep=protectedColorNames(doc),unused={},list=doc.unusedSwatches,colors=doc.colors.everyItem().getElements();
        for(var u=0;u<list.length;u++){unused["id:"+list[u].id]=true;}
        // An endpoint can itself be an earlier generated color. Keep its position.
        var styles=doc.allCharacterStyles||[],paintIDs=["fillColor","strokeColor","underlineColor","strikeThroughColor"];
        for(var st=0;st<styles.length;st++){for(var p=0;p<paintIDs.length;p++){try{var paint=styleValue(styles[st],paintIDs[p],doc);if(paint&&paint.id){keep["id:"+paint.id]=true;}}catch(_){}}}
        for(var i=colors.length-1;i>=0;i--){var color=colors[i],key=generatedColorKey(color.space,color.colorValue),owned=color.extractLabel(COLOR_KEY)===key,legacy=color.model==ColorModel.PROCESS&&color.name==="TR3 "+key;
            if(!owned&&!legacy){continue;}
            if(removeUnused && unused["id:"+color.id]&&!keep["id:"+color.id]&&!keep["name:"+color.name]){color.remove();result.removed++;}
            else if(!keep["id:"+color.id]){color.insertLabel(COLOR_KEY,key);groupGeneratedColor(doc,color);result.grouped++;}
        }
        return result;
    }
    function applyValues(story, plan, doc, baseline) {
        if (baseline) { plan.blendBaseline = baseline; }
        if (plan.settings.property === "styleBlend") { applyStyleBlend(story, plan, doc); return; }
        var settings = plan.settings,paintSettings={colorA:plan.settings.colorA,colorB:plan.settings.colorB,paletteCache:{}};
        for (var i = 0; i < plan.units.length; i++) {
            var value = plan.distribution.values[i], swatch = null;
            if (/^(strokeColor|fillColor)$/.test(settings.property)) { swatch = blendPaint(doc, paintSettings, value); }
            for (var j = 0; j < plan.units[i].spans.length; j++) {
                var span = plan.units[i].spans[j];
                var range = story.characters.itemByRange(span.start, span.end);
                if (settings.property === "designAxes") {
                    for (var k = span.start; k <= span.end; k++) {
                        var character = story.characters.item(k).getElements()[0];
                        var axes = axisInfo(character.appliedFont), axis = null;
                        for (var n = 0; n < axes.length; n++) { if (axes[n].name === settings.axisName) { axis = axes[n]; break; } }
                        if (!axis) { fail("Font " + character.appliedFont.name + " has no " + settings.axisName + " axis."); }
                        if (value < axis.min || value > axis.max) { fail("Value is outside the " + axis.min + "–" + axis.max + " range of " + character.appliedFont.name + "."); }
                        character.setNthDesignAxis(axis.index, value);
                    }
                } else if (/^underline/.test(settings.property)) {
                    range.underline = true; range[settings.property] = value;
                } else if (/^stroke/.test(settings.property)) {
                    var chars = range.characters.everyItem().getElements();
                    for (k = 0; k < chars.length; k++) {
                        if (settings.property !== "strokeWeight" && Number(chars[k].strokeWeight) === 0) { chars[k].strokeWeight = settings.strokeWidth; }
                        if (settings.property !== "strokeColor" && chars[k].strokeColor.name === "None") { chars[k].strokeColor = doc.swatches.itemByID(settings.colorA); }
                        // Built-in swatch names may include brackets in the DOM.
                        if (settings.property !== "strokeColor" && /^(\[?None\]?)$/.test(chars[k].strokeColor.name)) { chars[k].strokeColor = doc.swatches.itemByID(settings.colorA); }
                    }
                    if (/^(strokeColor|fillColor)$/.test(settings.property)) { range.strokeColor = swatch.swatch;if(swatch.tint!==null){range.strokeTint=swatch.tint;} }
                    else { range[settings.property] = value; }
                } else if (settings.property === "fillColor") { range.fillColor = swatch.swatch;if(swatch.tint!==null){range.fillTint=swatch.tint;} }
                else { range[settings.property] = value; }
            }
        }
    }

    function removeMetrics(doc, storyID, owner) {
        var frames = doc.textFrames.everyItem().getElements();
        for (var i = frames.length - 1; i >= 0; i--) {
            var savedOwner=frames[i].extractLabel("TR8.metricsOwner");
            if ((owner && savedOwner === owner) || (!savedOwner && frames[i].extractLabel("TR3.metricsStory") === String(storyID))) {
                frames[i].locked = false; frames[i].remove();
            }
        }
    }
    function scalarColumn(value, count) {
        if (typeof value === "number" && isFinite(value)) {
            var repeated = []; for (var i = 0; i < count; i++) { repeated.push(value); } return repeated;
        }
        if (!(value instanceof Array) || value.length !== count) { return null; }
        for (var n = 0; n < count; n++) { if (typeof value[n] !== "number" || !isFinite(value[n])) { return null; } }
        return value;
    }
    function paragraphColumn(paragraphs, property, count, firstGlyph) {
        try {
            var source = paragraphs.everyItem();
            return scalarColumn(firstGlyph ? source.characters.firstItem()[property] : source[property], count);
        } catch (_) { return null; }
    }
    function metricsRows(lines, ascent, descent, padding) {
        var columns = {}, result = {}, height = ascent + descent;
        for (var i = 0; i < lines.length; i++) {
            var column = String(lines[i].column || 0);
            if (!columns[column]) { columns[column] = []; } columns[column].push(lines[i]);
        }
        for (var key in columns) {
            var rows = columns[key]; rows.sort(function (a, b) { return a.baseline - b.baseline; });
            for (i = 0; i < rows.length; i++) {
                var row = rows[i], low = row.bottom + padding, high;
                if (i + 1 < rows.length) { high = rows[i + 1].top - padding; }
                else { high = low + Math.max(height, row.leading - (row.bottom - row.top) - 2 * padding); }
                result[row.key] = { baseline: (low + high + ascent - descent) / 2, crowded: high - low < height - 0.01,
                    top: low, bottom: high };
            }
        }
        return result;
    }
    function metricsLineGeometry(line, key, frame, column) {
        var chars = line.characters, bulk = chars.everyItem(), count = chars.length;
        var bases, ascents, descents;
        try { bases = bulk.baseline; ascents = bulk.ascent; descents = bulk.descent; } catch (_) {}
        function at(values, index, fallback) {
            var value = Number(values instanceof Array ? values[index] : values);
            return isFinite(value) ? value : fallback;
        }
        var baseline = Number(line.baseline), fallbackAscent = Number(line.ascent), fallbackDescent = Number(line.descent), top = Infinity, bottom = -Infinity;
        for (var i = 0; i < count; i++) {
            var base = at(bases, i, baseline), asc = at(ascents, i, fallbackAscent), desc = at(descents, i, fallbackDescent);
            top = Math.min(top, base - asc); bottom = Math.max(bottom, base + desc);
        }
        var first = chars.firstItem(), leading = Number(first.leading);
        if (!isFinite(leading) || leading <= 0 || leading > 10000) { leading = Number(first.pointSize) * 1.2; }
        return { key: key, frame: frame, column: column, baseline: baseline, top: top, bottom: bottom, leading: leading };
    }
    function addMetrics(target, plan) {
        var doc = target.document, story = target.story, containers = story.textContainers;
        var layer = null, marks = [], visible = {}, geometries = {};
        plan.metricsCrowded = 0;
        for (var f = 0; f < containers.length; f++) {
            if (typeName(containers[f]) !== "TextFrame") { continue; }
            var sourceFrame = containers[f], lines = sourceFrame.lines, columns = [];
            try { for (var col = 0; col < sourceFrame.textColumns.length; col++) { columns.push(boundsOf(sourceFrame.textColumns.item(col))); } } catch (_) {}
            geometries[sourceFrame.id] = [];
            for (var l = 0; l < lines.length; l++) {
                var line = lines.item(l), lineBounds = boundsOf(line); if (!lineBounds) { continue; }
                var column = 0;
                for (col = 0; col < columns.length; col++) { if (columns[col] && lineBounds.start >= columns[col].start && lineBounds.start <= columns[col].end) { column = col; break; } }
                var item = metricsLineGeometry(line, sourceFrame.id + ":" + l, sourceFrame.id, column);
                geometries[sourceFrame.id].push(item);
                for (var v = lineBounds.start; v <= lineBounds.end; v++) { visible[v] = item; }
            }
        }
        for (var i = 0; i < plan.units.length; i++) {
            var spans = plan.units[i].spans, starts = {};
            for (var j = 0; j < spans.length; j++) {
                for (var k = spans[j].start; k <= spans[j].end; k++) {
                    var composed = visible[k]; if (!composed || starts[composed.key]) { continue; }
                    var c = story.characters.item(k);
                    marks.push({ index: k, frame: composed.frame, row: composed.key, x: Number(c.horizontalOffset), tracking: Math.round(Number(c.tracking)) });
                    starts[composed.key] = true;
                }
            }
        }
        if (!marks.length) { return 0; }
        var layers = doc.layers.everyItem().getElements();
        for (i = 0; i < layers.length; i++) { if (layers[i].extractLabel("TR3.metricsLayer") === "1") { layer = layers[i]; break; } }
        if (!layer) { layer = doc.layers.add({ name: "Tracking Ramp Metrics" }); layer.insertLabel("TR3.metricsLayer", "1"); }
        if (layer.locked) { fail("Unlock the Tracking Ramp Metrics layer to update its overlay."); }
        layer.visible = true; layer.printable = true;
        var count = 0;
        for (f = 0; f < containers.length; f++) {
            var source = containers[f]; if (typeName(source) !== "TextFrame") { continue; }
            var labels = [];
            for (i = 0; i < marks.length; i++) { if (marks[i].frame === source.id) { labels.push(marks[i]); } }
            if (!labels.length) { continue; }
            if (Math.abs(source.absoluteRotationAngle) > 0.01 || Math.abs(source.absoluteShearAngle) > 0.01) { fail("Metrics currently requires unrotated, unsheared text frames. Turn Metrics off for this frame."); }
            var bounds = source.geometricBounds, top = Number(bounds[0]) - 5, left = Number(bounds[1]) - 5;
            for (i = 0; i < labels.length; i++) { left = Math.min(left, labels[i].x - 5); }
            var overlay = source.parent.textFrames.add({ itemLayer: layer, geometricBounds: [top, left, Number(bounds[2]) + 20, Number(bounds[3]) + 25] });
            overlay.name = "Tracking metrics " + source.id;
            overlay.insertLabel("TR3.metricsStory", String(story.id));overlay.insertLabel("TR8.metricsOwner",story.extractLabel(OWNER_KEY)); overlay.insertLabel("TR3.sourceFrame", String(source.id));
            overlay.nonprinting = false; overlay.fillColor = doc.swatches.itemByName("None"); overlay.strokeWeight = 0;
            overlay.textWrapPreferences.textWrapMode = TextWrapModes.NONE;
            overlay.textFramePreferences.insetSpacing = 0; overlay.textFramePreferences.ignoreWrap = true;
            overlay.textFramePreferences.firstBaselineOffset = FirstBaseline.FIXED_HEIGHT;
            overlay.textFramePreferences.minimumFirstBaselineOffset = 5;
            var strings = []; for (i = 0; i < labels.length; i++) { strings.push(String(labels[i].tracking)); }
            overlay.contents = strings.join("\r");
            overlay.parentStory.storyPreferences.opticalMarginAlignment = false;
            var text = overlay.parentStory.texts.item(0);
            text.appliedParagraphStyle = doc.paragraphStyles.item(0); text.appliedCharacterStyle = doc.characterStyles.item(0);
            text.appliedFont = story.characters.item(labels[0].index).appliedFont;
            text.pointSize = 5; text.leading = 0.01; text.tracking = 0; text.baselineShift = 0;
            text.horizontalScale = 100; text.verticalScale = 100; text.characterRotation = 0; text.skew = 0;
            text.fillColor = doc.swatches.itemByName("Black"); text.fillTint = 100; text.strokeWeight = 0; text.noBreak = true;
            text.justification = Justification.LEFT_ALIGN; text.spaceBefore = 0; text.spaceAfter = 0;
            text.alignToBaseline = false; text.hyphenation = false; text.firstLineIndent = 0; text.rightIndent = 0;
            overlay.parentStory.recompose();
            var firstLabel = text.characters.firstItem();
            var asc = Number(firstLabel.ascent), desc = Number(firstLabel.descent);
            var positions = metricsRows(geometries[source.id], asc, desc, 0.5), crowded = {}, lastBottom = Number(bounds[2]) + 20;
            var paragraphCollection = overlay.parentStory.paragraphs, paragraphs = paragraphCollection.everyItem().getElements();
            for (i = 0; i < labels.length; i++) {
                labels[i].y = positions[labels[i].row].baseline;
                if (positions[labels[i].row].crowded) { crowded[labels[i].row] = true; }
                lastBottom = Math.max(lastBottom, labels[i].y + desc + 5);
                paragraphs[i].properties = { leftIndent: Math.max(0, labels[i].x - left), baselineShift: top + 5 + i * 0.01 - labels[i].y };
            }
            for (var crowdedKey in crowded) { plan.metricsCrowded++; }
            overlay.geometricBounds = [top, left, lastBottom, Number(bounds[3]) + 25];
            // Native leading has a nonzero minimum, and glyph origins can add
            // offsets. Correct BOTH coordinates from the actual composition.
            for (var correctionPass = 0; correctionPass < 2; correctionPass++) {
                overlay.parentStory.recompose();
                var xs = paragraphColumn(paragraphCollection, "horizontalOffset", labels.length, true);
                var ys = paragraphColumn(paragraphCollection, "baseline", labels.length, true);
                var indents = paragraphColumn(paragraphCollection, "leftIndent", labels.length, false);
                var shifts = paragraphColumn(paragraphCollection, "baselineShift", labels.length, false);
                for (i = 0; i < labels.length; i++) {
                    var p = paragraphs[i], glyph = !xs || !ys ? p.characters.firstItem() : null;
                    var dx = labels[i].x - (xs ? xs[i] : Number(glyph.horizontalOffset));
                    var dy = (ys ? ys[i] : Number(glyph.baseline)) - labels[i].y;
                    var corrections = {}, changed = false;
                    if (Math.abs(dx) > 0.0000001) { corrections.leftIndent = Math.max(0, (indents ? indents[i] : Number(p.leftIndent)) + dx); changed = true; }
                    if (Math.abs(dy) > 0.0000001) { corrections.baselineShift = (shifts ? shifts[i] : Number(p.baselineShift)) + dy; changed = true; }
                    if (changed) { p.properties = corrections; }
                }
            }
            overlay.parentStory.recompose(); overlay.bringToFront(); overlay.locked = true; count++;
        }
        return count;
    }

    var SHAPE_KEY = "TrackingRamp.v4.frameShape";
    function frameBase(frame) {
        if (!frame) { fail("Select a text frame for Line width."); }
        if (Math.abs(frame.absoluteRotationAngle) > .01 || Math.abs(frame.absoluteShearAngle) > .01 ||
                Math.abs(Number(frame.absoluteHorizontalScale) - 100) > .01 || Math.abs(Number(frame.absoluteVerticalScale) - 100) > .01) {
            fail("Line width requires an unrotated, unsheared frame at 100% scale.");
        }
        var pref = frame.textFramePreferences;
        if (pref.textColumnCount !== 1 || pref.useFixedColumnWidth || pref.useFlexibleColumnWidth) { fail("Line width requires one ordinary text column."); }
        if (pref.autoSizingType != AutoSizingTypeEnum.OFF) { fail("Turn off frame auto-sizing before using Line width."); }
        if (frame.paths.length !== 1) { fail("Line width requires a frame with one closed path."); }
        var inset = pref.insetSpacing, pad = Number(inset instanceof Array ? inset[0] : inset);
        if (inset instanceof Array) { for (var i = 1; i < inset.length; i++) { if (Math.abs(Number(inset[i]) - pad) > .001) { fail("Line width requires equal insets on all four sides."); } } }
        var b = frame.geometricBounds;
        return { bounds: [Number(b[0]), Number(b[1]), Number(b[2]), Number(b[3])], pad: pad,
            path: frame.paths.item(0).entirePath, type: Number(frame.paths.item(0).pathType) };
    }
    function widthInPoints(value, unit, usable) {
        return unit === "%" ? value * usable / 100 : (unit === "mm" ? value * 72 / 25.4 : value);
    }
    function widthPath(base, options, curve) {
        var b = base.bounds, usable = b[3] - b[1] - 2 * base.pad;
        var low = widthInPoints(options.min, options.unit, usable), high = widthInPoints(options.max, options.unit, usable);
        if (!(low >= 1 && high >= low && high <= usable + .01)) { fail("Line width must be at least 1 pt and no wider than the original usable frame (" + Math.round(usable * 100) / 100 + " pt)."); }
        var bands = options.steps || 12, count = options.smooth ? 97 : bands, widths = [], path = [], i;
        var sampleSettings = { property: "pointSize", min: low + 2 * base.pad, max: high + 2 * base.pad,
            curve: curve.curve, power: curve.power, width: curve.width, invert: curve.invert,
            points: curve.points, smooth: curve.smooth, steps: options.smooth ? 0 : bands };
        widths = buildDistribution(count, sampleSettings).values;
        function edge(i, right) {
            var w = widths[i], left = (b[1] + b[3] - w) / 2;
            if (options.anchor === "left") { left = b[1]; } else if (options.anchor === "right") { left = b[3] - w; }
            return left + (right ? w : 0);
        }
        if (options.smooth) {
            // Dense straight segments are deliberate: bounded samples cannot
            // introduce Bezier overshoot or self-intersections at sharp peaks.
            for (i = 0; i < count; i++) { path.push([edge(i, false), b[0] + (b[2] - b[0]) * i / (count - 1)]); }
            for (i = count - 1; i >= 0; i--) { path.push([edge(i, true), b[0] + (b[2] - b[0]) * i / (count - 1)]); }
        } else {
            for (i = 0; i < count; i++) { path.push([edge(i, false), b[0] + (b[2] - b[0]) * i / count]); path.push([edge(i, false), b[0] + (b[2] - b[0]) * (i + 1) / count]); }
            for (i = count - 1; i >= 0; i--) { path.push([edge(i, true), b[0] + (b[2] - b[0]) * (i + 1) / count]); path.push([edge(i, true), b[0] + (b[2] - b[0]) * i / count]); }
        }
        return { path: path, min: low, max: high };
    }
    function applyFrameWidth(target, settings) {
        var frame = target.frame, options = settings.frameWidth;
        if (!frame || !options) { return null; }
        var raw = frame.extractLabel(SHAPE_KEY), saved = raw ? decode(raw) : null;
        if (!options.enabled && !saved) { return null; }
        // Refuse stale geometry after a user has manually moved/reshaped the
        // frame, instead of jumping it back to a historic page position.
        if (saved && encode(frame.paths.item(0).entirePath) !== encode(saved.applied)) {
            fail("This frame was moved or reshaped after Line width. Undo that edit, or use a fresh frame as the base.");
        }
        var current = frameBase(frame), base = saved ? saved.base : current;
        if (!options.enabled) {
            frame.paths.item(0).entirePath = base.path; frame.paths.item(0).pathType = base.type;
            frame.insertLabel(SHAPE_KEY, ""); target.story.recompose(); return null;
        }
        var curve = options.linked ? settings : options.curve;
        var result = widthPath(base, options, curve);
        frame.paths.item(0).entirePath = result.path;
        frame.paths.item(0).pathType = PathType.CLOSED_PATH;
        frame.insertLabel(SHAPE_KEY, encode({ base: base, applied: frame.paths.item(0).entirePath, options: options }));
        target.story.recompose(); return result;
    }

    var LINE_LOCK_KEY = "TrackingRamp.v5.lineBreaks";
    function countAtOrBefore(indices, value) {
        var low = 0, high = indices.length;
        while (low < high) { var middle = Math.floor((low + high) / 2); if (indices[middle] <= value) { low = middle + 1; } else { high = middle; } }
        return low;
    }
    function remapSnapshot(rows, indices, removing) {
        var result = [];
        function add(start, end, values) {
            if (start > end) { return; }
            var a = countAtOrBefore(indices, start), z = countAtOrBefore(indices, end);
            result.push({ start: removing ? start - a : start + a, end: removing ? end - z : end + z, values: values });
        }
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i], start = row.start, first = countAtOrBefore(indices, start - 1);
            for (var b = first; b < indices.length && indices[b] <= row.end; b++) {
                add(start, indices[b] - 1, row.values); start = indices[b] + (removing ? 1 : 0);
            }
            add(start, row.end, row.values);
        }
        return result;
    }
    function remapBounds(bounds, indices, removing) {
        if (removing) { return { start: bounds.start - countAtOrBefore(indices, bounds.start - 1), end: bounds.end - countAtOrBefore(indices, bounds.end) }; }
        return { start: bounds.start + countAtOrBefore(indices, bounds.start), end: bounds.end + countAtOrBefore(indices, bounds.end) };
    }
    function remapHistory(history, indices, removing, before, after) {
        for (var property in history.effects) {
            var effect = history.effects[property];
            if (effect.signature === before) { effect.original = remapSnapshot(effect.original, indices, removing); effect.signature = after;
                if (effect.breaks) { for (var b = 0; b < effect.breaks.length; b++) { var position = effect.breaks[b].index; effect.breaks[b].index = removing ? position - countAtOrBefore(indices, position) : position + countAtOrBefore(indices, position); } }
            }
        }
    }
    function isSoftLineBreak(value) {
        if (value === "\n") { return true; }
        try { return value == SpecialCharacters.FORCED_LINE_BREAK; } catch (_) { return false; }
    }
    function restoreOwnedLineBreaks(story, history, scope, settings) {
        if (settings.textEnabled === false) { return; }
        var raw = story.extractLabel(LINE_LOCK_KEY); if (!raw) { return; }
        var saved = decode(raw); if (saved.property !== settings.property) { return; }
        if (!settings.replace) { story.insertLabel(LINE_LOCK_KEY, ""); return; }
        if (saved.version !== 1 || saved.signature !== signature(story)) { fail("Text changed after line breaks were fixed. Disable Replace to keep the current breaks and start a new baseline."); }
        var positions = saved.positions;
        for (var i = 0; i < positions.length; i++) {
            if (positions[i] < 0 || positions[i] >= story.characters.length || positions[i] !== Math.floor(positions[i]) ||
                    (i && positions[i] <= positions[i - 1]) || !isSoftLineBreak(story.characters.item(positions[i]).contents)) { fail("Saved fixed line breaks no longer match this story."); }
        }
        for (i = positions.length - 1; i >= 0; i--) { story.characters.item(positions[i]).remove(); }
        var after = signature(story); remapHistory(history, positions, true, saved.signature, after);
        if (scope.kind === "selection") { scope.bounds = remapBounds(scope.bounds, positions, true); }
        story.insertLabel(LINE_LOCK_KEY, ""); story.recompose(); return positions;
    }
    function fixTrackingLines(target, scope, fixedBounds, settings, baseline) {
        var story = target.story, seedBounds = boundsFor(target, scope), hyphens = [], offsets = [];
        if (!seedBounds) { fail("No visible text is available to fix line breaks."); }
        // Seed with the widest permitted tracking. Turning off automatic
        // hyphenation temporarily keeps new breaks at existing word gaps.
        if (scope.kind === "frame") { seedBounds = { start: seedBounds.start, end: story.characters.length - 1 }; }
        var paragraphs = story.characters.itemByRange(seedBounds.start, seedBounds.end).paragraphs.everyItem().getElements();
        try {
            for (var p = 0; p < paragraphs.length; p++) { hyphens.push({ paragraph: paragraphs[p], value: paragraphs[p].hyphenation }); paragraphs[p].hyphenation = false; }
            var seedSettings = { property: "tracking", mode: "word", target: settings.target, restart: "never", curve: "linear", min: settings.max, max: settings.max, steps: 0 };
            if (settings.clearTracking) { story.characters.itemByRange(seedBounds.start, seedBounds.end).tracking = 0; }
            var seed = makePlan(capture(story, seedBounds), seedSettings); applyValues(story, seed, target.document); story.recompose();
            var visible = boundsFor(target, scope); if (!visible) { fail("Max tracking leaves no visible line to fix. Reduce Max."); }
            if (scope.kind === "selection") { visible = fixedBounds; }
            var containers = scope.kind === "frame" ? [target.frame] : story.textContainers;
            for (var f = 0; f < containers.length; f++) {
                if (typeName(containers[f]) !== "TextFrame") { continue; }
                for (var l = 0; l < containers[f].lines.length; l++) {
                    var bounds = boundsOf(containers[f].lines.item(l));
                    if (!bounds || bounds.end < visible.start || bounds.end > visible.end) { continue; }
                    var end = story.characters.item(bounds.end).contents;
                    if (end === "\r" || isSoftLineBreak(end) || bounds.end === story.characters.length - 1) { continue; }
                    var offset = bounds.end + 1;
                    while (offset < story.characters.length && contentKind(story.characters.item(offset).contents) === "space") { offset++; }
                    if (scope.kind === "selection" && offset > visible.end + 1) { continue; }
                    // An unbreakable word wider than the frame needs a smaller
                    // Max; do not silently split a word or insert a new hyphen.
                    if (contentKind(story.characters.item(offset - 1).contents) === "text" && offset < story.characters.length && contentKind(story.characters.item(offset).contents) === "text") { continue; }
                    if (offset > visible.start && offset < story.characters.length) { offsets.push(offset); }
                }
            }
        } finally {
            restoreSnapshot(story, baseline, target.document);
            for (var h = 0; h < hyphens.length; h++) { hyphens[h].paragraph.hyphenation = hyphens[h].value; }
            story.recompose();
        }
        offsets.sort(function (a, b) { return a - b; });
        var unique = [];
        for (var i = 0; i < offsets.length; i++) { if (!i || offsets[i] !== offsets[i - 1]) { unique.push(offsets[i]); } }
        if (!unique.length) { fail("No safe word boundaries are available to fix these lines. Reduce Max or use a larger scope."); }
        var before = signature(story);
        for (i = unique.length - 1; i >= 0; i--) { story.insertionPoints.item(unique[i]).contents = "\n"; }
        var positions = []; for (i = 0; i < unique.length; i++) { positions.push(unique[i] + i); }
        story.insertLabel(LINE_LOCK_KEY, encode({ version: 1, property: settings.property, signature: signature(story), positions: positions }));
        story.recompose(); return { offsets: unique, positions: positions, before: before, after: signature(story) };
    }
    function clearedFramePlan(plan) {
        var units = [{ spans: [{ start: plan.data.bounds.start, end: plan.data.bounds.end }] }], values = [0];
        for (var i = 0; i < plan.units.length; i++) { units.push(plan.units[i]); values.push(plan.distribution.values[i]); }
        return { settings: plan.settings, units: units, distribution: { values: values } };
    }
    // Line-length composition is isolated from the character-property solver.
    // Whitespace is replaced, rather than deleted/inserted: character indices
    // and formatting histories remain stable, including kept numeric stages.
    function centeredLineInsets(usable, percent) {
        if (!(usable > 0 && percent >= 1 && percent <= 100 && usable * percent / 100 >= 1)) { fail("Line length must be 1–100% and leave at least 1 pt of usable width."); }
        var inset = usable * (1 - percent / 100) / 2;
        return { leftIndent: inset, rightIndent: inset };
    }
    function layoutLineLengths(adapter, settings, initialCount) {
        var count = Math.max(1, initialCount), seen = {}, result;
        for (var pass = 1; pass <= 8; pass++) {
            seen[count] = true; adapter.reset();
            var distribution = buildDistribution(count, settings), rows = [], values = [], row;
            for (var i = 0; i < 2000; i++) {
                var percent = distribution.values[Math.min(i, distribution.values.length - 1)];
                row = adapter.next(percent); if (!row) { break; }
                rows.push(row); values.push(percent);
            }
            if (i === 2000) { fail("Line length is limited to 2000 visible rows per frame."); }
            if (!rows.length) { fail("No text fits at this line length. Increase Min or enlarge the frame."); }
            result = { rows: rows, values: values, distribution: distribution, passes: pass, fixedSampling: false };
            if (rows.length === count) { return result; }
            if (seen[rows.length] || pass === 8) {
                if (settings.autoStabilize === false) { fail("Line length composition oscillates. Enable Auto-stabilize or change the curve/range."); }
                result.fixedSampling = true; return result;
            }
            count = rows.length;
        }
        return result;
    }
    function retagTextHistory(story, history, before, after) {
        for (var key in history.effects) { if (history.effects[key].signature === before) { history.effects[key].signature = after; } }
        var raw = story.extractLabel(LINE_LOCK_KEY);
        if (raw) { var locks = decode(raw); if (locks.signature === before) { locks.signature = after; story.insertLabel(LINE_LOCK_KEY, encode(locks)); } }
    }
    function restoreLengthBreaks(story, history, settings) {
        var effect = history.effects.lineLength;
        if (settings.property !== "lineLength" || settings.textEnabled === false || !effect || !effect.breaks || !settings.replace) { return; }
        var before = signature(story);
        if (effect.signature !== before) { fail("Text changed after Line length. Disable Replace to keep the current paragraphs and start a new baseline."); }
        for (var i = 0; i < effect.breaks.length; i++) {
            var b = effect.breaks[i];
            if (b.index < 0 || b.index >= story.characters.length || b.index !== Math.floor(b.index) ||
                    story.characters.item(b.index).contents !== "\r" || (i && b.index <= effect.breaks[i - 1].index) || typeof b.contents !== "string" || !/^[ \t\n]$/.test(b.contents)) { fail("Saved Line length paragraphs no longer match this story."); }
        }
        for (i = effect.breaks.length - 1; i >= 0; i--) { var saved = effect.breaks[i]; story.characters.item(saved.index).contents = saved.contents; }
        retagTextHistory(story, history, before, signature(story)); story.recompose();
    }
    function lineLengthFrame(target) {
        var frame = target.frame, story = target.story;
        if (!frame || story.textContainers.length !== 1 || typeName(story.textContainers[0]) !== "TextFrame") { fail("Line length currently requires one unthreaded text frame."); }
        var base = frameBase(frame), path = base.path;
        if (frame.extractLabel(SHAPE_KEY) || path.length !== 4) { fail("Line length requires a rectangular frame. Disable its Line width contour first."); }
        for (var i = 0; i < path.length; i++) {
            if (path[i].length !== 2 || path[i][0] instanceof Array ||
                    (Math.abs(path[i][0] - base.bounds[1]) > .01 && Math.abs(path[i][0] - base.bounds[3]) > .01) ||
                    (Math.abs(path[i][1] - base.bounds[0]) > .01 && Math.abs(path[i][1] - base.bounds[2]) > .01)) { fail("Line length requires a rectangular frame."); }
        }
        var paragraphs = story.paragraphs.everyItem().getElements();
        for (i = 0; i < paragraphs.length; i++) {
            if (paragraphs[i].bulletsAndNumberingListType != ListType.NO_LIST || (paragraphs[i].dropCapCharacters > 0 && paragraphs[i].dropCapLines > 1)) { fail("Line length currently supports ordinary paragraphs without automatic lists or drop caps."); }
        }
        return { frame: frame, usable: base.bounds[3] - base.bounds[1] - 2 * base.pad };
    }
    function applyLineLength(target, settings, original, history) {
        var story = target.story, doc = target.document, geometry = lineLengthFrame(target), frame = geometry.frame;
        if (settings.min > settings.max) { fail("Line length Min must not exceed Max."); }
        centeredLineInsets(geometry.usable, settings.min); centeredLineInsets(geometry.usable, settings.max);
        var breaks = [], cursor = 0, touchedEnd = -1, initial = frame.lines.length;
        var before = signature(story);
        function reset() {
            for (var b = breaks.length - 1; b >= 0; b--) { story.characters.item(breaks[b].index).contents = breaks[b].contents; }
            breaks = []; restoreSnapshot(story, original, doc); story.recompose(); cursor = 0; touchedEnd = -1;
        }
        var fitted = layoutLineLengths({ reset: reset, next: function (percent) {
            if (cursor >= story.characters.length) { return null; }
            var visible = visibleBounds(frame); if (!visible || cursor > visible.end) { return null; }
            var paragraph = story.characters.item(cursor).paragraphs.firstItem().getElements()[0], pb = boundsOf(paragraph);
            if (pb.start !== cursor) { fail("Line length could not isolate the next paragraph."); }
            var savedBefore = Number(paragraph.spaceBefore), savedAfter = Number(paragraph.spaceAfter), savedJustification = paragraph.justification;
            var insets = centeredLineInsets(geometry.usable, percent);
            paragraph.properties = { leftIndent: insets.leftIndent, rightIndent: insets.rightIndent, firstLineIndent: 0, lastLineIndent: 0,
                spaceBefore: savedBefore, spaceAfter: 0, hyphenation: false, keepWithNext: 0, keepAllLinesTogether: false, keepLinesTogether: false, startParagraph: StartParagraph.ANYWHERE };
            story.recompose(); visible = visibleBounds(frame);
            if (!visible || cursor > visible.end) { restoreSnapshot(story, filterSnapshot(original, touchedIndices([{ spans: [pb] }])), doc); story.recompose(); return null; }
            var lines = frame.lines, line = null;
            for (var l = 0; l < lines.length; l++) { var lb = boundsOf(lines.item(l)); if (lb && lb.start === cursor) { line = lb; break; } }
            if (!line) { fail("Line length could not measure the next visible row."); }
            var inkStart = line.start, inkEnd = line.end;
            while (inkStart <= inkEnd && contentKind(story.characters.item(inkStart).contents) !== "text") { inkStart++; }
            while (inkEnd >= inkStart && contentKind(story.characters.item(inkEnd).contents) !== "text") { inkEnd--; }
            if (inkStart <= inkEnd) {
                var measured;
                try { measured = Math.abs(Number(story.characters.item(inkEnd).endHorizontalOffset) - Number(story.characters.item(inkStart).horizontalOffset)); }
                catch (_) { fail("A word cannot fit this line length without splitting. Increase Min or reduce the font size."); }
                if (!isFinite(measured) || measured > geometry.usable * percent / 100 + .5) { fail("A word cannot fit this line length without splitting. Increase Min or reduce the font size."); }
            }
            var end = line.end, boundary = -1, replacement = "", last = story.characters.item(end).contents;
            if (last === "\r" || end === story.characters.length - 1) { boundary = end; }
            else {
                // Prefer the last breakable space already composed in this row.
                if (last === " " || last === "\t" || isSoftLineBreak(last)) { boundary = end; replacement = isSoftLineBreak(last) ? "\n" : last; }
                else if (end + 1 < story.characters.length) {
                    var next = story.characters.item(end + 1).contents;
                    if (next === " " || next === "\t" || isSoftLineBreak(next)) { boundary = end + 1; replacement = isSoftLineBreak(next) ? "\n" : next; }
                }
                if (boundary < 0) { fail("A word cannot fit this line length without splitting. Increase Min or reduce the font size."); }
            }
            if (replacement) {
                breaks.push({ index: boundary, contents: replacement }); story.characters.item(boundary).contents = "\r";
                var following = story.characters.item(boundary + 1).paragraphs.firstItem().getElements()[0];
                following.spaceBefore = 0; following.spaceAfter = savedAfter; following.justification = savedJustification;
                if (savedJustification == Justification.LEFT_JUSTIFIED || savedJustification == Justification.CENTER_JUSTIFIED || savedJustification == Justification.RIGHT_JUSTIFIED) { paragraph.justification = Justification.FULLY_JUSTIFIED; }
            } else { paragraph.spaceAfter = savedAfter; }
            // Original paragraph spacing survives only at its outer edges.
            cursor = boundary + 1; touchedEnd = boundary; story.recompose();
            var result = { spans: [{ start: line.start, end: boundary }], percent: percent };
            if (!replacement && last !== "\r" && boundary === story.characters.length - 1) { cursor = story.characters.length; }
            return result;
        } }, settings, initial);
        // The outgoing remainder is a separate paragraph: restore its baseline
        // instead of leaving the most recently tried width on overset text.
        if (cursor < story.characters.length) {
            restoreSnapshot(story, filterSnapshot(original, touchedIndices([{ spans: [{ start: cursor, end: story.characters.length - 1 }] }])), doc); story.recompose();
        }
        retagTextHistory(story, history, before, signature(story));
        var data = capture(story, visibleBounds(frame)), distribution = fitted.distribution, sampleCount = distribution.values.length;
        distribution.values = fitted.values; distribution.minSteps = distribution.steps;
        var group = { start: 0, end: touchedEnd, structureIndex: 0, count: fitted.rows.length, offset: 0, distribution: distribution };
        var plan = { settings: settings, data: data, units: fitted.rows, groups: [group], distribution: distribution,
            passes: fitted.passes, composition: true, fixedSampling: fitted.fixedSampling, lineLength: true, sampleCount: sampleCount,
            shortGroups: distribution.steps < 3 ? 1 : 0, managedParagraphs: breaks.length, breaks: breaks, textEdits: [] };
        history.effects.lineLength = { signature: signature(story), original: filterSnapshot(original, touchedIndices(fitted.rows)), settings: settings, breaks: breaks };
        story.insertLabel(HISTORY_KEY, encode(history));
        plan.metricsFrames = settings.metrics ? addMetrics(target, plan) : 0;
        return plan;
    }

    function allowsLineBreaks(settings) {
        // Preserve explicitly saved v5 break policies; every new UI draft
        // writes allowLineBreaks, so Auto-stabilize no longer implies consent.
        return settings.allowLineBreaks === true || (settings.allowLineBreaks === undefined && settings.lockLines === true);
    }
    function hasLineLengthShape(frame) {
        var raw = frame ? frame.extractLabel(SHAPE_KEY) : "";
        return !!raw && decode(raw).options.owner === "lineLength";
    }
    function restoreLineLengthShape(target) {
        if (hasLineLengthShape(target.frame)) { applyFrameWidth(target, { frameWidth: { enabled: false } }); }
    }
    function applyUnbrokenLineLength(target, settings, history) {
        var geometry = lineLengthFrame(target), base = frameBase(target.frame), story = target.story;
        if (settings.min > settings.max) { fail("Line length Min must not exceed Max."); }
        centeredLineInsets(geometry.usable, settings.min); centeredLineInsets(geometry.usable, settings.max);
        if (settings.steps > 200) { fail("Line length without added breaks supports up to 200 contour steps. Use Auto steps or a smaller step count."); }
        var options = { enabled: true, linked: true, min: settings.min, max: settings.max, unit: "%", anchor: "center",
            smooth: !settings.steps, steps: settings.steps || 12, curve: decode(encode(settings)), owner: "lineLength" };
        var shape = applyFrameWidth(target, { frameWidth: options, curve: settings.curve, power: settings.power, width: settings.width,
            invert: settings.invert, points: settings.points, smooth: settings.smooth });
        var bounds = visibleBounds(target.frame); if (!bounds) { fail("No text fits in this line-length contour. Increase Min or enlarge the frame."); }
        var plan = makePlan(capture(story, bounds), settings);
        // Contours run down the frame, rather than restarting at the last row.
        // Show the widths sampled at the actual row positions in the readout.
        var values = [], bands = settings.steps ? buildDistribution(settings.steps, settings).values : null;
        for (var i = 0; i < plan.units.length; i++) {
            var fraction = Math.max(0, Math.min(1, (Number(story.characters.item(plan.units[i].spans[0].start).baseline) - base.bounds[0]) / (base.bounds[2] - base.bounds[0]))), value;
            if (bands) { value = bands[Math.min(bands.length - 1, Math.floor(fraction * bands.length))]; }
            else { var weight = curveValue(fraction, settings); if (settings.invert) { weight = 1 - weight; } value = settings.min + (settings.max - settings.min) * weight; }
            values.push(Math.round(value * 1000) / 1000);
        }
        plan.distribution.values = values; if (plan.groups.length) { plan.groups[0].distribution.values = values; }
        plan.lineLength = true; plan.lineLengthContour = true; plan.managedParagraphs = 0;
        plan.breaks = []; plan.textEdits = []; plan.passes = 1; plan.composition = true; plan.frameWidth = shape;
        history.effects.lineLength = { signature: signature(story), original: [], settings: settings, breaks: [] };
        story.insertLabel(HISTORY_KEY, encode(history));
        plan.metricsFrames = settings.metrics ? addMetrics(target, plan) : 0;
        return plan;
    }

    function applyEffect(target, settings) {
        settings = prepareStyleBlend(effectiveSettings(settings), target.document);
        var story = target.story, doc = target.document;
        var history = { version: 3, effects: {} }, raw = story.extractLabel(HISTORY_KEY);
        if (raw) { history = decode(raw); if (history.version !== 3 || !history.effects) { fail("Unsupported saved effect history."); } }
        var selectedScope = target.scopes[settings.scope], scope = { kind: selectedScope.kind, bounds: selectedScope.bounds };
        if (settings.property === "lineLength" && settings.textEnabled !== false && scope.kind !== "frame") { fail("Line length uses Current frame scope."); }
        restoreLengthBreaks(story, history, settings);
        var removedBreaks = restoreOwnedLineBreaks(story, history, scope, settings), textEdits = [];
        if (removedBreaks) { textEdits.push({ positions: removedBreaks, removing: true }); }
        var effectKey = settings.property;
        var previous = history.effects[effectKey];
        if (settings.textEnabled !== false && settings.replace && previous) {
            if (previous.signature !== signature(story)) { fail("Text changed since the previous effect. Disable Replace previous effect to start a new baseline."); }
            restoreSnapshot(story, previous.original, doc);
            // Both underline effects share the activation flag. Replacing one
            // must retain underlining owned by the other valid effect.
            if (/^underline/.test(settings.property)) {
                var otherKey = settings.property === "underlineWeight" ? "underlineOffset" : "underlineWeight";
                var other = history.effects[otherKey];
                if (other && other.signature === signature(story)) {
                    for (var u = 0; u < other.original.length; u++) {
                        var owned = other.original[u]; story.characters.itemByRange(owned.start, owned.end).underline = true;
                    }
                }
            }
            story.recompose();
        }
        if (settings.property === "lineLength" && settings.textEnabled !== false) { restoreLineLengthShape(target); }
        var numericBlend=settings.property==="styleBlend";
        if(numericBlend){for(var nb=0;nb<settings.blendDefinition.attributes.length;nb++){if(settings.blendDefinition.attributes[nb].kind!=="number"){numericBlend=false;break;}}}
        var replaySafe = settings.textEnabled !== false && (numericBlend || /^(tracking|pointSize|baselineShift|horizontalScale|verticalScale|characterRotation|skew|underlineWeight|underlineOffset|leftIndent|rightIndent|firstLineIndent)$/.test(settings.property)) &&
            (!settings.frameWidth || (!settings.frameWidth.enabled && (!target.frame || !target.frame.extractLabel(SHAPE_KEY))));
        var frameWidthResult = applyFrameWidth(target, settings);
        removeMetrics(doc, story.id,story.extractLabel(OWNER_KEY));
        var bounds = boundsFor(target, scope);
        if (!bounds && settings.textEnabled === false) { bounds = boundsOf(story); }
        if (!bounds) { fail("This frame has no visible text. Choose Entire story."); }
        var properties = propertiesFor(settings);
        var original = takeSnapshot(story, properties, scope.kind === "selection" && !isParagraphProperty(settings.property) ? bounds : null);
        if (settings.property === "lineLength" && settings.textEnabled !== false) { return allowsLineBreaks(settings) ? applyLineLength(target, settings, original, history) : applyUnbrokenLineLength(target, settings, history); }
        var cleared = null;
        if (settings.textEnabled !== false && settings.property === "tracking" && settings.clearTracking) {
            cleared = { start: bounds.start, end: bounds.end };
            story.characters.itemByRange(bounds.start, bounds.end).tracking = 0; story.recompose();
        }
        var liveClear = !!cleared && scope.kind === "frame", baseline = original;
        if (cleared && !liveClear) { baseline = takeSnapshot(story, properties); }
        var fixedBounds = boundsFor(target, scope) || (settings.textEnabled === false ? bounds : null);
        function currentData() {
            var b = fixedBounds;
            if (scope.kind === "frame") { b = boundsFor(target, scope); }
            if (!b) { fail("The current composition has no visible lines in this frame."); }
            return captureEffect(story, b, settings);
        }
        var plan;
        if (settings.textEnabled === false) { plan = makePlan(currentData(), settings); }
        else if (scope.kind === "frame" || usesComposition(settings)) {
            var iterationTouched = {}, baselineTracking = null;
            if (liveClear) { iterationTouched = touchedIndices([{ spans: [cleared] }]); }
            function solveComposition() { return settleLines({ capture: currentData, restore: function () { restoreSnapshot(story, filterSnapshot(baseline, iterationTouched), doc); },
                apply: function (p) { var actual = liveClear ? clearedFramePlan(p) : p; iterationTouched = touchedIndices(actual.units); applyValues(story, actual, doc, baseline); },
                matches: settings.property === "tracking" ? function (applied, desired) {
                    if (baselineTracking === null) {
                        baselineTracking = {};
                        for (var row = 0; row < baseline.length; row++) {
                            for (var index = baseline[row].start; index <= baseline[row].end; index++) { baselineTracking[index] = baseline[row].values.tracking; }
                        }
                    }
                    if (liveClear) { applied = clearedFramePlan(applied); desired = clearedFramePlan(desired); }
                    return trackingPlansEquivalent(applied, desired, baselineTracking);
                } : null, recompose: function () { story.recompose(); } }, settings); }
            try { plan = solveComposition(); }
            catch (compositionError) {
                var lineCurve = settings.mode === "line" || settings.restart === "line";
                var tryBreaks = allowsLineBreaks(settings) && settings.property === "tracking" && (lineCurve || settings.autoStabilize);
                if (!compositionFailure(compositionError) || (!settings.autoStabilize && !tryBreaks)) { throw compositionError; }
                restoreSnapshot(story, baseline, doc); story.recompose();
                var locks = null;
                if (tryBreaks) {
                    try {
                        locks = fixTrackingLines(target, scope, fixedBounds, settings, baseline);
                        original = remapSnapshot(original, locks.offsets, false); baseline = remapSnapshot(baseline, locks.offsets, false);
                        remapHistory(history, locks.offsets, false, locks.before, locks.after);
                        if (scope.kind === "story") { fixedBounds = boundsOf(story); }
                        else if (scope.kind === "selection") { fixedBounds = remapBounds(fixedBounds, locks.offsets, false); }
                        if (cleared) { cleared = remapBounds(cleared, locks.offsets, false); }
                        iterationTouched = {}; baselineTracking = null;
                        plan = solveComposition(); plan.lockedBreaks = locks.positions.length;
                        textEdits.push({ positions: locks.offsets, removing: false });
                    } catch (breakError) {
                        if (!settings.autoStabilize || (!compositionFailure(breakError) && !/No safe word boundaries|Max tracking leaves no visible/.test(breakError.message))) { throw breakError; }
                        if (locks) {
                            restoreSnapshot(story, baseline, doc);
                            restoreOwnedLineBreaks(story, history, scope, { property: settings.property, replace: true, textEnabled: true });
                            original = remapSnapshot(original, locks.positions, true); baseline = remapSnapshot(baseline, locks.positions, true);
                            if (scope.kind === "story") { fixedBounds = boundsOf(story); }
                            else if (scope.kind === "selection") { fixedBounds = remapBounds(fixedBounds, locks.positions, true); }
                            if (cleared) { cleared = remapBounds(cleared, locks.positions, true); }
                            iterationTouched = {}; baselineTracking = null;
                        }
                    }
                }
                if (!plan) {
                    plan = fixedSampling({ capture: currentData, restore: function () { restoreSnapshot(story, baseline, doc); },
                        apply: function (p) { applyValues(story, liveClear ? clearedFramePlan(p) : p, doc, baseline); },
                        recompose: function () { story.recompose(); } }, settings, scope.kind === "frame");
                }
            }
            plan.composition = true;
        } else { plan = makePlan(currentData(), settings); applyValues(story, plan, doc, baseline); story.recompose(); }
        var touched = touchedIndices(plan.units);
        if (liveClear) { cleared = plan.fixedSampling ? plan.sampleBounds : plan.data.bounds; }
        if (cleared) { for (var i = cleared.start; i <= cleared.end; i++) { touched[i] = true; } }
        // An explicit clear establishes a new zero baseline for future
        // replacement runs. The surrounding Undo transaction still restores
        // the pre-clear document exactly on Cancel or manual Undo.
        var historyBaseline = original;
        if (settings.textEnabled !== false && settings.property === "tracking" && settings.clearTracking) {
            historyBaseline = baseline;
            if (liveClear) { historyBaseline = [{ start: cleared.start, end: cleared.end, values: { tracking: 0 } }]; }
        }
        var saved = styleBlendSavedSnapshot(filterSnapshot(historyBaseline, touched), plan);
        if (settings.textEnabled !== false) { history.effects[effectKey] = { signature: signature(story), original: saved, settings: settings }; }
        var historyText = encode(history); story.insertLabel(HISTORY_KEY, historyText);
        var existingLocks = story.extractLabel(LINE_LOCK_KEY);
        if (existingLocks && !plan.lockedBreaks) { var lineLocks = decode(existingLocks); if (lineLocks.signature === signature(story)) { plan.lockedBreaks = lineLocks.positions.length; } }
        plan.textEdits = textEdits;
        if (replaySafe && !textEdits.length) {
            var replayTouched = {}, index;
            for (index in touched) { replayTouched[index] = true; }
            if (settings.replace && previous) {
                for (var oldRow = 0; oldRow < previous.original.length; oldRow++) {
                    for (index = previous.original[oldRow].start; index <= previous.original[oldRow].end; index++) { replayTouched[index] = true; }
                }
            }
            plan.replay = { touched: replayTouched, history: historyText, locks: existingLocks || "", signature: history.effects[effectKey].signature };
        }
        plan.frameWidth = frameWidthResult;
        plan.metricsFrames = settings.metrics ? addMetrics(target, plan) : 0;
        return plan;
    }

    function sessionTarget(target) {
        var scopes = [];
        for (var i = 0; i < target.scopes.length; i++) {
            var source = target.scopes[i], copy = {};
            for (var key in source) { copy[key] = source[key]; }
            if (source.bounds) { copy.bounds = { start: source.bounds.start, end: source.bounds.end }; }
            scopes.push(copy);
        }
        return { document: target.document, story: target.story, frame: target.frame, scopes: scopes };
    }
    function advanceScopes(target, plan) {
        var edits = plan.textEdits || [];
        for (var e = 0; e < edits.length; e++) {
            for (var s = 0; s < target.scopes.length; s++) {
                if (target.scopes[s].kind === "selection") { target.scopes[s].bounds = remapBounds(target.scopes[s].bounds, edits[e].positions, edits[e].removing); }
            }
        }
    }
    var SETUP_KEY="TrackingRamp.v8.setup", OWNER_KEY="TrackingRamp.v8.owner";
    function textStamp(text) {
        var hash=2166136261;for(var i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=(hash+(hash<<1)+(hash<<4)+(hash<<7)+(hash<<8)+(hash<<24))|0;}return text.length+":"+hash;
    }
    function recipeSettings(settings, doc) {
        var copy=decode(encode(settings));delete copy.blendDefinition;delete copy.blendBaseline;
        if(doc && /^(fillColor|strokeColor)$/.test(copy.property)){try{copy.colorAName=String(doc.swatches.itemByID(copy.colorA).name);copy.colorBName=String(doc.swatches.itemByID(copy.colorB).name);}catch(_){}}
        if(copy.property==="styleBlend" && !copy.missingStyle){copy.missingStyle="skip";}return copy;
    }
    function setupFrameToken(frame) {try{return frame?frame.extractLabel(OWNER_KEY):"";}catch(_){return "";}}
    function readEarlierSetup(target) {
        var raw=target.story.extractLabel(HISTORY_KEY);if(!raw){return {status:"none",message:"",recipe:null};}
        try{
            var history=decode(raw),effects=[];if(history.version!==3 || !history.effects){fail("Earlier effect history cannot be read. Forget it to adopt the current appearance.");}
            for(var key in history.effects){effects.push(history.effects[key]);}
            if(!effects.length){return {status:"none",message:"",recipe:null};}
            for(var i=0;i<effects.length;i++){if(effects[i].signature!==signature(target.story)){fail("Text changed since the earlier effect. Forget saved setup to adopt this appearance.");}}
            if(target.story.textContainers.length>1){fail("Earlier linked-story effects have no saved frame owner. Forget saved setup to adopt the current appearance before applying v8.");}
            var settings=null;
            if(effects.length===1){var cfg=effects[0].settings;if(cfg && cfg.mode && cfg.curve && typeof cfg.min==="number" && typeof cfg.max==="number"){
                propertyInfo(cfg.property);settings=recipeSettings(cfg);if(typeof settings.scope!=="number" || !target.scopes[settings.scope]){settings.scope=0;}
            }}
            return {status:"legacy",recipe:null,settings:settings,message:settings?"Earlier setup loaded — review scope.":"Earlier effects found. Stack order is unavailable; rebuild the sequence to save a v8 setup."};
        }catch(e){return {status:"blocked",message:e.message,recipe:null};}
    }
    function readSavedSetup(target) {
        var raw=target.story.extractLabel(SETUP_KEY);if(!raw){return readEarlierSetup(target);}
        try{
            var r=decode(raw);
            if(r.version!==1 || !(r.stages instanceof Array) || !r.stages.length){fail("Saved setup has an unsupported format. Forget it to start from the current appearance.");}
            if(r.signature!==signature(target.story)){fail("Text changed since this setup was applied. Forget the saved setup to keep the current appearance and start again.");}
            if(r.historyStamp!==textStamp(target.story.extractLabel(HISTORY_KEY))){fail("Formatting history changed since this setup was saved. Forget the saved setup before replacing it.");}
            if(r.owner && r.owner.token!==setupFrameToken(target.frame)){fail("Saved setup belongs to another linked frame"+(r.owner.name?" ("+r.owner.name+")":"")+". Select that frame, or Forget saved setup to keep this appearance and start again.");}
            if(r.owner){var owners=0,frames=target.story.textContainers;for(var o=0;o<frames.length;o++){if(setupFrameToken(frames[o])===r.owner.token){owners++;}}if(owners>1){fail("Multiple linked frames share this saved owner. Forget the setup before starting again.");}}
            var seen={};for(var i=0;i<r.stages.length;i++){
                var stage=r.stages[i],cfg=stage.settings;propertyInfo(cfg.property);
                if(seen[cfg.property]){fail("Saved setup contains repeated properties.");}seen[cfg.property]=true;
                if(!stage.scope || !/^(story|frame|selection)$/.test(stage.scope.kind)){fail("Saved scope is unavailable.");}
                if(stage.scope.kind==="selection" && (!stage.scope.bounds || stage.scope.bounds.start<0 || stage.scope.bounds.end>=target.story.characters.length || stage.scope.bounds.end<stage.scope.bounds.start)){fail("Saved highlighted range no longer matches this text.");}
                var incoming=null;for(var k=0;k<target.scopes.length;k++){if(target.scopes[k].kind==="selection"){incoming=target.scopes[k].bounds;}}
                if(incoming && (stage.scope.kind!=="selection" || encode(incoming)!==encode(stage.scope.bounds))){fail("This selection differs from the saved setup. Select the whole owning frame to reload its saved range.");}
            }
            return {status:"loaded",message:"Saved setup loaded",recipe:r};
        }catch(e){return {status:"blocked",message:e.message,recipe:null};}
    }
    function mapSetupStages(target, recipe) {
        var stages=[];
        for(var i=0;i<recipe.stages.length;i++){
            var original=recipe.stages[i],cfg=recipeSettings(original.settings),scope=original.scope,index=-1;
            for(var j=0;j<target.scopes.length;j++){if(target.scopes[j].kind===scope.kind && (scope.kind!=="selection" || encode(target.scopes[j].bounds)===encode(scope.bounds))){index=j;break;}}
            if(index<0 && scope.kind==="selection"){index=target.scopes.length;target.scopes.push({kind:"selection",bounds:decode(encode(scope.bounds)),label:"Saved highlighted text"});}
            if(index<0){fail("The saved scope is unavailable in this frame.");}cfg.scope=index;
            if(/^(fillColor|strokeColor)$/.test(cfg.property)){for(var c=0;c<2;c++){var field=c?"colorB":"colorA",name=cfg[field+"Name"];if(name){var color=target.document.swatches.itemByName(name);if(!color.isValid){fail("A saved endpoint color was renamed or deleted. Choose its replacement before reapplying.");}cfg[field]=color.id;}}}
            stages.push(cfg);
        }
        return stages;
    }
    function ensureSetupTokens(target) {
        if(target.frame && !setupFrameToken(target.frame)){target.frame.insertLabel(OWNER_KEY,String(new Date().getTime())+":"+String(Math.random()));}
        if(!target.story.extractLabel(OWNER_KEY)){target.story.insertLabel(OWNER_KEY,String(new Date().getTime())+":"+String(Math.random()));}
    }
    function writeSavedSetup(session, settings) {
        var target=session.liveTarget,frame=target.frame,stages=[],items=[];
        for(var i=0;i<session.stages.length;i++){items.push(session.stages[i].settings);}if(settings){items.push(settings);}
        for(i=0;i<items.length;i++){
            var scope=target.scopes[items[i].scope];if(!scope){fail("Cannot save an unavailable scope.");}
            stages.push({settings:recipeSettings(items[i],target.document),scope:{kind:scope.kind,bounds:scope.kind==="selection"?scope.bounds:null}});
        }
        var token=setupFrameToken(frame),owner=null;
        if(frame){if(!token){token=String(new Date().getTime())+":"+String(Math.random());frame.insertLabel(OWNER_KEY,token);}owner={token:token,name:String(frame.name||"Text frame")};}
        target.story.insertLabel(SETUP_KEY,encode({version:1,signature:signature(target.story),owner:owner,stages:stages,historyStamp:textStamp(target.story.extractLabel(HISTORY_KEY))}));
    }
    function resetSavedSetup(target, recipe) {
        var story=target.story,doc=target.document;
        if(signature(story)!==recipe.signature || textStamp(story.extractLabel(HISTORY_KEY))!==recipe.historyStamp){fail("The saved setup no longer matches this text. Forget it before starting a new setup.");}
        var rawHistory=story.extractLabel(HISTORY_KEY),history=rawHistory?decode(rawHistory):{version:3,effects:{}},scope={kind:"story",bounds:boundsOf(story)};
        for(var i=recipe.stages.length-1;i>=0;i--){
            var cfg=recipe.stages[i].settings,key=cfg.property,effect=history.effects[key];
            if(cfg.textEnabled!==false){
                if(!effect){fail("The saved effect baseline is unavailable for "+propertyInfo(key).label+".");}
                restoreLengthBreaks(story,history,{property:key,textEnabled:true,replace:true});
                var removed=restoreOwnedLineBreaks(story,history,scope,{property:key,textEnabled:true,replace:true});
                if(removed){for(var k=0;k<target.scopes.length;k++){if(target.scopes[k].kind==="selection"){target.scopes[k].bounds=remapBounds(target.scopes[k].bounds,removed,true);}}}
                restoreSnapshot(story,effect.original,doc);delete history.effects[key];
            }
            if(key==="lineLength"){restoreLineLengthShape(target);}
            if(cfg.frameWidth && cfg.frameWidth.enabled){applyFrameWidth(target,{frameWidth:{enabled:false}});}
        }
        story.insertLabel(HISTORY_KEY,encode(history));removeMetrics(doc,story.id,story.extractLabel(OWNER_KEY));story.recompose();
    }
    function forgetSavedSetup(target) {
        // Forgetting adopts current text, managed breaks and frame shape as-is.
        // The named Undo restores only ownership/recipe labels, not formatting.
        app.doScript(function(){
            target.story.insertLabel(SETUP_KEY,"");target.story.insertLabel(HISTORY_KEY,"");target.story.insertLabel(LINE_LOCK_KEY,"");
            var frames=target.story.textContainers;for(var i=0;i<frames.length;i++){if(typeName(frames[i])==="TextFrame"){frames[i].insertLabel(SHAPE_KEY,"");}}
        },ScriptLanguage.JAVASCRIPT,undefined,UndoModes.ENTIRE_SCRIPT,TITLE+" — Forget saved setup");
    }
    function PreviewSession(target) {
        this.target = target; this.active = false; this.result = null; this.token = ""; this.committed = false;
        this.stages = []; this.cacheKey = ""; this.liveTarget = null; this.savedRecipe = null;
    }
    PreviewSession.prototype.load = function(recipe) {
        if(this.active || this.stages.length){fail("Load a saved setup before starting a preview.");}
        this.savedRecipe=decode(encode(recipe));var mapped=mapSetupStages(this.target,recipe);
        for(var i=0;i<mapped.length-1;i++){this.stages.push({settings:mapped[i],frozen:null,patch:null,replay:null,plan:null});}
        return mapped[mapped.length-1];
    };
    PreviewSession.prototype.hasProperty = function (id) {
        for (var i = 0; i < this.stages.length; i++) { if (this.stages[i].settings.property === id) { return true; } }
        return false;
    };
    PreviewSession.prototype.hasKeptWidth = function () {
        for (var i = 0; i < this.stages.length; i++) { if (this.stages[i].settings.property === "lineLength" || (this.stages[i].settings.frameWidth && this.stages[i].settings.frameWidth.enabled)) { return true; } }
        return false;
    };
    PreviewSession.prototype.rollback = function () {
        if (!this.active) { return; }
        if (this.target.document.undoName !== TITLE || this.target.story.extractLabel(TOKEN_KEY) !== this.token) {
            fail("The document's Undo state changed outside this preview. Use Undo to restore the preview before continuing.");
        }
        this.target.document.undo(); this.active = false; this.result = null; this.liveTarget = null;
    };
    PreviewSession.prototype.preview = function (settings) {
        settings = settings ? prepareStyleBlend(effectiveSettings(settings), this.target.document) : null;
        if (settings && settings.textEnabled !== false && this.hasProperty(settings.property)) { fail("This property is already kept. Undo the last addition to edit it."); }
        if (!settings && !this.stages.length) { this.rollback(); return null; }
        var key = encode(settings);
        if (this.active && this.result && this.cacheKey === key &&
                this.target.document.undoName === TITLE && this.target.story.extractLabel(TOKEN_KEY) === this.token) { return this.result; }
        this.rollback();
        var self = this, error = null, result = null;
        var oldRedraw = app.scriptPreferences.enableRedraw;
        self.token = String(new Date().getTime()) + ":" + String(Math.random());
        try {
            app.doScript(function () {
                self.target.story.insertLabel(TOKEN_KEY, self.token);
                try {
                    app.scriptPreferences.enableRedraw = false;
                    self.liveTarget = sessionTarget(self.target);ensureSetupTokens(self.liveTarget);
                    if (self.savedRecipe) { resetSavedSetup(self.liveTarget,self.savedRecipe); }
                    if (self.stages.length) { removeMetrics(self.liveTarget.document, self.liveTarget.story.id,self.liveTarget.story.extractLabel(OWNER_KEY)); }
                    for (var i = 0; i < self.stages.length; i++) {
                        var stage = self.stages[i], replay = decode(encode(stage.settings));
                        // Metrics are refreshed once, for the final visible state.
                        replay.metrics = !settings && i === self.stages.length - 1 && stage.settings.metrics;
                        if (stage.patch && signature(self.liveTarget.story) === stage.replay.signature) {
                            // Numeric, text-preserving stages can replay their exact
                            // final patch. Curves, captures and solvers are already
                            // baked; advanced stages retain the complete safe path.
                            restoreSnapshot(self.liveTarget.story, stage.patch, self.liveTarget.document);
                            var restoredHistory = decode(stage.replay.history);
                            restoredHistory.effects[replay.property].settings = replay;
                            self.liveTarget.story.insertLabel(HISTORY_KEY, encode(restoredHistory));
                            self.liveTarget.story.insertLabel(LINE_LOCK_KEY, stage.replay.locks);
                            self.liveTarget.story.recompose();
                            result = {}; for (var field in stage.plan) { result[field] = stage.plan[field]; }
                            result.settings = replay; result.metricsFrames = replay.metrics ? addMetrics(self.liveTarget, result) : 0;
                        } else {
                            result = applyEffect(self.liveTarget, replay);
                            if(!stage.frozen){
                                stage.settings=decode(encode(result.settings));stage.frozen=takeSnapshot(self.liveTarget.story,propertiesFor(result.settings));
                                stage.replay=result.replay||null;stage.patch=stage.replay?filterSnapshot(stage.frozen,stage.replay.touched):null;stage.plan=result;
                            }else{restoreSnapshot(self.liveTarget.story, stage.frozen, self.liveTarget.document);}
                            self.liveTarget.story.recompose(); advanceScopes(self.liveTarget, result);
                        }
                    }
                    if (settings) { result = applyEffect(self.liveTarget, settings); advanceScopes(self.liveTarget, result); }
                    if (result) { result.keptCount = self.stages.length; writeSavedSetup(self,settings); }
                } catch (e) { error = e; }
                finally { app.scriptPreferences.enableRedraw = true; }
            }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, TITLE);
            self.active = self.target.document.undoName === TITLE && self.target.story.extractLabel(TOKEN_KEY) === self.token;
            if (error) { if (self.active) { self.rollback(); } throw error; }
            if (!self.active) { fail("InDesign did not create the preview transaction; preview cannot be safely restored."); }
            self.result = result; self.cacheKey = key; return result;
        } finally { app.scriptPreferences.enableRedraw = oldRedraw; }
    };
    PreviewSession.prototype.keep = function (settings) {
        settings = effectiveSettings(settings);
        if (settings.textEnabled === false) { fail("Enable a text property before adding another property."); }
        this.preview(settings); settings = this.result.settings;
        var frozen = takeSnapshot(this.target.story, propertiesFor(settings)), replay = this.result.replay;
        this.stages.push({ settings: decode(encode(settings)), frozen: frozen, replay: replay || null,
            patch: replay ? filterSnapshot(frozen, replay.touched) : null, plan: this.result });
        this.cacheKey = "";
    };
    PreviewSession.prototype.undoAddition = function () {
        if (!this.stages.length) { return null; }
        var stage = this.stages.pop(); this.cacheKey = ""; return decode(encode(stage.settings));
    };
    PreviewSession.prototype.commit = function (settings) {
        this.preview(settings); this.committed = true; return this.result;
    };

    function PreviewDelay(milliseconds, run, environment) {
        this.delay = milliseconds; this.run = run; this.environment = environment;
        this.pending = false; this.waiting = false; this.closed = false; this.deadline = 0;
    }
    PreviewDelay.prototype.cancel = function () { this.pending = false; };
    PreviewDelay.prototype.dispose = function () { this.closed = true; this.pending = false; };
    PreviewDelay.prototype.flush = function () {
        if (this.pending && !this.closed) { this.pending = false; this.run(); }
    };
    PreviewDelay.prototype.request = function () {
        if (this.closed) { return; }
        var env = this.environment;
        this.deadline = env.now() + this.delay; this.pending = true;
        if (this.waiting || !env.wait || !env.pump) { return; }
        this.waiting = true;
        try {
            // Idle tasks do not fire inside InDesign's modal ScriptUI window.
            // Pump that window while waiting so new keystrokes extend the same
            // deadline, and buttons/Cancel remain responsive.
            while (this.pending && !this.closed && (!env.alive || env.alive())) {
                env.pump();
                if (!this.pending || this.closed) { break; }
                if (env.now() >= this.deadline) { this.flush(); }
                else { env.wait(Math.min(12, Math.max(1, this.deadline - env.now()))); }
            }
        } finally { this.waiting = false; }
    };

    function graphGeometry(control) { return { x: 48, y: 18, width: control.size.width - 68, height: control.size.height - 45 }; }
    function drawGraph(control, distribution, settings, points, selected) {
        var g = control.graphics, box = graphGeometry(control);
        var w = control.size.width, h = control.size.height;
        var bg = g.newBrush(g.BrushType.SOLID_COLOR, [0.075, 0.09, 0.12, 1]);
        var grid = g.newPen(g.PenType.SOLID_COLOR, [0.20, 0.24, 0.30, 1], 1);
        var ink = g.newPen(g.PenType.SOLID_COLOR, [0.65, 0.71, 0.79, 1], 1);
        var blue = g.newPen(g.PenType.SOLID_COLOR, [0.25, 0.69, 1, 1], 2);
        var orange = g.newBrush(g.BrushType.SOLID_COLOR, [1, 0.67, 0.25, 1]);
        var white = g.newBrush(g.BrushType.SOLID_COLOR, [1, 1, 1, 1]);
        g.newPath(); g.rectPath(0, 0, w, h); g.fillPath(bg);
        for (var k = 0; k <= 4; k++) {
            var gy = box.y + box.height * k / 4;
            g.newPath(); g.moveTo(box.x, gy); g.lineTo(box.x + box.width, gy); g.strokePath(grid);
        }
        g.drawString(String(settings ? settings.max : "Max"), ink, 4, box.y - 7);
        g.drawString(String(settings ? settings.min : "Min"), ink, 4, box.y + box.height - 8);
        g.drawString("Start", ink, box.x, h - 20); g.drawString("End", ink, box.x + box.width - 24, h - 20);
        if (settings) {
            var guide = g.newPen(g.PenType.SOLID_COLOR, [0.36, 0.40, 0.46, 1], 1);
            g.newPath();
            for (var q = 0; q <= 120; q++) {
                var v = curveValue(q / 120, settings); if (settings.invert) { v = 1 - v; }
                var gx = box.x + q * box.width / 120, gy2 = box.y + box.height * (1 - v);
                if (!q) { g.moveTo(gx, gy2); } else { g.lineTo(gx, gy2); }
            }
            g.strokePath(guide);
        }
        if (distribution && distribution.values.length && settings) {
            var values = distribution.values, samples = Math.min(500, values.length);
            g.newPath(); var lastX, lastY;
            for (var i = 0; i < samples; i++) {
                var index = samples > 1 ? Math.round(i * (values.length - 1) / (samples - 1)) : 0;
                var fraction = settings.max === settings.min ? 0.5 : (values[index] - settings.min) / (settings.max - settings.min);
                var x = samples > 1 ? box.x + i * box.width / (samples - 1) : box.x + box.width / 2;
                var y = box.y + box.height * (1 - fraction);
                if (!i) { g.moveTo(x, y); }
                else { var middle = (lastX + x) / 2; g.lineTo(middle, lastY); g.lineTo(middle, y); g.lineTo(x, y); }
                lastX = x; lastY = y;
            }
            g.strokePath(blue);
        }
        if (points) {
            for (i = 0; i < points.length; i++) {
                x = box.x + points[i].x * box.width; y = box.y + (1 - points[i].y) * box.height;
                var radius = i === selected ? 5 : 4;
                g.newPath(); g.ellipsePath(x - radius, y - radius, radius * 2, radius * 2); g.fillPath(i === selected ? white : orange);
            }
        }
    }
    function seedPoints(settings) {
        var points = [];
        for (var i = 0; i <= 4; i++) {
            var value = curveValue(i / 4, settings);
            if (settings.invert) { value = 1 - value; }
            points.push({ x: i / 4, y: value });
        }
        return points;
    }
    function movePoint(points, index, x, y) {
        if (index < 0 || index >= points.length) { return; }
        if (index === 0) { x = 0; }
        else if (index === points.length - 1) { x = 1; }
        else { x = Math.max(points[index - 1].x + 0.005, Math.min(points[index + 1].x - 0.005, x)); }
        points[index] = { x: x, y: Math.max(0, Math.min(1, y)) };
    }
    function addPoint(points, x, y) {
        if (points.length >= 24) { fail("A custom curve supports up to 24 control points."); }
        x = Math.max(0.005, Math.min(0.995, x));
        for (var i = 0; i < points.length; i++) { if (Math.abs(points[i].x - x) < 0.005) { return i; } }
        var at = 1;
        while (at < points.length && points[at].x < x) { at++; }
        points.splice(at, 0, { x: x, y: Math.max(0, Math.min(1, y)) });
        return at;
    }

    function averageDistribution(result, overrideSettings) {
        var groups=result.groups||[],count=1,rows=[];
        for(var g=0;g<groups.length;g++){var d=groups[g].distribution;if(overrideSettings){d=buildDistribution(d.values.length,overrideSettings);}rows.push(d.values);count=Math.max(count,d.values.length);}
        if(!rows.length){return result.distribution;}
        count=Math.min(201,count);var values=[];
        for(var i=0;i<count;i++){var sum=0;for(g=0;g<rows.length;g++){var at=count===1?0:i*(rows[g].length-1)/(count-1),lo=Math.floor(at),hi=Math.ceil(at);sum+=rows[g][lo]+(rows[g][hi]-rows[g][lo])*(at-lo);}values.push(Math.round(sum/rows.length*1000)/1000);}
        return {values:values,steps:count,average:true};
    }
    function showDialog(target) {
        target=sessionTarget(target); var savedState=readSavedSetup(target),blendLoadError="",definitionCacheKey="",definitionCache=null;
        if(savedState.status==="loaded"){try{mapSetupStages(target,savedState.recipe);}catch(e){savedState={status:"blocked",message:e.message,recipe:null};}}
        var dialog = new Window("dialog", TITLE);
        dialog.orientation = "column"; dialog.alignChildren = ["fill", "top"];
        dialog.margins = 12; dialog.spacing = 8;
        var heading = dialog.add("group"); heading.orientation = "row";
        var title = heading.add("statictext", undefined, "Text distribution");
        var widthButton = heading.add("button", undefined, "Line width…");
        var textEnabled = heading.add("checkbox", undefined, "Apply text property"); textEnabled.value = true;
        try { title.graphics.font = ScriptUI.newFont(title.graphics.font.name, "BOLD", 16); } catch (_) {}
        function row(parent) { var r = parent.add("group"); r.orientation = "row"; r.alignChildren = ["left", "center"]; return r; }
        function field(parent, label, text, size) {
            parent.add("statictext", undefined, label);
            var f = parent.add("edittext", undefined, String(text)); f.characters = size || 6; return f;
        }
        function dropdown(parent, label, choices, width) {
            if (label) { parent.add("statictext", undefined, label); }
            var d = parent.add("dropdownlist", undefined, choices); d.selection = 0; d.preferredSize.width = width; return d;
        }
        function panel(name) { var p = dialog.add("panel", undefined, name); p.margins = 10; p.spacing = 8; p.alignChildren = ["fill", "top"]; return p; }
        var stackRow = row(dialog); stackRow.visible = false; stackRow.maximumSize = [10000, 0];
        var stackSummary = stackRow.add("statictext", undefined, ""); stackSummary.preferredSize.width = 470;
        var undoAddition = stackRow.add("button", undefined, "Undo addition");
        var savedRow=row(dialog),savedIndicator=savedRow.add("statictext",undefined,savedState.message||" ");savedIndicator.preferredSize.width=430;savedIndicator.helpTip=savedState.message;
        var forgetButton=savedRow.add("button",undefined,"Forget saved setup");forgetButton.enabled=savedState.status!=="none";
        forgetButton.helpTip="Keep current appearance and adopt it as a new baseline. Forgetting has its own Undo step.";
        savedRow.visible=savedState.status!=="none";savedRow.maximumSize=[10000,savedState.status!=="none"?46:0];
        var targetPanel = panel("Property");
        var propRow = row(targetPanel);
        var propertyIDs = ["tracking", "pointSize", "baselineShift", "designAxes", "horizontalScale", "verticalScale", "characterRotation", "skew", "strokeWeight", "strokeColor", "strokeTint", "fillColor", "fillTint", "underlineWeight", "underlineOffset", "leftIndent", "rightIndent", "firstLineIndent", "lineLength", "styleBlend"];
        var propertyLabels = ["Tracking", "Font size", "Baseline shift", "Variable-font axis", "Horizontal scale", "Vertical scale", "Character rotation", "Skew", "Stroke width", "Stroke color", "Stroke tint", "Character color", "Character tint", "Underline weight", "Underline offset", "Paragraph left indent", "Paragraph right indent", "Paragraph first-line indent", "Line length — centered", "Character-style blend"];
        var property = dropdown(propRow, "Property", propertyLabels, 220);
        var previousStructure = null;
        var axisRow=propRow.add("group"),axis = dropdown(axisRow, "Axis", ["Select a variable font"], 215);
        var styleObjects = characterStyleList(target.document), styleLabels = [], styleAttributes = null;
        for (i = 0; i < styleObjects.length; i++) { styleLabels.push(stylePath(styleObjects[i])); }
        if (!styleLabels.length) { styleLabels.push("Create character styles first"); }
        var styleRow = row(targetPanel);
        var styleA = dropdown(styleRow, "Style A", styleLabels, 170), styleB = dropdown(styleRow, "Style B", styleLabels, 170);
        styleA.selection = 0; styleB.selection = Math.max(0, Math.min(1, styleObjects.length - 1));
        var blendAttributes = styleRow.add("button", undefined, "Blend attributes…");
        styleRow.visible = false; styleRow.maximumSize = [0, 0];
        function selectBlendStyles(saved) {
            var foundA=false,foundB=false;
            for (var si = 0; si < styleObjects.length; si++) {
                if ((saved.styleAName ? stylePath(styleObjects[si]) === saved.styleAName : styleObjects[si].id === saved.styleA)) { styleA.selection = si; foundA=true; }
                if ((saved.styleBName ? stylePath(styleObjects[si]) === saved.styleBName : styleObjects[si].id === saved.styleB)) { styleB.selection = si; foundB=true; }
            }
            styleAttributes = saved.styleAttributes ? decode(encode(saved.styleAttributes)) : null;
            if(!foundA){styleA.selection=null;}if(!foundB){styleB.selection=null;}
            missingStyle.selection=saved.missingStyle==="original"?0:1;
            blendLoadError=(!foundA||!foundB)?"A saved endpoint style was renamed or deleted. Choose Style A and Style B before reapplying.":"";
            definitionCacheKey="";
        }
        var policyRow=row(targetPanel),missingStyle=dropdown(policyRow,"Missing values",["Original text","Skip"],160);
        var refreshStyles=policyRow.add("button",undefined,"Refresh styles");policyRow.visible=false;policyRow.maximumSize=[0,0];
        missingStyle.helpTip="Use the original text when exactly one style omits an attribute. Both missing leaves it unchanged. Skip preserves the v7 rule.";
        try { var blendHistory = target.story.extractLabel(HISTORY_KEY); if (blendHistory) { var lastBlend = decode(blendHistory).effects.styleBlend; if (lastBlend) { selectBlendStyles(lastBlend.settings); } } } catch (_) {}
        var colors = target.document.colors.everyItem().getElements();try{colors=colors.concat(target.document.tints.everyItem().getElements());}catch(_){}
        var colorLabels = [], colorObjects = [];
        for (i = 0; i < colors.length; i++) {
            try { if (colors[i].model != ColorModel.REGISTRATION) { colorLabels.push(colors[i].name); colorObjects.push(colors[i]); } } catch (_) {}
        }
        if (!colorLabels.length) { fail("No usable document colors are available."); }
        var strokeRow = row(targetPanel);
        var colorA = dropdown(strokeRow, "Color A", colorLabels, 160);
        var colorB = dropdown(strokeRow, "B", colorLabels, 160);
        var strokeWidth = field(strokeRow, "Width pt", 0.5, 5);
        for (i = 0; i < colorObjects.length; i++) { if (colorObjects[i].name === "Black") { colorA.selection = i; break; } }
        colorB.selection = Math.min(colorObjects.length - 1, colorA.selection.index + 1);
        var valueRow = row(targetPanel);
        var minInput = field(valueRow, "Min", 0, 8), maxInput = field(valueRow, "Max", 200, 8);
        var unitLabel = valueRow.add("statictext", undefined, "1/1000 em"); unitLabel.preferredSize.width = 130;
        var distributionPanel=panel("Distribution");
        var labels = [];
        for (var i = 0; i < target.scopes.length; i++) { labels.push(target.scopes[i].label); }
        var scope = dropdown(row(distributionPanel), "Scope", labels, 480);
        var modeRow = row(distributionPanel);
        var modeIDs = ["word", "line", "character", "sentence", "paragraph", "frame"];
        var mode = dropdown(modeRow, "Values per", ["Word", "Line — resulting composition", "Character", "Sentence", "Paragraph", "Frame"], 200);
        var restartIDs = ["never", "word", "sentence", "paragraph", "line", "frame"];
        var restart = dropdown(row(distributionPanel), "Restart curve per", ["Never — entire scope", "Word", "Sentence", "Paragraph", "Line — resulting composition", "Frame — resulting composition"], 320);
        restart.helpTip = "Each group receives the complete curve. Units crossing group boundaries are split. Min/Max and steps are shared by every group.";
        var optionsPanel=panel("Composition and replacement");
        var replace = optionsPanel.add("checkbox", undefined, "Replace previous effect for this property"); replace.value = true;
        var clearTracking = optionsPanel.add("checkbox", undefined, "Clear tracking to 0 first (for older effects / a clean start)");

        var compositionRow=row(optionsPanel);
        var lockLines = compositionRow.add("checkbox", undefined, "Auto-stabilize composition"); lockLines.value = true;
        lockLines.helpTip = "Try exact live composition, then freeze sampled assignments if needed. Added breaks require their own toggle. Min/Max are not reduced.";
        var allowBreaks = compositionRow.add("checkbox", undefined, "Allow added line breaks"); allowBreaks.value = false;
        allowBreaks.helpTip = "Allow managed tracking soft breaks when composition cycles. For Line length, allow real paragraph breaks for independent per-line indents. Off preserves paragraph structure and uses a frame contour for Line length. Cancel restores everything.";
        var curvePanel = panel("Curve and steps");
        var curveIDs = ["linear", "ease-in", "ease-out", "smooth", "gaussian", "sine", "triangle", "custom"];
        var curveNames = ["Linear", "Ease in", "Ease out", "S-curve", "Gaussian bell", "Sine arch", "Triangle", "Custom — drag control points"];
        var curveRow = row(curvePanel);
        var curve = dropdown(curveRow, "Curve", curveNames, 300);
        var invert = curveRow.add("checkbox", undefined, "Invert");
        var smooth = curveRow.add("checkbox", undefined, "Smooth custom"); smooth.value = true;
        var shapeRow = row(curvePanel);
        var shapeLabel = shapeRow.add("statictext", undefined, "Shape"); shapeLabel.preferredSize.width = 90;
        var shapeSlider = shapeRow.add("slider", undefined, 2, 1, 8); shapeSlider.preferredSize.width = 330;
        var shapeInput = shapeRow.add("edittext", undefined, "2"); shapeInput.characters = 6;
        var stepsRow = row(curvePanel);
        var auto = stepsRow.add("checkbox", undefined, "Auto steps"); auto.value = true;
        var stepsInput = field(stepsRow, "Steps", 5, 6);

        var metrics = stepsRow.add("checkbox", undefined, "Metrics 5 pt");
        metrics.helpTip = "Printable 5 pt tracking labels below each source line, centered in the actual interline gap. Tight gaps are flagged; source leading stays unchanged.";

        var graph = dialog.add("panel"); graph.preferredSize = [600, 165];
        var editorRow = row(dialog);
        var curveTrack = dropdown(editorRow, "Edit", ["Text curve", "Width curve"], 135);
        var graphMode=dropdown(editorRow,"Graph",["Average","Group"],100);
        var previewGroup = field(editorRow, "Group", 1, 4);
        var groupTotal = editorRow.add("statictext", undefined, "/ 1"); groupTotal.preferredSize.width = 45;
        graph.helpTip = "Drag control points; click to add; Alt-click an interior point to delete. The editor changes the shared curve for every group.";
        var removePoint = editorRow.add("button", undefined, "Delete point");
        var resetCurve = editorRow.add("button", undefined, "Reset curve");
        var summary = dialog.add("statictext", undefined, " "); summary.characters = 84;
        var samples = dialog.add("statictext", undefined, " "); samples.characters = 84;
        var note = dialog.add("statictext", undefined, " ", { multiline: true }); note.preferredSize = [600, 62];
        var error = dialog.add("statictext", undefined, " ", { multiline: true }); error.preferredSize = [600, 32];
        var footer = row(dialog); footer.alignment = "fill";
        var live = footer.add("checkbox", undefined, "Preview"); live.value = true;
        var colorTools=footer.add("button",undefined,"Colors…");
        var footerSpace=footer.add("group");footerSpace.alignment=["fill","center"];
        var cancel = footer.add("button", undefined, "Cancel", { name: "cancel" });
        var addProperty = footer.add("button", undefined, "+ Add property");
        addProperty.helpTip = "Keep the current effect and choose another property. Cancel still restores the entire session.";
        var apply = footer.add("button", undefined, "Apply", { name: "ok" });

        var session = new PreviewSession(target), settings = null, plan = null;
        if(savedState.status!=="none"){live.value=false;}
        var points = [], selected = -1, dragging = false, customEditing = false, busy = false, pendingRefresh = false, shown = false;
        var power = 2, width = 22, axes = [], lastProperty = "tracking", savedRanges = {};
        var lastValid = { curve: "linear", power: 2, width: 22, invert: false };
        var lastPreview = 0, dragOrigin = null, switching = false, editorTrack = 0, previewIndex = 0;
        var windowClosed = false, sliderAdjusting = false, previousLengthScope = null;
        var inputDelay = new PreviewDelay(350, function () { refresh(true); }, {
            now: function () { return new Date().getTime(); },
            wait: typeof $ !== "undefined" && $.sleep ? function (milliseconds) { $.sleep(milliseconds); } : null,
            pump: typeof $ !== "undefined" && $.sleep ? function () { if (!windowClosed && shown) { dialog.update(); } } : null,
            alive: function () { return !windowClosed && shown; }
        });
        var textCurve = { curve: "linear", power: 2, width: 22, invert: false, points: [], smooth: true, steps: 0 };
        var widthOptions = { enabled: false, linked: true, min: 40, max: 100, unit: "%", anchor: "center", smooth: true, steps: 12, curve: decode(encode(textCurve)) };
        try { var storedShape = target.frame ? target.frame.extractLabel(SHAPE_KEY) : ""; if (storedShape && !hasLineLengthShape(target.frame)) { widthOptions = decode(storedShape).options; if (widthOptions.linked) { textCurve = decode(encode(widthOptions.curve)); } } } catch (_) {}
        function copyCurve(from, to) { var keys = ["curve", "power", "width", "invert", "points", "smooth", "steps"]; for (var k = 0; k < keys.length; k++) { to[keys[k]] = from[keys[k]]; } return to; }
        function graphSettings(s) {
            if (!editorTrack) { return s; }
            var c = decode(encode(widthOptions.linked ? textCurve : widthOptions.curve));
            c.min = widthOptions.min; c.max = widthOptions.max; c.property = "pointSize"; c.steps = widthOptions.smooth ? 0 : widthOptions.steps; return c;
        }
        function loadEditor(c) {
            switching = true; customEditing = false; points = decode(encode(c.points || [])); selected = -1;
            power = c.power; width = c.width; invert.value = c.invert; smooth.value = c.smooth;
            auto.value = !c.steps; stepsInput.text = String(c.steps || 5);
            for (var k = 0; k < curveIDs.length; k++) { if (curveIDs[k] === c.curve) { curve.selection = k; break; } }
            lastValid = c; switching = false; curveChanged();
        }
        widthButton.onClick = function () {
            inputDelay.cancel();
            var w = new Window("dialog", "Line width — selected frame"); w.orientation = "column"; w.alignChildren = ["fill", "top"]; w.margins = 16;
            var enabled = w.add("checkbox", undefined, "Shape frame to control available line width"); enabled.value = widthOptions.enabled;
            var link = w.add("checkbox", undefined, "Use the text curve (linked)"); link.value = widthOptions.linked;
            var range = row(w), low = field(range, "Min", widthOptions.min, 7), high = field(range, "Max", widthOptions.max, 7);
            var units = dropdown(range, "Units", ["%", "pt", "mm"], 65); units.selection = 0; if (widthOptions.unit === "pt") { units.selection = 1; } else if (widthOptions.unit === "mm") { units.selection = 2; }
            var anchor = dropdown(row(w), "Anchor", ["Keep left", "Centered", "Keep right"], 160); anchor.selection = 1; if (widthOptions.anchor === "left") { anchor.selection = 0; } else if (widthOptions.anchor === "right") { anchor.selection = 2; }
            var sm = w.add("checkbox", undefined, "Smooth contour"); sm.value = widthOptions.smooth;
            var bands = field(row(w), "Stepped bands", widthOptions.steps, 5);
            var explanation = w.add("statictext", undefined, "Widths describe available space, not exact ink length.\n% refers to the original usable frame width.\nThe curve runs from the fixed top to the bottom of the frame.\nRequires one column, equal insets, no auto-size or frame transform.\nUse Width curve in the main editor for an independent curve.", { multiline: true }); explanation.preferredSize = [470, 100];
            var err = w.add("statictext", undefined, " "); err.preferredSize.width = 470;
            var buttons = row(w); buttons.alignment = "right"; buttons.add("button", undefined, "Cancel", { name: "cancel" }); var ok = buttons.add("button", undefined, "Set", { name: "ok" });
            ok.onClick = function () { try {
                var a = parseNumber(low.text, .01, 100000, false), b = parseNumber(high.text, .01, 100000, false), n = parseNumber(bands.text, 2, 200, true);
                if (a === null || b === null || a > b || n === null) { fail("Enter Min ≤ Max and 2–200 bands."); }
                var next = { enabled: enabled.value, linked: link.value, min: a, max: b, unit: ["%", "pt", "mm"][units.selection.index], anchor: ["left", "center", "right"][anchor.selection.index], smooth: sm.value, steps: n,
                    curve: decode(encode(widthOptions.linked && !link.value ? textCurve : widthOptions.curve)) };
                if (next.enabled) { var base = frameBase(target.frame), saved = target.frame.extractLabel(SHAPE_KEY); if (saved) { base = decode(saved).base; } widthPath(base, next, next.linked ? textCurve : next.curve); }
                widthOptions = next; w.close(1);
            } catch (e) { err.text = e.message; } };
            if (w.show() === 1) { if (editorTrack) { loadEditor(widthOptions.linked ? textCurve : widthOptions.curve); } else { refresh(true); } }
        };
        function selectedDistribution(result) {
            if(graphMode.selection.index===0){return averageDistribution(result);}
            if (result.groups && result.groups.length) { return result.groups[Math.min(previewIndex, result.groups.length - 1)].distribution; }
            return result.distribution;
        }
        function syncPreviewGroup(result) {
            var count = result.groups ? result.groups.length : 0;
            previewIndex = Math.max(0, Math.min(previewIndex, count - 1));
            previewGroup.text = String(previewIndex + 1); groupTotal.text = "/ " + count;
            graphMode.enabled=!editorTrack && count>1;previewGroup.enabled = !editorTrack && count > 1 && graphMode.selection.index===1;
        }
        graphMode.onChange=function(){if(plan&&settings){showResult(plan);redraw();}};
        previewGroup.onChanging = previewGroup.onChange = function () {
            if (!plan || !settings || !plan.groups.length) { return; }
            var index = parseNumber(previewGroup.text, 1, plan.groups.length, true); if (index === null) { return; }
            previewIndex = index - 1; showResult(plan); redraw(); if (shown) { dialog.update(); }
        };
        curveTrack.onChange = function () {
            if (switching) { return; }
            try { readSettings(); editorTrack = curveTrack.selection.index; loadEditor(editorTrack && !widthOptions.linked ? widthOptions.curve : textCurve); }
            catch (e) { error.text = e.message; }
        };
        function redraw() {
            try {
                // onDraw notifications can run without invalidating macOS's
                // cached panel surface. A one-pixel resize forces a paint.
                if (shown && typeof graph.size.width === "number") {
                    var w = graph.size.width, h = graph.size.height;
                    graph.size = [w + 1, h]; graph.size = [w, h];
                }
                graph.notify("onDraw");
            } catch (_) {}
        }
        function displayPoints() {
            if (customEditing || curveIDs[curve.selection.index] === "custom") { return points; }
            return seedPoints(lastValid);
        }
        graph.onDraw = function () {
            var gs = settings ? graphSettings(settings) : null, distribution = null;
            // ExtendScript evaluates chained conditional expressions differently
            // from modern JS in this callback. Keep the branches explicit.
            if (gs && editorTrack) { distribution = buildDistribution(widthOptions.smooth ? 97 : widthOptions.steps, gs); }
            else if (plan) {
                distribution = selectedDistribution(plan);
                if (sliderAdjusting && gs) { distribution = graphMode.selection.index===0 ? averageDistribution(plan,gs) : buildDistribution(distribution.values.length, gs); }
            }
            drawGraph(graph, distribution, gs, displayPoints(), selected);
        };
        function scopeBounds() { var t = session.liveTarget || target; return boundsFor(t, t.scopes[scope.selection.index]); }
        function updateAxes() {
            axis.removeAll(); axes = [];
            var b = scopeBounds();
            if (b) {
                var objects = target.story.characters.itemByRange(b.start, b.end).characters.everyItem().getElements();
                for (var k = 0; k < objects.length; k++) {
                    if (contentKind(objects[k].contents) === "text") { axes = axisInfo(objects[k].appliedFont); break; }
                }
            }
            if (!axes.length) { axis.add("item", "Select text in a variable font"); }
            else { for (var k = 0; k < axes.length; k++) { axis.add("item", axes[k].name + " (" + axes[k].min + "–" + axes[k].max + ")"); } }
            axis.selection = 0;
        }
        function readSettings() {
            var id = propertyIDs[property.selection.index];
            var selectedAxis = axes[axis.selection ? axis.selection.index : 0];
            var info = propertyInfo(id, selectedAxis);
            if (id === "designAxes" && !selectedAxis) { fail("Choose text in a variable font to use an axis."); }
            var min = parseNumber(minInput.text, info.low, info.high, info.integer);
            var max = parseNumber(maxInput.text, info.low, info.high, info.integer);
            if (min === null || max === null) { fail(info.label + " must be between " + info.low + " and " + info.high + " " + info.unit + "."); }
            if (min > max) { fail("Min must be less than or equal to Max."); }
            var steps = auto.value ? 0 : parseNumber(stepsInput.text, 1, 10000, true);
            if (steps === null) { fail("Steps must be a whole number from 1 to 10000."); }
            var curveID = customEditing ? "custom" : curveIDs[curve.selection.index];
            if (curveID === "gaussian" || curveID === "ease-in" || curveID === "ease-out") {
                var shape = parseNumber(shapeInput.text, curveID === "gaussian" ? 5 : 1, curveID === "gaussian" ? 50 : 8, false);
                if (shape === null) { fail("Enter a valid shape value."); }
                if (curveID === "gaussian") { width = shape; } else { power = shape; }
                if (Math.abs(shapeSlider.value - shape) > 0.051) { shapeSlider.value = shape; }
            }
            var sw = parseNumber(strokeWidth.text, 0.01, 100, false);
            if (/^stroke/.test(id) && sw === null) { fail("Stroke width must be 0.01–100 pt."); }
            if (/^(strokeColor|fillColor)$/.test(id) && colorObjects[colorA.selection.index].space != colorObjects[colorB.selection.index].space) { fail("Choose two colors in the same color space."); }
            var copy = [];
            for (var k = 0; k < points.length; k++) { copy.push({ x: points[k].x, y: points[k].y }); }
            var result = { scope: scope.selection.index, mode: modeIDs[mode.selection.index], restart: restartIDs[restart.selection.index], target: "both",
                property: id, min: min, max: max, curve: curveID, power: power, width: width, steps: steps, invert: customEditing ? false : invert.value,
                points: copy, smooth: smooth.value, axisName: selectedAxis ? selectedAxis.name : "", colorA: colorObjects[colorA.selection.index].id,
                colorB: colorObjects[colorB.selection.index].id, strokeWidth: sw || 0.5, replace: replace.value,
                clearTracking: id === "tracking" && clearTracking.value, metrics: metrics.value, lockLines: allowBreaks.value, allowLineBreaks: allowBreaks.value, autoStabilize: lockLines.value };
            if (id === "styleBlend") {
                if (!styleObjects.length) { fail("Create character styles in this document before choosing Character-style blend."); }
                if(!styleA.selection || !styleB.selection){fail(blendLoadError||"Choose Style A and Style B.");}
                var sa = styleObjects[styleA.selection.index], sb = styleObjects[styleB.selection.index];
                result.styleA = sa.id; result.styleB = sb.id; result.styleAName = stylePath(sa); result.styleBName = stylePath(sb);
                if(blendLoadError){fail(blendLoadError);}
                result.styleAttributes = styleAttributes ? decode(encode(styleAttributes)) : null;result.missingStyle=missingStyle.selection.index===0?"original":"skip";
                var definitionKey=encode([result.styleA,result.styleB,result.styleAttributes,result.missingStyle]);
                if(definitionKey!==definitionCacheKey){definitionCache=compileStyleBlend(target.document,result);definitionCacheKey=definitionKey;}
                result.blendDefinition=definitionCache;
            }
            if (editorTrack && !widthOptions.linked) { copyCurve(result, widthOptions.curve); copyCurve(textCurve, result); }
            else { copyCurve(result, textCurve); }
            if (widthOptions.linked) { widthOptions.curve = decode(encode(textCurve)); }
            result.textEnabled = textEnabled.value; result.frameWidth = session.hasKeptWidth() || id === "lineLength" || hasLineLengthShape(target.frame) ? null : decode(encode(widthOptions));
            if (!result.textEnabled && (!result.frameWidth || !result.frameWidth.enabled)) { fail("Enable a text property or Line width."); }
            return prepareStyleBlend(effectiveSettings(result), target.document);
        }
        function showResult(result) {
            syncPreviewGroup(result);
            var noun = settings.mode + "s";
            if (settings.mode === "word" && settings.target === "spaces") { noun = "word gaps"; }
            var stepsLabel = String(result.distribution.steps);
            if (result.distribution.minSteps !== result.distribution.steps) { stepsLabel = result.distribution.minSteps + "–" + result.distribution.steps; }
            summary.text = result.units.length + " " + noun;
            if (settings.restart !== "never") { summary.text += " / " + result.groups.length + " " + settings.restart + " groups"; }
            summary.text += " / " + stepsLabel + " steps/group / " + propertyInfo(settings.property, axes[axis.selection.index]).label;
            if (settings.frameWidth && settings.frameWidth.enabled) { summary.text += " / width " + settings.frameWidth.min + "–" + settings.frameWidth.max + settings.frameWidth.unit; }
            if ((usesComposition(settings) || target.scopes[settings.scope].kind === "frame") && settings.textEnabled !== false) { summary.text += live.value && shown ? (result.fixedSampling ? " / auto-stabilized" : " / settled in " + result.passes + " pass(es)") : " / composition calculated on Apply"; }
            if (result.fixedSampling) { summary.text += " / Fixed sampling"; }
            if (result.lineLength && result.fixedSampling) { summary.text += " / sampled " + result.sampleCount + " rows"; }
            if (result.lineLengthContour) { summary.text += " / paragraphs preserved"; }
            else if (result.lineLength) { summary.text += " / " + result.managedParagraphs + " managed paragraph breaks"; }
            if (settings.property === "styleBlend") { summary.text += " / " + settings.blendDefinition.attributes.length + " attributes"; }
            if (result.lockedBreaks) { summary.text += " / " + result.lockedBreaks + " fixed line breaks"; }
            var displayed = selectedDistribution(result);
            if (editorTrack) {
                displayed = buildDistribution(widthOptions.smooth ? 97 : widthOptions.steps, graphSettings(settings));
                summary.text = "Frame width " + widthOptions.min + "–" + widthOptions.max + widthOptions.unit + " / " + widthOptions.anchor + " / " + (widthOptions.smooth ? "smooth" : widthOptions.steps + " bands");
            }
            var values = [], count = Math.min(9, displayed.values.length);
            for (var k = 0; k < count; k++) { var at = count > 1 ? Math.round(k * (displayed.values.length - 1) / (count - 1)) : 0; values.push(displayed.values[at]); }
            samples.text = (editorTrack ? "Width samples: " : (displayed.average ? "Average across groups: " : "Group " + (previewIndex + 1) + " values: ")) + values.join("  >  ");
            var text = "Cancel restores the document. Metrics print and show actual tracking below each line.";
            if (usesComposition(settings)) { text = "Line/frame grouping follows the resulting composition. Tracking line curves can use fixed breaks when Allow added line breaks is on."; }
            if (settings.property === "tracking" && settings.target === "letters") { text += "\nLetters excludes the outgoing word gap. Single-letter words may have no internal tracking target."; }
            else if (settings.target === "spaces") { text += "\nOnly interword spaces change. Tabs, breaks, and leading/trailing spaces are excluded."; }
            if (/^(gaussian|sine|triangle)$/.test(editorTrack ? graphSettings(settings).curve : settings.curve) && displayed.steps < 3) { text = "A bell needs at least 3 sampled steps to represent its interior. Only endpoint values are sampled.\n" + text; }
            if (isParagraphProperty(settings.property)) { text += " Indents apply to whole intersecting paragraphs, including text beyond the selected scope. One curve runs across those paragraphs."; }
            if (/^underline/.test(settings.property)) { text += " Underlining is enabled on the targets. Offset is measured from the baseline; positive values move it downward."; }
            if (settings.property === "lineLength") { text += allowsLineBreaks(settings) ? " Each fitted row uses centered indents and a managed paragraph break. Replace restores owned whitespace before refitting." : " Paragraphs are preserved. Centered widths follow a frame contour from top to bottom; short text may use only part of the curve."; }
            if (settings.property === "styleBlend") {
                var bd = settings.blendDefinition, names = [], shownNames = [];
                for (var bi = 0; bi < bd.attributes.length; bi++) { names.push(bd.attributes[bi].label); if (bi < 5) { shownNames.push(bd.attributes[bi].label); } }
                text = "Blending: " + shownNames.join(", ") + (names.length > 5 ? " + " + (names.length - 5) + " more" : "") + ". Font families and on/off settings stay unchanged; the source styles are not modified.";
                if (bd.ignored.length || bd.excluded.length) { text += " " + bd.ignored.length + " unsupported/missing and " + bd.excluded.length + " excluded. See Blend attributes."; }
                blendAttributes.helpTip = "Blending: " + names.join(", ") + "\n" + bd.ignored.join("\n");
            }
            if (settings.property === "baselineShift") { text += " Baseline shift moves glyphs without increasing leading."; }
            if (/^(characterRotation|skew|horizontalScale|verticalScale)$/.test(settings.property)) { text += " Large transforms can overlap or extend beyond the frame; rotation wraps at 360 degrees."; }
            if (dragging && settings.metrics) { text += " Metrics update on release."; }
            else if (settings.metrics) { text += " Metrics: " + result.metricsFrames + " printable overlay(s).";
                if (result.metricsCrowded) { text += " " + result.metricsCrowded + " tight gap(s); labels remain centered and may overlap."; } }
            if (!editorTrack && settings.restart !== "never") {
                text = "Shared curve restarts in each " + settings.restart + ". " + (displayed.average ? "Graph averages actual samples across groups at normalized positions. " : "Graph shows group " + (previewIndex + 1) + "/" + result.groups.length + ". ") + text;
                if (isBell(settings.curve) && result.distribution.shortGroups) { text += " " + result.distribution.shortGroups + " group(s) have fewer than 3 steps and cannot represent the bell interior."; }
            }
            if(!editorTrack && settings.mode===settings.restart && result.distribution.steps===1){text="One unit per restart group: each group uses the curve’s starting value. Choose a smaller Values per unit for a curve inside each group. "+text;}
            if (settings.mode === "sentence" || settings.restart === "sentence") { text += " Sentence boundaries use punctuation with abbreviation/decimal handling."; }
            if ((settings.mode === "frame" || settings.restart === "frame") && target.scopes[settings.scope].kind !== "story") { text += " Choose Entire story to distribute across linked frames."; }
            if (result.fixedSampling) { text += " Fixed sampling keeps assigned values while text reflows; line/frame patterns follow the sampled layout. In frame scope, new text may retain its baseline. Min/Max were not rescaled."; }
            if (result.lockedBreaks) { text += " Soft line breaks keep line curves stable; reapplying this property replaces its managed breaks."; }
            if (target.story.overflows) { text += " Overset text remains."; }
            if (editorTrack) { text = "Width curve: top → bottom. Set contour bands in Line width. " + (widthOptions.linked ? "Linked to text." : "Independent of text.") + "\n" + text; }
            note.text = text;
        }
        function refresh(force) {
            if (switching || windowClosed) { return; }
            inputDelay.cancel(); sliderAdjusting = false;
            if (busy) { pendingRefresh = true; return; } busy = true;
            try {
                apply.enabled = addProperty.enabled = false; error.text = " ";
                var blendProperty = propertyIDs[property.selection.index] === "styleBlend";
                var styleVisibilityChanged = styleRow.visible !== blendProperty;
                styleRow.visible = policyRow.visible = blendProperty; styleRow.maximumSize = policyRow.maximumSize = blendProperty ? [10000, 30] : [0, 0];
                styleA.enabled = styleB.enabled = blendAttributes.enabled = !!styleObjects.length;
                if (styleVisibilityChanged) { try { dialog.layout.layout(true); } catch (_) {} }
                var lengthProperty = propertyIDs[property.selection.index] === "lineLength";
                var paragraphProperty = isParagraphProperty(propertyIDs[property.selection.index]);
                if ((paragraphProperty || lengthProperty) && !previousStructure) { previousStructure = [mode.selection.index, restart.selection.index]; }
                switching = true;
                try {
                    if (lengthProperty) { mode.selection = 1; restart.selection = 0;
                        if (previousLengthScope === null) { previousLengthScope = scope.selection.index; }
                        var frameScope = -1; for (var fs = 0; fs < target.scopes.length; fs++) { if (target.scopes[fs].kind === "frame") { frameScope = fs; break; } }
                        if (frameScope < 0) { fail("Select a visible text frame for Line length."); } scope.selection = frameScope;
                    }
                    else if (paragraphProperty) { mode.selection = 4; restart.selection = 0; }
                    else if (previousStructure) { mode.selection = previousStructure[0]; restart.selection = previousStructure[1]; previousStructure = null; }
                } finally { switching = false; }
                if (!lengthProperty && previousLengthScope !== null) { scope.selection = previousLengthScope; previousLengthScope = null; }
                scope.enabled = !lengthProperty;replace.enabled=!session.savedRecipe;replace.helpTip=session.savedRecipe?"Reapply restores the entire saved stack baseline. Forget saved setup to adopt the current appearance.":"Restore this property baseline before recalculating.";
                mode.enabled = restart.enabled = textEnabled.value && !paragraphProperty && !lengthProperty;
                auto.enabled = !editorTrack; stepsInput.enabled = !auto.value && !editorTrack; lockLines.enabled = allowBreaks.enabled = textEnabled.value;
                widthButton.enabled = curveTrack.enabled = !session.hasKeptWidth() && !hasLineLengthShape(target.frame) && !lengthProperty;
                // Undo the previous preview before resolving a new scope or
                // snapshot, so edits never accumulate across control changes.
                if(savedState.status==="blocked"){fail(savedState.message);}
                settings = readSettings(); lastValid = graphSettings(settings);
                if (live.value && shown) {
                    var previewSettings = settings;
                    if (dragging && !force && settings.metrics) { previewSettings = decode(encode(settings)); previewSettings.metrics = false; }
                    plan = session.preview(previewSettings);
                }
                else {
                    if (session.stages.length) { session.preview(null); } else { session.rollback(); }
                    var b = scopeBounds(); if (!b) { fail("No visible text in this frame."); }
                    plan = makePlan(captureEffect(target.story, b, settings), settings);
                }
                showResult(plan); apply.enabled = true; addProperty.enabled = textEnabled.value && session.stages.length < propertyIDs.length - 1; syncStack();
                removePoint.enabled = curveIDs[curve.selection.index] === "custom" && selected > 0 && selected < points.length - 1;
                redraw(); if (shown) { dialog.update(); }
            } catch (e) {
                try { session.rollback(); if (session.stages.length) { session.preview(null); } } catch (rollbackError) { error.text = rollbackError.message; }
                settings = null; plan = null; summary.text = " "; samples.text = " "; note.text = " ";
                error.text = e.message; redraw();
            } finally {
                busy = false;
                if (pendingRefresh) { pendingRefresh = false; refresh(true); }
            }
        }
        function syncStack() {
            var names = [], all = [];
            for (var i = 0; i < session.stages.length; i++) {
                var label = propertyInfo(session.stages[i].settings.property).label;
                all.push((i + 1) + " " + label); if (i < 3) { names.push(label); }
            }
            stackSummary.text = "Kept: " + names.join(" → ") + (all.length > 3 ? " +" + (all.length - 3) : "");
            stackSummary.helpTip = all.join(" → ");
            var layoutChanged = stackRow.visible !== (all.length > 0);
            stackRow.visible = all.length > 0; stackRow.maximumSize = [10000, all.length ? 28 : 0];
            undoAddition.enabled = all.length > 0; apply.text = session.savedRecipe ? (all.length ? "Reapply all" : "Reapply") : (all.length ? "Apply all" : "Apply");
            if (layoutChanged) { try { dialog.layout.layout(true); } catch (_) {} }
        }
        function loadSettings(saved) {
            session.rollback(); switching = true; previousStructure = null; editorTrack = 0; curveTrack.selection = 0;
            for (var i = 0; i < propertyIDs.length; i++) { if (propertyIDs[i] === saved.property) { property.selection = i; break; } }
            scope.selection = saved.scope;
            for (i = 0; i < modeIDs.length; i++) { if (modeIDs[i] === saved.mode) { mode.selection = i; break; } }
            for (i = 0; i < restartIDs.length; i++) { if (restartIDs[i] === saved.restart) { restart.selection = i; break; } }
            textEnabled.value = saved.textEnabled !== false; replace.value = session.savedRecipe ? true : saved.replace; clearTracking.value = saved.clearTracking;
            metrics.value = saved.metrics; lockLines.value = saved.autoStabilize !== false; allowBreaks.value = allowsLineBreaks(saved); strokeWidth.text = String(saved.strokeWidth===undefined?0.5:saved.strokeWidth);
            for (i = 0; i < colorObjects.length; i++) { if (colorObjects[i].id === saved.colorA) { colorA.selection = i; } if (colorObjects[i].id === saved.colorB) { colorB.selection = i; } }
            if (saved.property === "styleBlend") { selectBlendStyles(saved); }
            savedRanges[saved.property] = [String(saved.min), String(saved.max)];
            if (saved.frameWidth) { widthOptions = decode(encode(saved.frameWidth)); }
            copyCurve(saved, textCurve); switching = false;
            propertyChanged();
            for (i = 0; i < axes.length; i++) { if (axes[i].name === saved.axisName) { axis.selection = i; break; } }
            minInput.text = String(saved.min); maxInput.text = String(saved.max); loadEditor(saved); syncStack(); refresh(true);
        }
        addProperty.onClick = function () {
            inputDelay.cancel();
            try {
                var current = readSettings(), choices = [], ids = [];
                for (var i = 0; i < propertyIDs.length; i++) { if (propertyIDs[i] !== current.property && !session.hasProperty(propertyIDs[i])) { choices.push(propertyLabels[i]); ids.push(i); } }
                if (!ids.length) { fail("All available properties are already in this stack."); }
                var chooser = new Window("dialog", "Add property"); chooser.orientation = "column"; chooser.alignChildren = ["fill", "top"]; chooser.margins = 16;
                chooser.add("statictext", undefined, "Keep " + propertyInfo(current.property).label + " and add:");
                var next = dropdown(chooser, "", choices, 280), buttons = row(chooser); buttons.alignment = "right";
                buttons.add("button", undefined, "Cancel", { name: "cancel" });
                var choose = buttons.add("button", undefined, "Add", { name: "ok" }); choose.onClick = function () { chooser.close(1); };
                if (chooser.show() !== 1) { return; }
                session.keep(current); property.selection = ids[next.selection.index];
                editorTrack = 0; curveTrack.selection = 0; propertyChanged(); loadEditor(textCurve); syncStack();
            } catch (e) { error.text = e.message; }
        };
        undoAddition.onClick = function () { inputDelay.cancel(); try { var saved = session.undoAddition(); if (saved) { loadSettings(saved); } } catch (e) { error.text = e.message; } };
        function propertyChanged() {
            if (switching) { return; }
            var chosen = propertyIDs[property.selection.index];
            if (session.hasProperty(chosen)) {
                switching = true; for (var taken = 0; taken < propertyIDs.length; taken++) { if (propertyIDs[taken] === lastProperty) { property.selection = taken; break; } } switching = false;
                error.text = "This property is already kept. Use Undo addition to return to it."; return;
            }
            try { session.rollback(); } catch (e) { error.text = e.message; return; }
            savedRanges[lastProperty] = [minInput.text, maxInput.text];
            var id = propertyIDs[property.selection.index], returnToTextCurve = (id === "lineLength" || id === "styleBlend") && editorTrack;
            if (returnToTextCurve) { editorTrack = 0; curveTrack.selection = 0; }
            axisRow.visible = axis.enabled = id === "designAxes";axisRow.maximumSize=axisRow.visible?[10000,30]:[0,0]; strokeRow.visible = /^stroke/.test(id) || id === "fillColor";strokeRow.maximumSize=strokeRow.visible?[10000,30]:[0,0]; strokeRow.enabled = /^stroke/.test(id) || id === "fillColor";
            colorB.enabled = /^(strokeColor|fillColor)$/.test(id); strokeWidth.enabled = /^stroke/.test(id) && id !== "strokeWeight";
            clearTracking.visible = clearTracking.enabled = id === "tracking";clearTracking.maximumSize=clearTracking.visible?[10000,25]:[0,0];
            try{dialog.layout.layout(true);}catch(_){}
            updateAxes(); var selectedAxis = axes[axis.selection.index];
            var info = propertyInfo(id, selectedAxis), saved = savedRanges[id];
            minInput.text = saved ? saved[0] : String(info.min); maxInput.text = saved ? saved[1] : String(info.max);
            unitLabel.text = info.unit; lastProperty = id;
            if (returnToTextCurve) { loadEditor(textCurve); } else { refresh(true); }
        }
        function curveChanged() {
            if (switching) { return; }
            var id = curveIDs[curve.selection.index];
            if (id === "custom" && !points.length) { points = seedPoints(lastValid); invert.value = false; }
            shapeRow.enabled = id === "gaussian" || id === "ease-in" || id === "ease-out";
            shapeLabel.text = id === "gaussian" ? "Bell width %" : "Ease power";
            shapeSlider.minvalue = id === "gaussian" ? 5 : 1; shapeSlider.maxvalue = id === "gaussian" ? 50 : 8;
            shapeInput.text = String(id === "gaussian" ? width : power); shapeSlider.value = Number(shapeInput.text);
            smooth.enabled = id === "custom"; refresh(true);
        }
        function ensureCustom() {
            if (curveIDs[curve.selection.index] !== "custom") {
                // Native widget setters can pump queued mouse events on macOS.
                // Keep this press handler entirely in JS until drag state is
                // established; synchronize the dropdown after mouse release.
                points = seedPoints(lastValid); customEditing = true;
            }
        }
        function mousePosition(event) {
            var box = graphGeometry(graph);
            var x = event.clientX, y = event.clientY;
            if (dragOrigin && typeof event.screenX === "number") { x = event.screenX - dragOrigin.x; y = event.screenY - dragOrigin.y; }
            return { x: Math.max(0, Math.min(1, (x - box.x) / box.width)), y: Math.max(0, Math.min(1, 1 - (y - box.y) / box.height)) };
        }
        graph.addEventListener("mousedown", function (event) {
            inputDelay.cancel();
            if (event.button === 2) { return; }
            dragOrigin = { x: event.screenX - event.clientX, y: event.screenY - event.clientY };
            ensureCustom(); var p = mousePosition(event), box = graphGeometry(graph), nearest = -1, distance = 144;
            for (var k = 0; k < points.length; k++) {
                var d = Math.pow((p.x - points[k].x) * box.width, 2) + Math.pow((p.y - points[k].y) * box.height, 2);
                if (d < distance) { nearest = k; distance = d; }
            }
            if (event.altKey && nearest > 0 && nearest < points.length - 1) {
                points.splice(nearest, 1); selected = -1; customEditing = false; curve.selection = 7;
                invert.value = false; shapeRow.enabled = false; smooth.enabled = true; refresh(true); return;
            }
            try { selected = nearest >= 0 ? nearest : addPoint(points, p.x, p.y); dragging = true; redraw(); }
            catch (e) { error.text = e.message; }
        });
        function moveDrag(event) {
            if (!dragging || selected < 0) { return; }
            var p = mousePosition(event); movePoint(points, selected, p.x, p.y);
            var now = new Date().getTime();
            if (now - lastPreview > 250) { refresh(false); lastPreview = new Date().getTime(); } else { redraw(); }
        }
        graph.addEventListener("mousemove", moveDrag);
        dialog.addEventListener("mousemove", moveDrag, true);
        function finishDrag(event) {
            if (!dragging) { return; }
            // InDesign/macOS can omit drag-move notifications. Always sample
            // the release position as well, using the graph's screen origin.
            if (event && typeof event.screenX === "number" && selected >= 0) {
                var finalPosition = mousePosition(event);
                movePoint(points, selected, finalPosition.x, finalPosition.y);
            }
            dragging = false; dragOrigin = null;
            if (customEditing) {
                customEditing = false; invert.value = false; curve.selection = 7;
                shapeRow.enabled = false; smooth.enabled = true;
            }
            refresh(true);
        }
        graph.addEventListener("mouseup", finishDrag);
        dialog.addEventListener("mouseup", finishDrag, true);
        removePoint.onClick = function () {
            if (selected > 0 && selected < points.length - 1) { points.splice(selected, 1); selected = -1; refresh(true); }
        };
        resetCurve.onClick = function () { points = []; selected = -1; customEditing = false; dragging = false; dragOrigin = null; curve.selection = 0; invert.value = false; curveChanged(); };
        shapeSlider.onChanging = function () {
            if (switching || windowClosed || !shown) { return; }
            inputDelay.cancel();
            shapeInput.text = String(Math.round(shapeSlider.value * 10) / 10);
            // Keep dragging local to ScriptUI. Native composition (and metrics)
            // runs once on release, using the final value and exact boundaries.
            try {
                settings = readSettings(); lastValid = graphSettings(settings); sliderAdjusting = true;
                summary.text = "Release slider to update document preview.";
                redraw();
            } catch (e) { error.text = e.message; }
        };
        shapeSlider.onChange = function () { shapeInput.text = String(Math.round(shapeSlider.value * 10) / 10); refresh(true); };
        function numberChanging() {
            if (switching || windowClosed || !shown) { return; }
            summary.text = "Preview waits for typing to pause…"; inputDelay.request();
        }
        function numberCommitted() { if (!inputDelay.pending) { refresh(true); } }
        minInput.onChanging = maxInput.onChanging = shapeInput.onChanging = stepsInput.onChanging = strokeWidth.onChanging = numberChanging;
        minInput.onChange = maxInput.onChange = shapeInput.onChange = stepsInput.onChange = strokeWidth.onChange = numberCommitted;
        styleA.onChange = styleB.onChange = function () { if (switching) { return; } styleAttributes = null;blendLoadError="";definitionCacheKey=""; refresh(true); };
        missingStyle.onChange=function(){definitionCacheKey="";refresh(true);};
        refreshStyles.onClick=function(){definitionCacheKey="";refresh(true);};
        blendAttributes.onClick = function () {
            inputDelay.cancel();
            try {
                var current = readSettings(), allSettings = {}; for (var key in current) { allSettings[key] = current[key]; }
                delete allSettings.blendDefinition; allSettings.styleAttributes = null;
                var definition = compileStyleBlend(target.document, allSettings), chooser = new Window("dialog", "Blend attributes");
                chooser.orientation = "column"; chooser.alignChildren = ["fill", "top"]; chooser.margins = 16;
                chooser.add("statictext", undefined, "Supported numeric settings, compatible colors and variable axes.");
                chooser.add("statictext", undefined, "Font families, capitalization, underline on/off and other switches stay unchanged.");
                if(definition.inheritanceA.length){chooser.add("statictext",undefined,"A based on: "+definition.inheritanceA.join(" → "));}
                if(definition.inheritanceB.length){chooser.add("statictext",undefined,"B based on: "+definition.inheritanceB.join(" → "));}
                var columns = row(chooser), left = columns.add("group"), right = columns.add("group");
                left.orientation = right.orientation = "column"; left.alignChildren = right.alignChildren = ["left", "top"];
                var checks = [], half = Math.ceil(definition.available.length / 2);
                for (var ai = 0; ai < definition.available.length; ai++) {
                    var item = definition.available[ai], check = (ai < half ? left : right).add("checkbox", undefined, item.label); check.value = styleAttributes === null;
                    if (styleAttributes) { for (var selectedIndex = 0; selectedIndex < styleAttributes.length; selectedIndex++) { if (styleAttributes[selectedIndex] === item.id) { check.value = true; } } }
                    checks.push(check);
                }
                if (definition.ignored.length) { var skipped = chooser.add("statictext", undefined, "Skipped:\n" + definition.ignored.join("\n"), {multiline:true}); skipped.preferredSize = [560, Math.min(140, 24 + definition.ignored.length * 15)]; }
                var message = chooser.add("statictext", undefined, " "), buttons = row(chooser); buttons.alignment = "right";
                buttons.add("button", undefined, "Cancel", {name:"cancel"}); var ok = buttons.add("button", undefined, "Use attributes", {name:"ok"});
                var selectedAttributes = [];
                ok.onClick = function () { selectedAttributes = []; for (var n = 0; n < checks.length; n++) { if (checks[n].value) { selectedAttributes.push(definition.available[n].id); } } if (!selectedAttributes.length) { message.text = "Keep at least one attribute selected."; return; } chooser.close(1); };
                if (chooser.show() === 1) { styleAttributes = selectedAttributes; definitionCacheKey=""; refresh(true); }
            } catch (e) { error.text = e.message; }
        };
        property.onChange = propertyChanged; curve.onChange = curveChanged;
        axis.onChange = function () {
            if (propertyIDs[property.selection.index] === "designAxes" && axes[axis.selection.index]) {
                var info = propertyInfo("designAxes", axes[axis.selection.index]); minInput.text = String(info.min); maxInput.text = String(info.max);
            }
            refresh(true);
        };
        scope.onChange = function () { try { session.rollback(); updateAxes(); } catch (_) {} refresh(true); };
        mode.onChange = restart.onChange = colorA.onChange = colorB.onChange = function () { refresh(true); };
        textEnabled.onClick = live.onClick = metrics.onClick = invert.onClick = auto.onClick = smooth.onClick = replace.onClick = clearTracking.onClick = lockLines.onClick = allowBreaks.onClick = function () { refresh(true); };
        apply.onClick = function () {
            inputDelay.cancel();definitionCacheKey="";
            try { if(savedState.status==="blocked"){fail(savedState.message);}var s = readSettings(); session.commit(s); dialog.close(1); }
            catch (e) { try { session.rollback(); } catch (_) {} error.text = e.message; apply.enabled = false; }
        };
        colorTools.onClick=function(){
            inputDelay.cancel();try{
                var chooser=new Window("dialog","Generated colors");chooser.orientation="column";chooser.alignChildren=["fill","top"];chooser.margins=16;
                chooser.add("statictext",undefined,"Generated colors live in the Tracking Ramp swatch group.");
                chooser.add("statictext",undefined,"Cleanup keeps source colors and colors needed by saved baselines.");
                var buttons=row(chooser),group=buttons.add("button",undefined,"Group existing"),clean=buttons.add("button",undefined,"Remove unused"),done=buttons.add("button",undefined,"Cancel",{name:"cancel"}),action=null;
                group.onClick=function(){action=false;chooser.close(1);};clean.onClick=function(){action=true;chooser.close(1);};
                if(chooser.show()!==1){return;}session.rollback();var managed;
                app.doScript(function(){managed=manageGeneratedColors(target.document,action);},ScriptLanguage.JAVASCRIPT,undefined,UndoModes.ENTIRE_SCRIPT,TITLE+" — colors");
                refresh(true);error.text=managed.grouped+" generated colors grouped; "+managed.removed+" unused colors removed.";
            }catch(e){error.text=e.message;}
        };
        forgetButton.onClick=function(){
            inputDelay.cancel();try{session.rollback();forgetSavedSetup(target);savedState={status:"none",message:"",recipe:null};session=new PreviewSession(target);live.value=false;
                savedIndicator.text="Saved setup forgotten. Current appearance kept.";forgetButton.enabled=false;missingStyle.selection=0;styleAttributes=null;blendLoadError="";definitionCacheKey="";defaultSettings.frameWidth={enabled:false,linked:true,min:40,max:100,unit:"%",anchor:"center",smooth:true,steps:12,curve:{curve:"linear",power:2,width:22,invert:false,points:[],smooth:true,steps:0}};loadSettings(defaultSettings);
            }catch(e){error.text=e.message;}
        };
        cancel.onClick = function () { inputDelay.cancel(); try { session.rollback(); dialog.close(0); } catch (e) { error.text = e.message; } };
        dialog.onClose = function () {
            if (!session.committed) { try { session.rollback(); } catch (e) { error.text = e.message; return false; } }
            windowClosed = true; inputDelay.dispose(); return true;
        };
        dialog.onShow = function () {
            shown = true; refresh(true); minInput.active = true;
            try {
                var screen = $.screens[0]; dialog.location = [Math.max(screen.left + 20, screen.right - dialog.size.width - 30), screen.top + 45];
            } catch (_) {}
        };
        var defaultSettings=readSettings(),initialCurve=decode(encode(textCurve));
        if(savedState.status==="loaded"){
            try{var recalled=session.load(savedState.recipe);loadSettings(recalled);}catch(e){savedState={status:"blocked",message:e.message,recipe:null};savedIndicator.text=e.message;}
        }else if(savedState.status==="legacy" && savedState.settings){loadSettings(savedState.settings);}
        else{propertyChanged();loadEditor(initialCurve);}
        var result = dialog.show();
        if (result !== 1) { return null; }
        return session.result;
    }
    function run() {
        var oldUnits = app.scriptPreferences.measurementUnit;
        var oldRedraw = app.scriptPreferences.enableRedraw;
        try {
            app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;
            app.scriptPreferences.enableRedraw = true;
            var target = resolveTarget(); showDialog(target);
        } catch (e) { alert(e.message, TITLE); }
        finally { app.scriptPreferences.measurementUnit = oldUnits; app.scriptPreferences.enableRedraw = oldRedraw; }
    }
    run(); // Entry point
}());
