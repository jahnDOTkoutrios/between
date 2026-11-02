import { clamp } from './morph.js';

export const NOISE_TYPES=[['off','Off'],['random','Random'],['smooth','Smooth'],['fractal','Fractal']];
export const defaultNoise=()=>({type:'off',amount:25,seed:1,values:true,restartWords:false});
export function normalizeNoise(source){
  const n=defaultNoise();if(!source||typeof source!=='object')return n;
  if(NOISE_TYPES.some(([id])=>id===source.type))n.type=source.type;
  if(Number.isFinite(source.amount)&&source.amount>=0&&source.amount<=100)n.amount=source.amount;
  if(Number.isInteger(source.seed)&&source.seed>=0&&source.seed<=2147483647)n.seed=source.seed;
  for(const key of ['values','restartWords'])if(typeof source[key]==='boolean')n[key]=source[key];
  return n;
}
export function activeNoise(config,target){
  if(!config||!['random','smooth','fractal'].includes(config.type)||!config[target]||!Number.isFinite(config.amount)||config.amount<=0||config.amount>100||!Number.isInteger(config.seed)||config.seed<0||config.seed>2147483647)return null;
  return{type:config.type,amount:config.amount/100,seed:config.seed};
}
// Same integer mixer, fields and independent streams as Tracking Ramp v8.
export function noiseSample(noise,position,channel=1013904223){
  function random(index){
    let x=noise.seed^(index|0)^channel;
    x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
    return((x^(x>>>16))>>>0)/4294967295*2-1;
  }
  function smooth(scale){const x=position/scale,left=Math.floor(x),t=x-left,u=t*t*(3-2*t);return random(left)*(1-u)+random(left+1)*u;}
  if(noise.type==='random')return random(Math.floor(position));
  if(noise.type==='smooth')return smooth(4);
  return(smooth(8)*8+smooth(4)*4+smooth(2)*2+smooth(1))/15;
}
export const noisyValue=(value,delta)=>clamp(value+delta);
export function wordGroupIndices(count,base,config){
  const noise=activeNoise(config,'restartWords'),indices=[];base=Math.max(1,base||1);
  for(let start=0,group=0;start<count;group++){
    const length=noise?Math.max(1,Math.min(Number.MAX_SAFE_INTEGER,Math.round(base*(1+noise.amount*noiseSample(noise,group,1664525))))):base;
    const end=Math.min(count,start+length);for(let i=start;i<end;i++)indices[i]=group;start=end;
  }
  return indices;
}
