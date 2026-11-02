import { clamp } from './morph.js';
import { defaultNoise,activeNoise,noiseSample,noisyValue,wordGroupIndices } from './noise.js';
export const CURVES=[['linear','Linear'],['in','Ease in'],['out','Ease out'],['smooth','S-curve'],['gaussian','Gaussian'],['sine','Sine'],['triangle','Triangle'],['custom','Custom']];
export const defaultDistribution=()=>({unit:'word',scope:'text',scopeIndex:1,restart:'never',restartWords:1,curve:'linear',steps:0,peak:.5,width:.22,power:2,invert:false,smooth:true,points:[{x:0,y:0},{x:.5,y:1},{x:1,y:0}],noise:defaultNoise()});
export const characterUnits=settings=>['letter','character'].includes(settings.unit);
export function graphemes(text){return Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text),part=>part.segment);}
export function textStructure(text){
  const paragraphs=text.replace(/\r\n?/g,'\n').split('\n').map(p=>p.match(/\S+/gu)||[]),words=[];let sentenceOffset=0;
  paragraphs.forEach((paragraph,paragraphIndex)=>{
    const joined=paragraph.join(' '),sentences=Array.from(new Intl.Segmenter(undefined,{granularity:'sentence'}).segment(joined));let start=0,at=0;
    paragraph.forEach((word,localIndex)=>{while(at+1<sentences.length&&start>=sentences[at+1].index)at++;words.push({word,wordIndex:words.length,paragraphIndex,sentenceIndex:sentenceOffset+at,graphemes:graphemes(word),lastInParagraph:localIndex===paragraph.length-1});start+=word.length+1;});
    sentenceOffset+=sentences.length;
  });
  return{paragraphs,words};
}
export function curveAt(x,settings){
  x=clamp(x);let value=x;const peak=clamp(settings.peak??.5),power=settings.power??2;
  if(settings.curve==='in')value=x**power;
  else if(settings.curve==='out')value=1-(1-x)**power;
  else if(settings.curve==='smooth')value=x*x*(3-2*x);
  else if(['gaussian','sine','triangle'].includes(settings.curve)){
    const u=peak===0?1-x:peak===1?x:x<=peak?x/peak:(1-x)/(1-peak);
    if(settings.curve==='triangle')value=u;
    else if(settings.curve==='sine')value=Math.sin(Math.PI/2*u);
    else{const sigma=settings.width??.22,k=.5*(.5/sigma)**2;
      if(u===1)value=1;else if(u===0||!Number.isFinite(k))value=0;else if(k===0)value=1-(1-u)**2;
      else value=(Math.expm1(-k*(1-u)**2)-Math.expm1(-k))/-Math.expm1(-k);
    }
  }else if(settings.curve==='custom'){
    const points=settings.points||[{x:0,y:0},{x:1,y:1}];let i=0;while(i+1<points.length&&x>points[i+1].x)i++;
    const a=points[i],b=points[Math.min(i+1,points.length-1)];let t=b.x===a.x?0:clamp((x-a.x)/(b.x-a.x));if(settings.smooth)t=t*t*(3-2*t);value=a.y+(b.y-a.y)*t;
  }
  value=clamp(value);return settings.invert?1-value:value;
}
export function moveCurvePoint(points,index,x,y){const point=points[index];point.x=index===0?0:index===points.length-1?1:clamp(x,points[index-1].x+.005,points[index+1].x-.005);point.y=clamp(y);return point;}
export function addCurvePoint(points,x,y){x=clamp(x,.005,.995);if(points.length>=12)return points.length-1;const close=points.findIndex(p=>Math.abs(p.x-x)<.01);if(close>=0)return close;points.push({x,y:clamp(y)});points.sort((a,b)=>a.x-b.x);return points.findIndex(p=>p.x===x);}
const keyOf=(entry,kind)=>kind==='text'||kind==='all'?'all':kind==='character'||kind==='letter'?entry.index:entry[`${kind}Index`]??(kind==='word'?entry.index:0);
export function buildStructureDistribution(layout,settings,mode='curve'){
  const entries=layout.lines.flatMap((line,lineIndex)=>line.map(entry=>({...entry,lineIndex}))),result=[],scopeKeys=[...new Set(entries.filter(e=>!e.isSpace).map(e=>keyOf(e,settings.scope)))];
  const selected=settings.scope==='text'?null:scopeKeys[Math.min(scopeKeys.length-1,Math.max(0,settings.scopeIndex-1))];
  const scoped=entries.filter(e=>selected===null||keyOf(e,settings.scope)===selected),wordKeys=[...new Set(scoped.map(e=>keyOf(e,'word')))],wordRanks=new Map(wordKeys.map((key,i)=>[key,i]));
  const config=mode==='curve'?settings.noise:null,wordGroups=settings.restart==='word'?wordGroupIndices(wordKeys.length,settings.restartWords,config):null,valueNoise=activeNoise(config,'values');
  const groups=new Map();
  for(const entry of scoped){const key=settings.restart==='word'?wordGroups[wordRanks.get(keyOf(entry,'word'))]:keyOf(entry,settings.restart==='never'?'text':settings.restart);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);}
  const samples=[];let noiseOffset=0;
  for(const group of groups.values()){
    const units=new Map();
    for(const entry of group){if(settings.unit==='letter'&&entry.isSpace)continue;const key=keyOf(entry,settings.unit);if(!units.has(key))units.set(key,[]);units.get(key).push(entry);}
    const list=[...units.values()],steps=settings.steps?Math.max(1,Math.min(list.length,Math.round(settings.steps))):list.length,values=[];
    list.forEach((unit,i)=>{
      const progress=list.length<2?0:i/(list.length-1),bucket=steps<2?0:Math.round(progress*(steps-1)),sample=steps<2?0:bucket/(steps-1);
      const delta=valueNoise?valueNoise.amount*noiseSample(valueNoise,noiseOffset+bucket*list.length/steps):0,value=valueNoise?noisyValue(curveAt(sample,settings),delta):curveAt(sample,settings);
      const x=unit.reduce((sum,e)=>sum+e.envelopeCenter,0)/unit.length,y=unit.reduce((sum,e)=>sum+(e.anchorY??(e.lineIndex+.5)*layout.lineHeight),0)/unit.length;
      for(const entry of unit)result[entry.index]={u:(i+.5)/list.length,value,x,y,verticalOnly:settings.unit==='line'};values.push(value);
    });
    // Letter mode leaves gaps tied to their preceding grapheme without counting
    // those gaps as additional curve samples.
    let previous=null;for(const entry of group){if(result[entry.index])previous=result[entry.index];else if(entry.isSpace)result[entry.index]=previous;}
    samples.push(values);
    noiseOffset+=list.length;
  }
  return{entries:result,groups:groups.size,scopeCount:scopeKeys.length,samples};
}
