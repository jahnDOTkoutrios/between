import test from 'node:test';
import assert from 'node:assert/strict';
import { PROPERTIES,INITIAL_PROPERTIES,ALL_FIELDS,NEUTRAL_STYLE,endpointDefaults,effectiveStyle,effectsAt,layoutKey } from '../src/engine/properties.js';
import { defaultInteraction,fieldAmount,eased,approach,timelineAmount } from '../src/engine/interactions.js';
import { visualBounds,envelope } from '../src/engine/geometry.js';
const context=(index=0,extra={})=>({entry:{index,envelopeCenter:index*50+25},lineIndex:0,lineCount:2,wordCount:8,lineHeight:70,...extra});

test('property registry has unique ids and valid paired endpoint defaults',()=>{
  assert.equal(new Set(PROPERTIES.map(p=>p.id)).size,PROPERTIES.length);
  assert.equal(new Set(ALL_FIELDS.map(f=>f.key)).size,ALL_FIELDS.length);
  for(const field of ALL_FIELDS)for(const endpoint of ['a','b'])if(field.type==='number')assert.ok((field.min===undefined||field[endpoint]>=field.min)&&(field.max===undefined||field[endpoint]<=field.max));else if(field.type==='select')assert.ok(field.choices.some(([value])=>value===field[endpoint]));else assert.match(field[endpoint],/^#[0-9a-f]{6}$/i);
});
test('optional property removal resolves both styles to neutral without losing saved values',()=>{
  const raw=endpointDefaults('b'),active=new Set([...INITIAL_PROPERTIES,'rotation','outline']);
  assert.equal(effectiveStyle(raw,active).rotation,12);assert.equal(effectiveStyle(raw,active).outlineWidth,1.2);
  active.delete('rotation');active.delete('outline');
  assert.equal(effectiveStyle(raw,active).rotation,0);assert.equal(effectiveStyle(raw,active).outlineWidth,0);
  active.add('rotation');assert.equal(effectiveStyle(raw,active).rotation,12);
});
test('removing all properties produces a complete neutral style',()=>assert.deepEqual(effectiveStyle(endpointDefaults('b'),new Set()),NEUTRAL_STYLE));
test('all optional numeric effects interpolate together with exact endpoints',()=>{
  const a=endpointDefaults('a'),b=endpointDefaults('b');
  assert.equal(effectsAt(a,b,0).opacity,100);assert.equal(effectsAt(a,b,1).opacity,20);
  assert.equal(effectsAt(a,b,.5).rotation,6);assert.equal(effectsAt(a,b,.5).baseline,-12);
  assert.equal(effectsAt(a,b,.5).scaleX,112.5);assert.equal(effectsAt(a,b,.5).outlineWidth,.6);
});
test('paint-only effects do not invalidate layout reservations',()=>{
  const a=endpointDefaults('a'),b=endpointDefaults('b');
  assert.equal(layoutKey(a,b),layoutKey({...a,opacity:20,outlineColor:'#ffffff'},b));
  assert.notEqual(layoutKey(a,b),layoutKey({...a,rotation:30},b));
});
test('wipe reaches exact endpoints for every word',()=>{
  for(let i=0;i<100;i++)for(const progress of [0,1])assert.equal(fieldAmount(progress,context(i,{wordCount:100,mode:'wipe',settings:defaultInteraction('wipe')})),progress);
});
test('wipe respects reading order and line grouping',()=>{
  const settings=defaultInteraction('wipe');
  const values=Array.from({length:8},(_,i)=>fieldAmount(.5,context(i,{mode:'wipe',settings})));
  assert.ok(values.every((v,i)=>!i||values[i-1]>=v));assert.ok(new Set(values).size>1);
  settings.unit='line';assert.equal(fieldAmount(.5,context(0,{mode:'wipe',settings})),fieldAmount(.5,context(3,{mode:'wipe',settings})));
});
test('wave is periodic at its loop seam and strongest at its center',()=>{
  const settings=defaultInteraction('wave');
  for(let i=0;i<8;i++)assert.ok(Math.abs(fieldAmount(0,context(i,{mode:'wave',settings}))-fieldAmount(1,context(i,{mode:'wave',settings})))<1e-12);
  assert.equal(fieldAmount(.0625,context(0,{mode:'wave',settings})),1);
});
test('proximity radius and line grouping have independent meanings',()=>{
  const settings=defaultInteraction('pointer'),pointer={x:25,y:35};
  assert.equal(fieldAmount(0,context(0,{mode:'pointer',settings,pointer})),1);
  settings.unit='line';assert.equal(fieldAmount(0,context(0,{mode:'pointer',settings,pointer})),fieldAmount(0,context(6,{mode:'pointer',settings,pointer})));
  settings.invert=true;assert.equal(fieldAmount(0,context(0,{mode:'pointer',settings,pointer})),0);
});
test('reversing wipe changes travel direction while preserving A/B endpoints',()=>{
  const settings={...defaultInteraction('wipe'),reverse:true};
  for(let i=0;i<8;i++)for(const progress of [0,1])assert.equal(fieldAmount(progress,context(i,{mode:'wipe',settings})),progress);
  assert.ok(fieldAmount(.5,context(7,{mode:'wipe',settings}))>fieldAmount(.5,context(0,{mode:'wipe',settings})));
});
test('easing stays bounded and preserves endpoints',()=>{
  for(const curve of ['linear','smooth','in','out'])for(let i=0;i<=100;i++){const value=eased(i/100,curve);assert.ok(value>=0&&value<=1);assert.equal(eased(0,curve),0);assert.equal(eased(1,curve),1);}
});
test('response is frame-rate independent and settles at the exact target',()=>{
  const whole=approach(0,1,32,140),split=approach(approach(0,1,16,140),1,16,140);assert.ok(Math.abs(whole-split)<1e-12);
  let value=0;for(let i=0;i<200;i++)value=approach(value,1,16,140);assert.equal(value,1);assert.equal(approach(0,1,16,0),1);
});
test('playback duration describes a full loop or out-and-back cycle',()=>{
  const settings={...defaultInteraction('wave'),speed:4};assert.equal(timelineAmount(1000,settings),.25);assert.equal(timelineAmount(4000,settings),0);
  settings.playback='bounce';assert.equal(timelineAmount(2000,settings),1);assert.equal(timelineAmount(4000,settings),0);
});
test('neutral geometry is unchanged and right-angle rotation swaps dimensions',()=>{
  assert.equal(visualBounds(100,30,{}).width,100);assert.equal(envelope(100,30,{},{}).width,100);
  const rotated=visualBounds(100,30,{rotation:90});assert.ok(Math.abs(rotated.width-30)<1e-10);assert.ok(Math.abs(rotated.height-100)<1e-10);
});
test('layout envelopes contain combined transforms throughout their ranges',()=>{
  const pairs=[
    [{rotation:-90,skew:-45,scaleX:50,scaleY:50,baseline:-80,outlineWidth:0},{rotation:90,skew:45,scaleX:150,scaleY:150,baseline:80,outlineWidth:4}],
    [{rotation:0,skew:0,scaleX:100,scaleY:100,baseline:0,outlineWidth:0},{rotation:12,skew:-15,scaleX:125,scaleY:125,baseline:-24,outlineWidth:1.2}],
  ];
  for(const [start,end]of pairs){const a={...NEUTRAL_STYLE,...start},b={...NEUTRAL_STYLE,...end},max=envelope(300,72,a,b);
    for(let i=0;i<=1000;i++){const t=i/1000,effects=effectsAt(a,b,t),bounds=visualBounds(300*(.5+.5*t),72*(.5+.5*t),effects),stroke=effects.outlineWidth*Math.max(effects.scaleX,effects.scaleY)/100;
      assert.ok(bounds.width+2*stroke<=max.width+1e-8);assert.ok(bounds.height+2*Math.abs(effects.baseline)+2*stroke<=max.height+1e-8);}
  }
});
