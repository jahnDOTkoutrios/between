import { alignLayout } from './alignment.js';
import { appearanceAt } from './appearance.js';
import { buildStructureDistribution,defaultDistribution,textStructure } from './distribution.js';
import { approach,defaultInteraction,fieldAmount } from './interactions.js';
import { leadingAt } from './typography.js';
const signature=layout=>layout.lines.map(line=>[...new Set(line.filter(e=>!e.isSpace).map(e=>e.wordIndex))].join(',')).join('|');
export function reflowCatalog(model,reference){
  const structure=model.structure||textStructure(model.text??model.words.join(' ')),entries=[],words=[];
  for(const metadata of structure.words){
    const pieces=model.characters?metadata.graphemes:[metadata.word],units=[];
    pieces.forEach((piece,charIndex)=>{const entry={...metadata,index:entries.length,word:piece,charIndex,isSpace:false,gapAfter:!model.characters};units.push(entry);entries.push(entry);});
    let gap=null;if(model.characters&&!metadata.lastInParagraph){gap={...metadata,index:entries.length,word:' ',charIndex:pieces.length,isSpace:true,gapAfter:false};entries.push(gap);}
    words.push({metadata,units,gap});
  }
  const cursors=new Map();
  const lines=reference.lines.map(line=>line.map(entry=>{
    const word=words[entry.wordIndex??entry.index];let unit;
    if(model.characters){const offset=cursors.get(word.metadata.wordIndex)||0;unit=entry.isSpace?word.gap:word.units[offset];if(!entry.isSpace)cursors.set(word.metadata.wordIndex,offset+1);}
    else unit=word.units[0];
    return{...unit,envelopeX:entry.envelopeX,envelopeWidth:entry.envelopeWidth,envelopeCenter:entry.envelopeCenter,gapAfter:entry.gapAfter};
  }));
  return{entries,words,paragraphs:structure.paragraphs,reference:{...reference,lines,entries:lines.flat()}};
}
export function fitLiveLayout(model,catalog,appearances,amounts,width,a,b,alignment='left'){
  const edgePadding=catalog.reference.edgePadding||0,contentWidth=Math.max(1,width-2*edgePadding);
  const lines=[],fallbackSize=Math.max(0,...appearances.map(app=>app.style.size));let y=0,oversized=false;
  function finish(packed){
    const line=[];let x=edgePadding;
    packed.forEach((word,i)=>{
      for(const unit of word.units){const app=appearances[unit.index];line.push({...unit,envelopeX:x,envelopeWidth:app.advance,envelopeCenter:x+app.advance/2,gapAfter:false});x+=app.advance;}
      if(i<packed.length-1){
        const last=word.units.at(-1),gap=word.gap,space=gap?appearances[gap.index].advance:model.space[appearances[last.index].index];
        if(gap)line.push({...gap,envelopeX:x,envelopeWidth:space,envelopeCenter:x+space/2});
        else line.at(-1).gapAfter=true;
        x+=space;
      }
    });
    const fontSize=line.length?Math.max(0,...line.map(e=>appearances[e.index].style.size)):fallbackSize;
    const autoLineHeight=line.length?Math.ceil(Math.max(fontSize*1.55,...line.map(e=>{const app=appearances[e.index];return app.bounds.height+2*Math.abs(app.effects.baseline)+2*app.outlinePad+fontSize*.4;}))):Math.ceil(fallbackSize*1.55);
    const advance=line.length?Math.max(...line.map(e=>leadingAt(a,b,amounts[e.index],autoLineHeight))):leadingAt(a,b,0,autoLineHeight);
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(advance)||!Number.isFinite(autoLineHeight))throw new RangeError('These values produce non-finite live layout bounds. Reduce one of the values.');
    Object.assign(line,{y,fontSize,autoLineHeight,advance,totalWidth:x});
    for(const entry of line)entry.anchorY=y+autoLineHeight/2;
    lines.push(line);oversized||=x>width-edgePadding+.01;y+=advance;
  }
  let wordIndex=0;
  for(const paragraph of catalog.paragraphs){
    let packed=[],used=0,previousGap=0;
    for(let i=0;i<paragraph.length;i++){
      const word=catalog.words[wordIndex++],wordWidth=word.units.reduce((sum,unit)=>sum+appearances[unit.index].advance,0);
      if(packed.length&&used+previousGap+wordWidth>contentWidth+1e-7){finish(packed);packed=[];used=0;previousGap=0;}
      if(packed.length)used+=previousGap;packed.push(word);used+=wordWidth;
      previousGap=word.gap?appearances[word.gap.index].advance:model.space[appearances[word.units.at(-1).index].index];
    }
    finish(packed);
  }
  const height=Math.max(0,...lines.map(line=>line.y+Math.max(line.advance,line.autoLineHeight))),lineHeight=Math.max(0,...lines.map(line=>line.advance)),autoLineHeight=Math.max(0,...lines.map(line=>line.autoLineHeight));
  if(!Number.isFinite(height))throw new RangeError('These values produce a non-finite live text height. Reduce one of the values.');
  return alignLayout({lines,entries:lines.flat(),height,lineHeight,autoLineHeight,width,contentWidth,edgePadding,wordCount:catalog.words.length,oversized,live:true},alignment);
}
function targetsFor(layout,amount,mode,pointer,settings,distribution){
  const structure=buildStructureDistribution(layout,distribution),targets=[];
  layout.lines.forEach((line,lineIndex)=>line.forEach(entry=>{
    const unit=structure.entries[entry.index];let target=0;
    if(unit){if(mode==='curve'){target=amount*unit.value;if(settings.invert)target=1-target;}else target=fieldAmount(amount,{entry,lineIndex,lineCount:layout.lines.length,wordCount:layout.wordCount,lineHeight:layout.lineHeight,mode,pointer,settings,coordinate:unit});}
    targets[entry.index]=target;
  }));
  return{targets,structure};
}
export class LiveReflow {
  constructor(model,reference){this.model=model;this.catalog=reflowCatalog(model,reference);this.result=null;this.key=null;this.pointerKey=null;}
  compose(amount,{a=this.model.a,b=this.model.b,mode='scrub',pointer=null,settings=defaultInteraction(mode),distribution=defaultDistribution(),deltaMs=16,previous=[],alignment=this.catalog.reference.alignment||'left'}={}){
    const key=JSON.stringify([amount,a,b,mode,pointer,settings,distribution,alignment]);
    if(key===this.key&&this.result&&!this.result.needsAnimation)return this.result;
    if(key!==this.key)this.latched=null;
    let seed=this.catalog.reference;
    // A stationary pointer samples one layout, then holds those anchors while
    // response settles. Moving the pointer resamples the current fitted layout.
    if(mode==='pointer'){
      const pointerKey=JSON.stringify([pointer,a,b,settings,distribution,alignment]);
      if(pointerKey!==this.pointerKey){this.pointerAnchor=this.result?.layout||seed;this.pointerKey=pointerKey;}
      seed=this.pointerAnchor;
    }
    const dependent=distribution.scope==='line'||(['curve','wave','wipe'].includes(mode)&&(['line','character'].includes(distribution.unit)||distribution.restart==='line'));
    const iterate=dependent&&mode!=='pointer'&&!this.latched;
    const seen=new Set([signature(seed)]);let result;
    for(let pass=1;pass<=(iterate?6:1);pass++){
      const sampled=this.latched||targetsFor(seed,amount,mode,pointer,settings,distribution),amounts=[],appearances=[];let needsAnimation=false;
      for(const entry of this.catalog.entries){if(sampled.targets[entry.index]===undefined)continue;const target=sampled.targets[entry.index],t=approach(previous[entry.index]??null,target,deltaMs,settings.response);amounts[entry.index]=t;needsAnimation||=t!==target;appearances[entry.index]=appearanceAt(this.model,entry,t,a,b);}
      for(const word of this.catalog.words)if(word.gap&&amounts[word.gap.index]===undefined){const t=amounts[word.units.at(-1).index]??0;amounts[word.gap.index]=t;appearances[word.gap.index]=appearanceAt(this.model,word.gap,t,a,b);}
      const layout=fitLiveLayout(this.model,this.catalog,appearances,amounts,this.catalog.reference.width,a,b,alignment),next=signature(layout);
      result={layout,amounts,appearances,needsAnimation,structure:sampled.structure,passes:pass,stabilized:!!this.latched};
      if(!iterate||next===signature(seed))break;
      if(seen.has(next)||pass===6){this.latched=sampled;result.stabilized=true;break;}
      seen.add(next);seed=layout;
    }
    // Scope availability follows the fitted text even when assignments had to
    // remain sampled to stop a cycle.
    if(distribution.scope==='line')result.structure={...result.structure,scopeCount:result.layout.lines.filter(line=>line.length).length};
    this.key=key;this.result=result;return result;
  }
}
