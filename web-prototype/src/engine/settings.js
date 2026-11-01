import { StyleCascade,ALL_FIELDS,PROPERTIES,validStyleNumber } from './properties.js';
import { FONT_CHOICES } from './typography.js';
import { defaultDistribution,CURVES } from './distribution.js';
import { MODES,defaultInteraction } from './interactions.js';
import { envelope } from './geometry.js';
import { PHRASE,PARAGRAPH } from '../samples.js';

export const SETTINGS_KEY='between-setup-v1';
export function cascadeSnapshot(state){return{base:{...state.base},raw:{a:{...state.raw.a},b:{...state.raw.b}},active:[...state.active]};}
export function defaultSetup(dark=false){
  const state=new StyleCascade();
  if(dark)for(const style of [state.base,state.raw.a,state.raw.b])for(const key of ['color','outlineColor']){if(style[key]==='#252525')style[key]='#e5e5e5';else if(style[key]==='#a2a29b')style[key]='#999992';}
  return{version:1,styles:cascadeSnapshot(state),text:PHRASE,sample:'phrase',distribution:defaultDistribution(),profiles:Object.fromEntries(MODES.map(mode=>[mode,defaultInteraction(mode)])),mode:'scrub',amount:0,liveReflow:false,dark};}
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const choice=(value,values,fallback)=>values.includes(value)?value:fallback;
const number=(value,fallback,min=-Infinity,max=Infinity,integer=false)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max&&(!integer||Number.isInteger(value))?value:fallback;
function styleValues(source,fallback,fontIDs){
  const result={...fallback};source=object(source);
  for(const field of ALL_FIELDS){
    if(!Object.hasOwn(source,field.key))continue;const value=source[field.key];
    if(field.type==='number'&&validStyleNumber(field,value)||field.type==='color'&&typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)||field.key==='fontFamily'&&fontIDs.includes(value))result[field.key]=value;
  }
  return result;
}
export function normalizeSetup(source,fontIDs=FONT_CHOICES.map(font=>font.id)){
  const defaults=defaultSetup();source=object(source);if(source.version!==1)return defaults;
  const saved=object(source.styles),raw=object(saved.raw),state=new StyleCascade();
  state.base=styleValues(saved.base,state.base,fontIDs);
  for(const endpoint of ['a','b'])state.raw[endpoint]=styleValues(raw[endpoint],Object.hasOwn(raw,endpoint)?{}:state.raw[endpoint],fontIDs);
  if(Array.isArray(saved.active))state.active=new Set(saved.active.filter(id=>PROPERTIES.some(p=>p.id===id)));
  try{const {a,b}=state.styles();envelope(1,Math.max(a.size,b.size),a,b);defaults.styles=cascadeSnapshot(state);}catch{/* Invalid saved geometry uses safe defaults. */}
  const d=defaults.distribution,s=object(source.distribution);
  for(const key of ['unit','scope','restart','curve']){
    const allowed={unit:['all','character','letter','word','sentence','line','paragraph'],scope:['text','paragraph','sentence','line','word'],restart:['never','word','sentence','paragraph','line'],curve:CURVES.map(([id])=>id)};
    d[key]=choice(s[key],allowed[key],d[key]);
  }
  for(const key of ['scopeIndex','restartWords'])d[key]=number(s[key],d[key],1,Number.MAX_SAFE_INTEGER,true);
  d.steps=number(s.steps,d.steps,0,Number.MAX_SAFE_INTEGER,true);d.peak=number(s.peak,d.peak,0,1);
  for(const key of ['width','power'])d[key]=number(s[key],d[key],Number.MIN_VALUE);
  for(const key of ['invert','smooth'])if(typeof s[key]==='boolean')d[key]=s[key];
  if(Array.isArray(s.points)&&s.points.length>=2&&s.points.length<=12&&s.points.every((p,i,all)=>p&&number(p.x,null,0,1)!==null&&number(p.y,null,0,1)!==null&&(i===0?p.x===0:p.x-all[i-1].x>=.004999))&&s.points.at(-1).x===1)d.points=s.points.map(p=>({x:p.x,y:p.y}));
  for(const mode of MODES){const p=defaults.profiles[mode],saved=object(object(source.profiles)[mode]);
    for(const key of ['radius','width','speed','sensitivity'])p[key]=number(saved[key],p[key],Number.MIN_VALUE);
    p.response=number(saved.response,p.response,0);
    p.easing=choice(saved.easing,['linear','smooth','in','out'],p.easing);p.playback=choice(saved.playback,['bounce','loop'],p.playback);p.unit=choice(saved.unit,['word','line'],p.unit);
    for(const key of ['reverse','invert'])if(typeof saved[key]==='boolean')p[key]=saved[key];
  }
  defaults.mode=choice(source.mode,MODES,defaults.mode);defaults.amount=number(source.amount,0,0,1);
  if(typeof source.text==='string')defaults.text=source.text.slice(0,3000);
  defaults.sample=defaults.text===PHRASE?'phrase':defaults.text===PARAGRAPH?'paragraph':'custom';
  for(const key of ['dark','liveReflow'])if(typeof source[key]==='boolean')defaults[key]=source[key];
  return defaults;
}
export function readSetup(storage){try{const raw=storage.getItem(SETTINGS_KEY);return raw?JSON.parse(raw):null;}catch{return null;}}
export function writeSetup(storage,setup){try{storage.setItem(SETTINGS_KEY,JSON.stringify(setup));return true;}catch{return false;}}
export function restoreCascade(state,saved){state.base={...saved.base};state.raw={a:{...saved.raw.a},b:{...saved.raw.b}};state.active=new Set(saved.active);}
