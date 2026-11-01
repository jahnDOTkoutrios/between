import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_FIELDS,NEUTRAL_STYLE,effectsAt,validStyleNumber } from '../src/engine/properties.js';
import { envelope,visualBounds } from '../src/engine/geometry.js';
import { curveAt,defaultDistribution } from '../src/engine/distribution.js';
import { defaultInteraction,fieldAmount,timelineAmount } from '../src/engine/interactions.js';
const field=key=>ALL_FIELDS.find(f=>f.key===key);
test('style numbers accept subpixel sizes and values beyond the old design limits',()=>{
  for(const size of [0,.00001,.125,1,400,10000])assert.ok(validStyleNumber(field('size'),size));
  for(const[key,values]of [['tracking',[-1000,200]],['lineHeight',[.25,2000]],['baseline',[-2000,2000]],['rotation',[-1080,720]],['skew',[-70,200]],['scaleX',[-250,0,1000]],['scaleY',[-200,0,800]],['outlineWidth',[.001,40]]])for(const value of values)assert.ok(validStyleNumber(field(key),value));
});
test('only numeric and CSS-domain validity restricts style input',()=>{
  for(const key of ['size','tracking','baseline','rotation','scaleX','outlineWidth'])for(const value of [NaN,Infinity,-Infinity])assert.equal(validStyleNumber(field(key),value),false);
  for(const key of ['size','lineHeight','outlineWidth'])assert.equal(validStyleNumber(field(key),-1),false);
  for(const value of [1,1000])assert.ok(validStyleNumber(field('weight'),value));for(const value of [0,1001])assert.equal(validStyleNumber(field('weight'),value),false);
  assert.equal(validStyleNumber(field('opacity'),101),false);assert.ok(validStyleNumber(field('opacity'),.01));
});
test('layout bounds contain rotations outside the original quadrant, multiple turns and signed scale',()=>{
  const pairs=[[{rotation:200,skew:0,scaleX:100,scaleY:100},{rotation:260,skew:0,scaleX:100,scaleY:100}],[{rotation:-720,skew:-70,scaleX:-250,scaleY:0},{rotation:1080,skew:80,scaleX:500,scaleY:-300}],[{rotation:360,skew:100,scaleX:-100,scaleY:-100},{rotation:500,skew:120,scaleX:100,scaleY:150}]];
  for(const[start,end]of pairs){const a={...NEUTRAL_STYLE,...start,outlineWidth:3},b={...NEUTRAL_STYLE,...end,outlineWidth:12},max=envelope(250,80,a,b);for(let i=0;i<=1000;i++){const e=effectsAt(a,b,i/1000),bounds=visualBounds(250,80,e),stroke=e.outlineWidth*Math.max(Math.abs(e.scaleX),Math.abs(e.scaleY))/100;assert.ok(bounds.width+stroke*2<=max.width+1e-7);assert.ok(bounds.height+stroke*2<=max.height+1e-7);}}
});
test('skew poles explain an unbounded path while equivalent finite angles remain valid',()=>{
  for(const[a,b]of [[0,100],[-100,-80],[90,90],[270,270]])assert.throws(()=>envelope(100,30,{...NEUTRAL_STYLE,skew:a},{...NEUTRAL_STYLE,skew:b}),/vertical angle/);
  assert.ok(envelope(100,30,{...NEUTRAL_STYLE,skew:170},{...NEUTRAL_STYLE,skew:190}).width>100);
  assert.ok(Math.abs(envelope(100,30,{...NEUTRAL_STYLE,skew:180},{...NEUTRAL_STYLE,skew:180}).width-100)<1e-8);
});
test('overflowing bounds are rejected rather than propagated into layout',()=>assert.throws(()=>envelope(1e308,1e308,{...NEUTRAL_STYLE,scaleX:1e308},{...NEUTRAL_STYLE,scaleX:1e308}),/non-finite/));
test('Gaussian width and peak support extreme positive widths and endpoint peaks without NaN',()=>{for(const width of [1e-200,.001,2,1000,1e200])for(const peak of [0,.5,1])for(let i=0;i<=100;i++){const value=curveAt(i/100,{...defaultDistribution(),curve:'gaussian',width,peak});assert.ok(Number.isFinite(value)&&value>=0&&value<=1);}assert.equal(curveAt(0,{...defaultDistribution(),curve:'gaussian',peak:0}),1);assert.equal(curveAt(1,{...defaultDistribution(),curve:'gaussian',peak:1}),1);});
test('narrow waves are not silently expanded by a hidden width floor',()=>{const value=fieldAmount(.5,{entry:{index:0},lineIndex:0,lineCount:1,wordCount:1,lineHeight:50,mode:'wave',coordinate:{u:.55},settings:{...defaultInteraction('wave'),width:.01}});assert.ok(value<1e-8);});
test('very short and long playback cycles stay finite',()=>{for(const speed of [1e-200,.001,100,1e200])for(const playback of ['loop','bounce']){const value=timelineAmount(1000,{...defaultInteraction('wave'),speed,playback});assert.ok(Number.isFinite(value)&&value>=0&&value<=1);}});
test('resuming from an existing amount never needs an overflowing animation epoch',()=>{const settings={...defaultInteraction('scrub'),speed:1e308};const value=timelineAmount(1000,settings,.25);assert.ok(Number.isFinite(value));assert.ok(Math.abs(value-.5)<1e-12);});
