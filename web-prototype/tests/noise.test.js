import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { defaultNoise,normalizeNoise,activeNoise,noiseSample,wordGroupIndices } from '../src/engine/noise.js';
import { defaultDistribution,buildStructureDistribution } from '../src/engine/distribution.js';
import { defaultSetup,normalizeSetup } from '../src/engine/settings.js';
import { defaultInteraction } from '../src/engine/interactions.js';
import { LiveReflow,fitReferenceLayout } from '../src/engine/reflow.js';
import { layoutModel } from '../src/engine/measurements.js';
import { reflowModel } from './helpers/reflow-model.js';
const noise=extra=>({...defaultNoise(),type:'random',amount:50,seed:42,...extra});
const fixture=(count=40)=>({lineHeight:50,wordCount:count,lines:[Array.from({length:count},(_,index)=>({word:'w'+index,index,wordIndex:index,sentenceIndex:Math.floor(index/5),paragraphIndex:Math.floor(index/10),envelopeCenter:index*20}))]});
const plan=(overrides={},mode='curve')=>buildStructureDistribution(fixture(),{...defaultDistribution(),...overrides},mode);
const options={...defaultDistribution(),restart:'word',restartWords:4};
test('noise Off, absent and zero Amount retain all existing curves, scopes and groups exactly',()=>{
  for(const curve of ['linear','in','gaussian','custom'])for(const unit of ['word','line','sentence','all'])for(const scope of ['text','paragraph']){
    const cfg={...options,curve,unit,scope},plain=plan(cfg);
    for(const n of [undefined,defaultNoise(),noise({amount:0,restartWords:true})])assert.deepEqual(plan({...cfg,noise:n}),plain);
  }
});
test('noise fields match the InDesign implementation for every seed, type and independent stream',()=>{
  const source=fs.readFileSync(new URL('../../Tracking Ramp.jsx',import.meta.url),'utf8').replace(/^#target.*\n/,'').replace('run(); // Entry point','return {noiseSample:noiseSample};');
  const native=vm.runInNewContext(source,{});
  for(const type of ['random','smooth','fractal'])for(const seed of [0,1,42,2147483647])for(const channel of [1013904223,1664525])for(const position of [0,1,2.5,7,21.3,10000])assert.equal(noiseSample({type,seed},position,channel),native.noiseSample({type,seed},position,channel));
});
test('all fields are bounded, repeatable and distinct across seeds and types',()=>{
  const rows=[];
  for(const type of ['random','smooth','fractal']){
    const cfg={noise:noise({type,amount:100})},a=plan(cfg),b=plan(cfg);assert.deepEqual(a,b);assert.ok(a.entries.every(e=>e.value>=0&&e.value<=1));assert.notDeepEqual(a.samples,plan({noise:noise({type,amount:100,seed:43})}).samples);rows.push(a.samples);
  }
  assert.notDeepEqual(rows[0],rows[1]);assert.notDeepEqual(rows[1],rows[2]);
});
test('Smooth varies gradually while Fractal contains additional fine detail',()=>{
  const variation=type=>{const row=Array.from({length:200},(_,i)=>noiseSample({type,seed:42},i));return row.slice(1).reduce((n,v,i)=>n+Math.abs(v-row[i]),0);};
  assert.ok(variation('smooth')<variation('random')/2);assert.notEqual(variation('smooth'),variation('fractal'));
});
test('noisy words per restart stay positive and bounded while covering the final partial group',()=>{
  for(const type of ['random','smooth','fractal']){
    const n=noise({type,values:false,restartWords:true}),ranks=wordGroupIndices(100,4,n),counts=Array.from(Map.groupBy(ranks,r=>r).values(),a=>a.length);
    assert.equal(ranks.length,100);assert.ok(counts.slice(0,-1).every(n=>n>=2&&n<=6));assert.ok(counts.at(-1)>=1);assert.ok(new Set(counts).size>1);assert.deepEqual(ranks,wordGroupIndices(100,4,n));
  }
  for(const base of [1,10000,Number.MAX_SAFE_INTEGER])assert.equal(wordGroupIndices(40,base,noise({amount:100,restartWords:true})).length,40);
});
test('restart-only noise leaves every group’s full curve unchanged and values-only preserves group lengths',()=>{
  const cfg={...options,noise:noise({values:false,restartWords:true})},p=plan(cfg);
  assert.ok(new Set(p.samples.map(row=>row.length)).size>1);
  for(const row of p.samples)assert.deepEqual(row,row.map((_,i)=>row.length===1?0:i/(row.length-1)));
  assert.deepEqual(plan({...options,noise:noise()}).samples.map(row=>row.length),plan(options).samples.map(row=>row.length));
});
test('steps still share a noisy value bucket and noise continues between equal restart groups',()=>{
  const p=plan({steps:3,noise:noise()});assert.ok(new Set(p.entries.map(e=>e.value)).size<=3);
  const grouped=plan({...options,noise:noise()});assert.notDeepEqual(grouped.samples[0],grouped.samples[1]);
});
test('noise respects a selected scope and letter-space ownership',()=>{
  const p=plan({scope:'paragraph',scopeIndex:2,noise:noise()});assert.equal(p.entries[0],undefined);assert.ok(p.entries[10]);assert.equal(p.entries[20],undefined);
  const entries=[{index:0,wordIndex:0,envelopeCenter:10},{index:1,wordIndex:0,isSpace:true,envelopeCenter:20},{index:2,wordIndex:1,envelopeCenter:30}],d=buildStructureDistribution({lineHeight:50,lines:[entries]},{...defaultDistribution(),unit:'letter',noise:noise()});assert.strictEqual(d.entries[0],d.entries[1]);
});
test('all noise targets are inactive outside Curve mode without losing their saved configuration',()=>{
  const cfg={...options,noise:noise({restartWords:true})};
  for(const mode of ['scrub','pointer','wipe','wave','scroll','press'])assert.deepEqual(plan(cfg,mode),plan({...cfg,noise:undefined},mode));
  assert.notDeepEqual(plan(cfg),plan({...cfg,noise:undefined}));
});
test('noise settings persist, old setups migrate to Off and Restore defaults creates fresh noise state',()=>{
  const source=defaultSetup();source.mode='curve';source.distribution.noise=noise({type:'fractal',amount:63,seed:123,restartWords:true});const restored=normalizeSetup(JSON.parse(JSON.stringify(source)));assert.deepEqual(restored.distribution.noise,source.distribution.noise);
  delete source.distribution.noise;assert.deepEqual(normalizeSetup(source).distribution.noise,defaultNoise());
  const a=defaultSetup(),b=defaultSetup();a.distribution.noise.type='smooth';assert.equal(b.distribution.noise.type,'off');
});
test('malformed noise settings normalize safely, including seed zero and zero Amount',()=>{
  assert.deepEqual(normalizeNoise({type:'bad',amount:Infinity,seed:-1,values:'yes',restartWords:7}),defaultNoise());
  assert.deepEqual(normalizeNoise(noise({amount:0,seed:0})),noise({amount:0,seed:0}));
  for(const bad of [null,undefined,[],42])assert.deepEqual(normalizeNoise(bad),defaultNoise());
  assert.equal(activeNoise(noise({seed:1.5}),'values'),null);assert.equal(activeNoise(noise({amount:0}),'values'),null);
});
test('live fitting repeats noisy curves, preserves node identities and fits cached measurements',()=>{
  for(const characters of [false,true]){
    const model=reflowModel('aa bb cc dd ee ff gg hh ii jj kk ll',{characters}),reference=layoutModel(model,180),flow=new LiveReflow(model,reference),distribution={...options,unit:characters?'character':'word',noise:noise({type:'fractal',restartWords:true})},settings={...defaultInteraction('curve'),response:0};
    const a=flow.compose(1,{mode:'curve',distribution,settings}),count=flow.catalog.entries.length;assert.ok(a.amounts.every(v=>v>=0&&v<=1));assert.ok(a.passes<=6);
    assert.strictEqual(flow.compose(1,{mode:'curve',distribution,settings}),a);assert.equal(flow.catalog.entries.length,count);assert.ok(a.layout.lines.every(line=>line.totalWidth<=180+.001||new Set(line.map(e=>e.wordIndex)).size===1));
    flow.compose(.2,{mode:'curve',distribution,settings});assert.deepEqual(flow.compose(1,{mode:'curve',distribution,settings}).amounts,a.amounts);
    const fitted=fitReferenceLayout(model,reference,1,{mode:'curve',distribution,settings,a:model.a,b:model.b});assert.ok(fitted.lines.length>0);
  }
});
