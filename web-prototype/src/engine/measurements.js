import { prepareWithSegments, measureNaturalWidth } from '@chenglou/pretext';
import { prepareRichInline, walkRichInlineLineRanges, materializeRichInlineLineRange } from '@chenglou/pretext/rich-inline';
import { leadingAt } from './typography.js';
import { flowEnvelope } from './geometry.js';
import { textStructure } from './distribution.js';
import { STATE_COUNT, typeState, fontString } from './morph.js';

// Prepared handles are opaque: never patch Pretext internals. Each stored width
// comes from the public API for a complete shaped word, not summed glyph widths.
export async function prepareModel(text, a, b, onProgress = () => {}, { characters = false } = {}) {
  const structure = textStructure(text), paragraphs = structure.paragraphs, words = paragraphs.flat();
  const unique = [...new Set(characters ? [...structure.words.flatMap(word => word.graphemes), " "] : words)], widths = new Map(unique.map(word => [word, new Float64Array(STATE_COUNT)]));
  const states = [], space = new Float64Array(STATE_COUNT);
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  let workMs = 0;
  const started = performance.now();
  for (let index = 0; index < STATE_COUNT; index++) {
    const tick = performance.now(), style = typeState(a, b, index / (STATE_COUNT - 1));
    style.font = fontString(style); states.push(style); ctx.font = style.font;
    space[index] = Math.max(0, ctx.measureText(' ').width + style.tracking);
    for (const word of unique) {
      widths.get(word)[index] = word === " " ? space[index] : Math.max(0,measureNaturalWidth(prepareWithSegments(word, style.font, { letterSpacing: style.tracking })));
    }
    workMs += performance.now() - tick;
    if (index % 8 === 7) { onProgress((index + 1) / STATE_COUNT); await new Promise(resolve => setTimeout(resolve, 0)); }
  }
  return { text, paragraphs, words, structure, characters, widths, states, space, a: { ...a }, b: { ...b },
    maxSize: Math.max(a.size, b.size),
    preparation: { workMs, wallMs: performance.now() - started, uniqueWords: unique.length, measuredStates: STATE_COUNT, entries: unique.length * STATE_COUNT } };
}

export function layoutModel(model, availableWidth, a=model.a, b=model.b) {
  const lines = [], maxSpace = Math.max(...model.space), envelopes=new Map();
  let lineHeight=Math.ceil(model.maxSize*1.55),edgePadding=0;
  for(const [word,widths] of model.widths){const bounds=flowEnvelope(Math.max(...widths),model.maxSize,a,b);envelopes.set(word,bounds);edgePadding=Math.max(edgePadding,bounds.edgePadding);lineHeight=Math.max(lineHeight,Math.ceil(bounds.height+model.maxSize*.4));}
  const autoLineHeight=lineHeight;lineHeight=Math.max(leadingAt(a,b,0,autoLineHeight),leadingAt(a,b,1,autoLineHeight));
  if(!Number.isFinite(lineHeight)||!Number.isFinite(autoLineHeight))throw new RangeError('These values produce non-finite line heights. Reduce one of the values.');
  const contentWidth=Math.max(1,availableWidth-2*edgePadding);
  let wordIndex = 0, renderIndex = 0;
  const meta=model.structure?.words||model.words.map((word,i)=>({word,wordIndex:i,paragraphIndex:0,sentenceIndex:0}));
  for (const paragraph of model.paragraphs) {
    if (!paragraph.length) { lines.push([]); continue; }
    const metadata=paragraph.map(()=>meta[wordIndex++]);
    const items=metadata.map((word,i)=>({width:(model.characters?word.graphemes.reduce((n,g)=>n+envelopes.get(g).width,0):envelopes.get(word.word).width)+(i<metadata.length-1?(model.characters?envelopes.get(" ").width:maxSpace):0)}));
    const prepared = prepareRichInline(items);
    walkRichInlineLineRanges(prepared, contentWidth, range => {
      const fragments = materializeRichInlineLineRange(prepared, range).fragments;
      let envelopeX = edgePadding;const line=[];
      fragments.forEach((fragment,position)=>{
        const i=fragment.itemIndex,word=metadata[i],gap=position<fragments.length-1;
        if(model.characters){
          const pieces=[...word.graphemes,...(gap?[' ']:[])];
          for(const piece of pieces){const width=envelopes.get(piece).width;line.push({...word,index:renderIndex++,word:piece,isSpace:piece===' ',gapAfter:false,envelopeX,envelopeWidth:width,envelopeCenter:envelopeX+width/2});envelopeX+=width;}
        }else{const width=items[i].width;line.push({...word,index:renderIndex++,gapAfter:gap,envelopeX,envelopeWidth:width,envelopeCenter:envelopeX+width/2});envelopeX+=width;}
      });lines.push(line);
    });
  }
  const height=Math.max(lineHeight,lines.length*lineHeight,(lines.length-1)*lineHeight+autoLineHeight);
  if(!Number.isFinite(height))throw new RangeError('These values produce a non-finite text height. Reduce one of the values.');
  return { lines, lineHeight, autoLineHeight, width: availableWidth, contentWidth, edgePadding, height, wordCount: wordIndex, entries:lines.flat() };
}

export function measureWordFresh(model, word, index) {
  const style = model.states[index];
  return Math.max(0,measureNaturalWidth(prepareWithSegments(word, style.font, { letterSpacing: style.tracking })));
}
