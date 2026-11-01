import test from 'node:test';
import assert from 'node:assert/strict';
import { visualBounds } from '../src/engine/geometry.js';
import { appearanceAt } from '../src/engine/appearance.js';
import { layoutModel } from '../src/engine/measurements.js';
import { LiveReflow } from '../src/engine/reflow.js';
import { reflowModel } from './helpers/reflow-model.js';

test('skew preserves advances in stable/live layout and reserves overhang only at frame edges for words and characters',()=>{
  for(const characters of [false,true]){
    const plain=reflowModel('aa bb cc dd',{characters,a:{size:30},b:{size:30}}),skewed=reflowModel('aa bb cc dd',{characters,a:{size:30,skew:-40},b:{size:30,skew:40}});
    const first=layoutModel(plain,200),second=layoutModel(skewed,200);
    assert.deepEqual(second.lines.map(l=>l.map(e=>e.word)),first.lines.map(l=>l.map(e=>e.word)));
    const entry=second.entries[0],neutral=appearanceAt(plain,entry,1,plain.a,plain.b),slanted=appearanceAt(skewed,entry,1,skewed.a,skewed.b);
    assert.equal(slanted.advance,neutral.advance);
    assert.ok(second.edgePadding>0);assert.ok(second.contentWidth<second.width);
    assert.ok(slanted.bounds.width>neutral.bounds.width);
    const liveA=new LiveReflow(plain,first).compose(1),liveB=new LiveReflow(skewed,second).compose(1);
    assert.deepEqual(liveB.layout.lines.map(l=>l.map(e=>e.word)),liveA.layout.lines.map(l=>l.map(e=>e.word)));
  }
});

test('painted bounds follow typographic skew direction when combined with rotation',()=>{
  const angle=30*Math.PI/180,k=Math.tan(-20*Math.PI/180),bounds=visualBounds(100,40,{rotation:30,skew:20});
  const expectedWidth=Math.abs(Math.cos(angle))*100+Math.abs(Math.cos(angle)*k-Math.sin(angle))*40;
  const expectedHeight=Math.abs(Math.sin(angle))*100+Math.abs(Math.sin(angle)*k+Math.cos(angle))*40;
  assert.ok(Math.abs(bounds.width-expectedWidth)<1e-9);assert.ok(Math.abs(bounds.height-expectedHeight)<1e-9);
});
