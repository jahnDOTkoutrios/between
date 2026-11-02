import { fixedSampling } from './distribution.js';
import { layoutModel } from './measurements.js';
import { reflowCatalog } from './reflow.js';

const sourceFields=['fontFamily','size','weight','tracking','lineHeight','scaleX','scaleY','rotation','skew','baseline','outlineWidth'];
export function sampleContext(model,a,distribution){
  return JSON.stringify([model.text,!!model.characters,sourceFields.map(key=>a[key]??null),distribution.unit,distribution.scope,distribution.restart,distribution.sampleWidth??100]);
}
export function validLineSample(sample,wordCount){
  if(!sample||sample.version!==1||typeof sample.context!=='string'||sample.context.length>12000||!Number.isFinite(sample.referenceWidth)||sample.referenceWidth<=0||!Number.isFinite(sample.width)||sample.width<=0||!Array.isArray(sample.lines)||sample.lines.length>wordCount+3001)return false;
  let next=0;
  for(const line of sample.lines){if(!Array.isArray(line))return false;for(const word of line)if(!Number.isInteger(word)||word!==next++)return false;}
  return next===wordCount;
}
export const entryIdentity=(entry,characters)=>characters?`${entry.wordIndex??entry.index}:${entry.isSpace?'space':entry.charIndex??0}`:String(entry.wordIndex??entry.index);

// Only topology is frozen. Values, steps, noise and offsets remain editable.
// Virtual composition uses the already measured Style A widths; no font/DOM reads.
export class CurveSampling {
  constructor(onSample=()=>{}){this.onSample=onSample;}
  resolve(model,reference,a,b,distribution,mode='curve'){
    if(mode!=='curve'||!fixedSampling(distribution))return null;
    const context=sampleContext(model,a,distribution);let sample=distribution.lineSample;
    if(!validLineSample(sample,model.words.length)||sample.context!==context){
      const percent=distribution.sampleWidth??100;
      if(!Number.isFinite(percent)||percent<=0)throw new RangeError('Sample width must be positive.');
      const width=Math.max(Number.MIN_VALUE,Math.min(Number.MAX_VALUE,reference.width/100*percent));
      const baseline={...model,maxSize:a.size,widths:new Map([...model.widths].map(([word,values])=>[word,[values[0]]])),space:[model.space[0]]};
      const composed=layoutModel(baseline,width,a,a,reference.alignment||'left');
      sample={version:1,context,referenceWidth:reference.width,width,lines:composed.lines.map(line=>[...new Set(line.filter(e=>!e.isSpace).map(e=>e.wordIndex))])};
      distribution.lineSample=sample;this.onSample(sample);
    }
    if(this.model===model&&this.sample===sample)return this.source;
    const catalog=reflowCatalog(model,reference);
    const lines=sample.lines.map(words=>words.flatMap((wordIndex,i)=>{
      const word=catalog.words[wordIndex];return [...word.units,...(i<words.length-1&&word.gap?[word.gap]:[])].map(entry=>({...entry,envelopeCenter:0}));
    }));
    this.model=model;this.sample=sample;this.source={...reference,lines,entries:lines.flat(),sampleKey:JSON.stringify(sample)};return this.source;
  }
}

export function mapSampledStructure(structure,source,layout,characters){
  const byIdentity=new Map(source.entries.map(entry=>[entryIdentity(entry,characters),structure.entries[entry.index]])),entries=[];
  for(const line of layout.lines)for(const entry of line)entries[entry.index]=byIdentity.get(entryIdentity(entry,characters));
  return{...structure,entries};
}
