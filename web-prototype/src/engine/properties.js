import { FONT_CHOICES } from './typography.js';
// One registry owns control ranges, reset values and the effective style.
// Inactive properties inherit Base, never stale endpoint overrides.
const number = (key, label, min, max, step, unit, a, b, neutral) => ({ key, label, type: 'number', min, max, step, unit, a, b, neutral });
export const PROPERTIES = [
  { id: 'size', label: 'Size', fields: [number('size','Size',0,undefined,'any','px',30,46,32)] },
  { id: 'weight', label: 'Weight', fields: [number('weight','Weight',1,1000,'any','',350,720,400)] },
  { id: 'tracking', label: 'Tracking', fields: [number('tracking','Tracking',undefined,undefined,'any','px',-.5,1.4,0)] },
  { id: 'color', label: 'Color', fields: [{ key:'color',label:'Color',type:'color',a:'#252525',b:'#a2a29b',neutral:'#252525' }] },
  { id:'fontFamily',label:'Font family',inherit:true,fields:[{key:'fontFamily',label:'Font',type:'select',choices:FONT_CHOICES.map(font=>[font.id,font.label]),a:'manrope',b:'manrope',neutral:'manrope'}] },
  { id:'lineHeight',label:'Line height',inherit:true,fields:[{...number('lineHeight','Leading',0,undefined,'any','px',0,0,0),auto:true}] },
  { id: 'opacity', label: 'Opacity', fields: [number('opacity','Opacity',0,100,'any','%',100,20,100)] },
  { id: 'baseline', label: 'Vertical shift', fields: [number('baseline','Shift',undefined,undefined,'any','px',0,-24,0)] },
  { id: 'rotation', label: 'Rotation', fields: [number('rotation','Rotation',undefined,undefined,'any','°',0,12,0)] },
  { id: 'skew', label: 'Skew', fields: [number('skew','Skew',undefined,undefined,'any','°',0,-15,0)] },
  { id: 'scaleX', label: 'Width', fields: [number('scaleX','Width',undefined,undefined,'any','%',100,125,100)] },
  { id: 'scaleY', label: 'Height', fields: [number('scaleY','Height',undefined,undefined,'any','%',100,125,100)] },
  { id: 'outline', label: 'Outline', fields: [number('outlineWidth','Outline',0,undefined,'any','px',0,1.2,0),{key:'outlineColor',label:'Outline color',type:'color',a:'#252525',b:'#252525',neutral:'#252525'}] },
];
export const INITIAL_PROPERTIES = ['size','weight','tracking','color'];
export const ALL_FIELDS = PROPERTIES.flatMap(property => property.fields);
export const NEUTRAL_STYLE = Object.fromEntries(ALL_FIELDS.map(field => [field.key, field.neutral]));
export function endpointDefaults(endpoint) { return Object.fromEntries(PROPERTIES.filter(property=>!property.inherit).flatMap(property=>property.fields).map(field => [field.key, field[endpoint]])); }
export function effectiveStyle(raw, active, base=NEUTRAL_STYLE) {
  const result = { ...NEUTRAL_STYLE, ...base };
  for (const property of PROPERTIES) if (active.has(property.id)) for (const field of property.fields) if(Object.hasOwn(raw,field.key))result[field.key] = raw[field.key];
  return result;
}
export function effectsAt(a, b, t) {
  const value = key => (a[key] ?? NEUTRAL_STYLE[key]) + ((b[key] ?? NEUTRAL_STYLE[key]) - (a[key] ?? NEUTRAL_STYLE[key])) * t;
  return { opacity:value('opacity'),baseline:value('baseline'),rotation:value('rotation'),skew:value('skew'),scaleX:value('scaleX'),scaleY:value('scaleY'),outlineWidth:value('outlineWidth') };
}
export function layoutKey(a,b) { return ['baseline','rotation','skew','scaleX','scaleY','outlineWidth','lineHeight'].flatMap(key=>[a[key]??NEUTRAL_STYLE[key],b[key]??NEUTRAL_STYLE[key]]).join(':'); }

// Explicit endpoint fields override Base; absence means live inheritance.
export class StyleCascade {
  constructor(){this.reset();}
  reset(){this.base={...NEUTRAL_STYLE};this.active=new Set(INITIAL_PROPERTIES);this.raw={a:endpointDefaults('a'),b:endpointDefaults('b')};return this.styles();}
  styles(){return{a:effectiveStyle(this.raw.a,this.active,this.base),b:effectiveStyle(this.raw.b,this.active,this.base)};}
  setBase(key,value){this.base[key]=value;}
  override(endpoint,key,value){this.raw[endpoint][key]=value;}
  inherit(endpoint,key){delete this.raw[endpoint][key];}
  owns(endpoint,key){return Object.hasOwn(this.raw[endpoint],key);}
}

export function validStyleNumber(field,value){return Number.isFinite(value)&&(field.min===undefined||value>=field.min)&&(field.max===undefined||value<=field.max);}
