import { textStructure } from '../../src/engine/distribution.js';
import { NEUTRAL_STYLE } from '../../src/engine/properties.js';
import { typeState } from '../../src/engine/morph.js';
export function reflowModel(text='aa bb cc dd ee ff gg hh',{characters=false,a:overridesA={},b:overridesB={}}={}){
  const a={...NEUTRAL_STYLE,size:10,...overridesA},b={...NEUTRAL_STYLE,size:50,...overridesB},structure=textStructure(text),words=structure.words.map(w=>w.word),states=Array.from({length:65},(_,i)=>typeState(a,b,i/64)),space=Float64Array.from(states,s=>s.size*.25);
  const unique=[...new Set(characters?[...structure.words.flatMap(w=>w.graphemes),' ']:words)],widths=new Map(unique.map(word=>[word,Float64Array.from(states,s=>word===' '?s.size*.25:word.length*s.size*.5)]));
  return{text,structure,paragraphs:structure.paragraphs,words,characters,a,b,states,space,widths,maxSize:Math.max(a.size,b.size)};
}
