import { clamp, pointerAmount } from './morph.js';
export const MODES = ['scrub','curve','pointer','wipe','wave','scroll','press'];
export function defaultInteraction(mode) {
  return { unit:'word',radius:180,width:.25,speed:4.8,response:(mode==='pointer'||mode==='press')?140:0,easing:'linear',reverse:false,invert:false,playback:mode==='wave'?'loop':'bounce',sensitivity:800 };
}
export function eased(value,curve='linear') {
  const t=clamp(value);
  if(curve==='smooth')return t*t*(3-2*t);
  if(curve==='in')return t*t;
  if(curve==='out')return 1-(1-t)*(1-t);
  return t;
}
export function approach(current,target,deltaMs,responseMs) {
  if(!responseMs||current===null||current===undefined)return target;
  const next=current+(target-current)*(1-Math.exp(-Math.max(0,deltaMs)/responseMs));
  return Math.abs(next-target)<.0005?target:next;
}
export function timelineAmount(elapsedMs,settings,offset=0) {
  const phase=((Math.max(0,elapsedMs)/1000%settings.speed)/settings.speed+offset)%1;
  return settings.playback==='loop'?phase%1:(1-Math.cos(phase*Math.PI*2))/2;
}
export function fieldAmount(amount, {entry,lineIndex,lineCount,wordCount,lineHeight,mode='scrub',pointer=null,coordinate=null,settings=defaultInteraction(mode)}) {
  let t=clamp(amount);
  let u=coordinate?.u??(settings.unit==='line'?(lineIndex+.5)/Math.max(1,lineCount):(entry.index+.5)/Math.max(1,wordCount));
  if(settings.reverse&&(mode==='wipe'||mode==='wave'))u=1-u;
  if(mode==='pointer') {
    t=coordinate?pointerAmount(coordinate.verticalOnly&&pointer?pointer.x:coordinate.x,coordinate.y,pointer,settings.radius):settings.unit==='line'?(pointer?Math.exp(-.5*((lineIndex*lineHeight+lineHeight/2-pointer.y)/settings.radius)**2):0):pointerAmount(entry.envelopeCenter,lineIndex*lineHeight+lineHeight/2,pointer,settings.radius);
  } else if(mode==='wipe') {
    const width=settings.width;
    t=clamp((amount*(1+width)-u)/width);
  } else if(mode==='wave') {
    const d=Math.abs(u-amount),distance=Math.min(d,1-d);
    t=Math.exp(-.5*((distance/settings.width)*2)**2);
  }
  t=eased(t,settings.easing);
  return settings.invert?1-t:t;
}
