import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSetup,normalizeSetup,readSetup,writeSetup,SETTINGS_KEY,cascadeSnapshot,restoreCascade } from '../src/engine/settings.js';
import { StyleCascade } from '../src/engine/properties.js';

test('settings roundtrip Base, inactive overrides, units, custom curves, text and mode profiles',()=>{
  const source=defaultSetup(),state=new StyleCascade();state.setBase('fontFamily','serif');state.setBase('lineHeight',67);state.inherit('a','size');state.override('b','skew',-28);state.active.add('skew');state.active.delete('tracking');source.styles=cascadeSnapshot(state);
  Object.assign(source,{text:'A custom sample.\nAnother line.',sample:'custom',mode:'wave',amount:.37,liveReflow:true,dark:true});
  Object.assign(source.distribution,{unit:'character',restart:'word',restartWords:3,scope:'sentence',scopeIndex:2,curve:'custom',points:[{x:0,y:.2},{x:.33,y:.9},{x:1,y:.1}],steps:4});source.profiles.wave.speed=9.5;source.profiles.pointer.radius=260;
  const restored=normalizeSetup(JSON.parse(JSON.stringify(source)));assert.deepEqual(restored,source);
  const next=new StyleCascade();restoreCascade(next,restored.styles);assert.equal(next.owns('a','size'),false);assert.equal(next.styles().a.size,32);assert.equal(next.styles().b.skew,-28);assert.equal(next.raw.b.tracking,1.4);assert.equal(next.styles().b.tracking,0);
});
test('custom font identifiers survive when their local files were restored',()=>{
  const saved=defaultSetup();saved.styles.base.fontFamily='local-saved-font';saved.styles.active.push('fontFamily');saved.styles.raw.b.fontFamily='serif';
  assert.equal(normalizeSetup(saved,['manrope','serif','local-saved-font']).styles.base.fontFamily,'local-saved-font');assert.equal(normalizeSetup(saved).styles.base.fontFamily,'manrope');assert.equal(normalizeSetup(saved).styles.raw.b.fontFamily,'serif');
});
test('malformed, unknown or nonfinite saved values cannot break startup',()=>{
  const source=defaultSetup();Object.assign(source.distribution,{unit:'bad',restartWords:0,scopeIndex:1.5,steps:-2,width:0,points:[{x:1,y:10}]});source.styles.base.size=-1;source.styles.raw.a.tracking=Infinity;source.profiles.wave.speed=-1;source.mode='not-a-mode';source.amount=5;source.playing=true;
  const next=normalizeSetup(source),defaults=defaultSetup();assert.deepEqual(next.distribution,defaults.distribution);assert.equal(next.styles.base.size,32);assert.equal(next.styles.raw.a.tracking,undefined);assert.equal(next.profiles.wave.speed,4.8);assert.equal(next.mode,'scrub');assert.equal(next.amount,0);assert.equal(Object.hasOwn(next,'playing'),false);assert.deepEqual(normalizeSetup({version:999}),defaults);
});
test('invalid skew composition restores safe styles without losing other saved choices',()=>{
  const source=defaultSetup();source.styles.active.push('skew');source.styles.raw.b.skew=100;source.mode='curve';source.text='Keep this text';const next=normalizeSetup(source);assert.deepEqual(next.styles,defaultSetup().styles);assert.equal(next.mode,'curve');assert.equal(next.text,'Keep this text');
});
test('zero, fractional, negative and inherited values remain exact',()=>{
  const source=defaultSetup();source.styles.raw.a.size=0;source.styles.raw.b.size=.001;source.styles.base.tracking=-80;source.styles.active=[];source.amount=0;source.text='';const next=normalizeSetup(source);assert.equal(next.styles.raw.a.size,0);assert.equal(next.styles.raw.b.size,.001);assert.equal(next.styles.base.tracking,-80);assert.deepEqual(next.styles.active,[]);assert.equal(next.text,'');assert.equal(next.sample,'custom');
});
test('storage handles blocked access, corrupted JSON and quota errors safely',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},source=defaultSetup();source.amount=.73;
  assert.equal(writeSetup(storage,source),true);assert.deepEqual(readSetup(storage),source);assert.ok(values.has(SETTINGS_KEY));values.set(SETTINGS_KEY,'not JSON');assert.equal(readSetup(storage),null);assert.equal(readSetup(undefined),null);assert.equal(writeSetup(undefined,source),false);assert.equal(writeSetup({setItem(){throw new Error('quota');}},source),false);
});
test('restore defaults returns fresh complete state and migrates legacy dark colors',()=>{
  const changed=defaultSetup();changed.styles.active.length=0;changed.distribution.points[1].y=0;changed.profiles.wave.speed=100;
  const defaults=defaultSetup();assert.equal(defaults.styles.active.length,4);assert.equal(defaults.distribution.points[1].y,1);assert.equal(defaults.profiles.wave.speed,4.8);assert.equal(defaults.text.length>0,true);assert.equal(defaults.dark,false);assert.equal(defaultSetup(true).styles.raw.a.color,'#e5e5e5');assert.equal(defaultSetup(true).dark,true);
});
