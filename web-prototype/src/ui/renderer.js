import { mixColor } from '../engine/morph.js';
import { fontStack, leadingAt } from '../engine/typography.js';
import { NEUTRAL_STYLE } from '../engine/properties.js';
import { fieldAmount, approach, defaultInteraction } from '../engine/interactions.js';
import { appearanceAt } from '../engine/appearance.js';
import { LiveReflow } from '../engine/reflow.js';
import { buildStructureDistribution } from '../engine/distribution.js';
import { measureWordFresh } from '../engine/measurements.js';

export class TextRenderer {
  constructor(stage) { this.stage = stage; this.nodes = []; this.positions = []; this.frameWrites = 0; }
  mount(model, layout) {
    this.referenceLayout=layout;this.live=false;this.liveEngine=null;this.installNodes(model,layout);
  }
  installNodes(model,layout){
    this.model = model; this.layout = layout; this.nodes = []; this.positions = []; this.structureKey = null;
    this.stage.replaceChildren();
    this.stage.setAttribute('aria-label', model.text || 'Empty text');
    this.stage.style.height = `${layout.height}px`;this.stageHeight=layout.height;
    const fragment = document.createDocumentFragment();
    const entries=layout.entries||model.words.map(word=>({word}));
    for (const entry of entries) {
      const word=entry.word;
      const node = document.createElement('span'), ink = document.createElement('span');
      node.className = 'word'; ink.className = 'word-ink'; ink.textContent = word;
      node.style.fontSize = `${model.maxSize}px`; node.style.lineHeight = `${layout.autoLineHeight??layout.lineHeight}px`;
      node.setAttribute('aria-hidden', 'true'); node.append(ink); fragment.append(node);
      if (!model.characters && this.nodes.length < entries.length - 1) fragment.append(document.createTextNode(' '));
      this.nodes.push({ node, ink, index: -1, family:'', color: '', x: NaN, y: NaN, amount: null, effectsKey: '',hidden:false,hostSize:model.maxSize,hostLeading:layout.autoLineHeight??layout.lineHeight });
    }
    this.stage.append(fragment);
  }
  // No DOM reads here. Geometry comes from the cached model and Pretext lines.
  render(amount, { pointer = null, mode = 'scrub', fresh = false, a = this.model.a, b = this.model.b, settings = null, distribution = null, liveReflow = false, deltaMs = 16 } = {}) {
    if(liveReflow!==this.live){
      if(liveReflow){const engine=new LiveReflow(this.model,this.referenceLayout);this.installNodes(this.model,{...engine.catalog.reference,entries:engine.catalog.entries});this.liveEngine=engine;}
      else this.installNodes(this.model,this.referenceLayout);
      this.live=liveReflow;
    }
    const model=this.model,controls=settings||{...defaultInteraction(mode),response:0};let writes=0,liveFrame=null;
    this.needsAnimation=false;
    if(this.live){
      liveFrame=this.liveEngine.compose(amount,{a,b,mode,pointer,settings:controls,distribution:distribution||undefined,deltaMs,previous:this.nodes.map(node=>node.amount)});
      this.layout=liveFrame.layout;this.structure=liveFrame.structure;this.needsAnimation=liveFrame.needsAnimation;
      if(this.stageHeight!==this.layout.height){this.stage.style.height=`${this.layout.height}px`;this.stageHeight=this.layout.height;writes++;}
      this.reflowState={passes:liveFrame.passes,stabilized:liveFrame.stabilized,oversized:this.layout.oversized};
      const visible=new Set(this.layout.entries.map(entry=>entry.index));
      this.nodes.forEach((item,index)=>{const hidden=!visible.has(index);if(item.hidden!==hidden){item.node.style.display=hidden?'none':'block';item.hidden=hidden;writes++;}if(hidden){item.amount=liveFrame.amounts[index]??0;this.positions[index]={x:0,y:0,width:0,amount:item.amount,state:0,hidden:true};}});
    }else{
      this.reflowState=null;
      if(distribution){const key=JSON.stringify(distribution);if(this.structureKey!==key){this.structure=buildStructureDistribution(this.layout,distribution);this.structureKey=key;}}
      else{this.structure=null;this.structureKey=null;}
    }
    const layout=this.layout;
    if(this.layoutKind!==this.live){this.stage.setAttribute('data-layout',this.live?'live':'stable');this.layoutKind=this.live;}
    if(this.lineCount!==layout.lines.length){this.stage.setAttribute('data-line-count',String(layout.lines.length));this.lineCount=layout.lines.length;}
    const leadingA=leadingAt(a,b,0,layout.autoLineHeight??layout.lineHeight),leadingB=leadingAt(a,b,1,layout.autoLineHeight??layout.lineHeight);
    let y=0;
    for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex++) {
      let x = layout.edgePadding||0, advance=0;
      const line = layout.lines[lineIndex];if(liveFrame)y=line.y;
      for (const entry of line) {
        const item=this.nodes[entry.index];
        let t;
        if(liveFrame)t=liveFrame.amounts[entry.index];
        else{
          const unit=this.structure?.entries[entry.index];let target=0;
          if(!this.structure||unit){if(mode==='curve'){target=amount*(unit?.value??0);if(controls.invert)target=1-target;}else target=fieldAmount(amount,{entry,lineIndex,lineCount:layout.lines.length,wordCount:layout.wordCount,lineHeight:layout.lineHeight,mode,pointer,settings:controls,coordinate:unit});}
          t=approach(item.amount,target,deltaMs,controls.response);if(t!==target)this.needsAnimation=true;
          advance=Math.max(advance,leadingA+(leadingB-leadingA)*t);
        }
        item.amount=t;
        const appearance=liveFrame?liveFrame.appearances[entry.index]:appearanceAt(model,entry,t,a,b,fresh?measureWordFresh:null);
        const {index,style,effects,bounds,flow,outlinePad}=appearance,wordWidth=flow.width;
        if(liveFrame){
          if(item.hostSize!==line.fontSize){item.node.style.fontSize=`${line.fontSize}px`;item.hostSize=line.fontSize;writes++;}
          if(item.hostLeading!==line.autoLineHeight){item.node.style.lineHeight=`${line.autoLineHeight}px`;item.hostLeading=line.autoLineHeight;writes++;}
        }
        const color = mixColor(a.color, b.color, t);
        const family=fontStack(style.fontFamily);if(item.family!==family){item.ink.style.fontFamily=family;item.family=family;writes++;}
        if (item.index !== index) {
          item.ink.style.fontSize = `${style.size}px`; item.ink.style.fontWeight = String(style.weight);
          item.ink.style.letterSpacing = `${style.tracking}px`; item.index = index; writes += 3;
        }
        if (item.color !== color) { item.ink.style.color = color; item.color = color; writes++; }
        const outlineA=a.outlineColor??NEUTRAL_STYLE.outlineColor,outlineB=b.outlineColor??NEUTRAL_STYLE.outlineColor;
        const outlineColor=outlineA===outlineB?outlineA:mixColor(outlineA,outlineB,t);
        const effectsKey=JSON.stringify(effects)+outlineColor;
        if(item.effectsKey!==effectsKey){
          item.ink.style.opacity=String(effects.opacity/100);
          item.ink.style.transform=`translateY(${effects.baseline}px) rotate(${effects.rotation}deg) skewX(${-effects.skew}deg) scale(${effects.scaleX/100},${effects.scaleY/100})`;
          item.ink.style.webkitTextStrokeWidth=`${effects.outlineWidth}px`;
          item.ink.style.webkitTextStrokeColor=outlineColor;
          item.effectsKey=effectsKey;writes+=4;
        }
        const nodeX=x+outlinePad-flow.minX;
        if (item.x !== nodeX || item.y !== y) { item.node.style.transform = `translate(${nodeX}px,${y}px)`; item.x = nodeX; item.y = y; writes++; }
        this.positions[entry.index] = { x:x+outlinePad, y, width: wordWidth, inkWidth:bounds.width, amount: t, state: index };
        x += wordWidth + 2*outlinePad + (entry.gapAfter === false ? 0 : model.space[index]);
      }
      if(!liveFrame)y+=advance||(leadingA+(leadingB-leadingA)*amount);
    }
    this.frameWrites = writes;
  }
  inspect() {
    const { width } = this.layout;
    let maxOverflow = 0, minGap = Infinity;
    for (const line of this.layout.lines) {
      for (let i = 0; i < line.length; i++) {
        const pos = this.positions[line[i].index];
        maxOverflow = Math.max(maxOverflow, pos.x + pos.width - width);
        if (i) { const prev = this.positions[line[i - 1].index]; minGap = Math.min(minGap, pos.x - prev.x - prev.width); }
      }
    }
    return { maxOverflow, minGap: Number.isFinite(minGap) ? minGap : null };
  }
}
