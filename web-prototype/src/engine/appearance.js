import { typeIndex,STATE_COUNT } from './morph.js';
import { effectsAt } from './properties.js';
import { visualBounds,flowBounds } from './geometry.js';
// Shared numeric geometry for fitting and painting. No DOM/font reads here.
export function appearanceAt(model,entry,t,a,b,freshMeasure=null){
  const index=typeIndex(t,a,b),style=model.states[index],effects=effectsAt(a,b,t);
  effects.outlineWidth=(a.outlineWidth??0)+((b.outlineWidth??0)-(a.outlineWidth??0))*index/(STATE_COUNT-1);
  const baseWidth=freshMeasure?freshMeasure(model,entry.word,index):model.widths.get(entry.word)[index];
  const bounds=visualBounds(baseWidth,style.size,effects),outlinePad=effects.outlineWidth*Math.max(Math.abs(effects.scaleX),Math.abs(effects.scaleY))/100;
  const flow=flowBounds(baseWidth,style.size,effects);
  return{index,style,effects,bounds,flow,outlinePad,advance:flow.width+2*outlinePad};
}
