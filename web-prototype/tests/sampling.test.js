import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDistribution,buildStructureDistribution,offsetValues } from '../src/engine/distribution.js';
import { CurveSampling,mapSampledStructure,entryIdentity,validLineSample } from '../src/engine/sampling.js';
import { layoutModel } from '../src/engine/measurements.js';
import { LiveReflow,fitReferenceLayout } from '../src/engine/reflow.js';
import { TextRenderer } from '../src/ui/renderer.js';
import { normalizeSetup,defaultSetup } from '../src/engine/settings.js';
import { reflowModel } from './helpers/reflow-model.js';
const text='aa bb cc dd ee ff gg hh ii jj kk ll';
const config=overrides=>({...defaultDistribution(),unit:'character',restart:'line',lineSampling:'fixed',...overrides});
const modelFor=(characters=true)=>reflowModel(text,{characters,a:{size:20,color:'#000000'},b:{size:20,color:'#ffffff'}});
const values=(layout,structure,characters=true)=>new Map(layout.entries.filter(e=>!e.isSpace).map(e=>[entryIdentity(e,characters),structure.entries[e.index]?.value??0]));
function node(){return{style:{},children:[],append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(){}};}
function withDOM(run){const previous=globalThis.document;globalThis.document={createElement:node,createDocumentFragment:node};try{run();}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}}

test('signed offsets wrap the complete field with fractional seam interpolation and exact zero/full cycles',()=>{
 const source=[0,.2,.8,1];assert.deepEqual(offsetValues(source,1),[1,0,.2,.8]);assert.deepEqual(offsetValues(source,-1),[.2,.8,1,0]);
 assert.deepEqual(offsetValues(source,.5),[.5,.1,.5,.9]);assert.deepEqual(offsetValues(source,-.5),[.1,.5,.9,.5]);assert.strictEqual(offsetValues(source,0),source);assert.strictEqual(offsetValues(source,8),source);assert.deepEqual(offsetValues([.7],123.5),[.7]);assert.throws(()=>offsetValues(source,Infinity),/finite/);
});
test('offsets work across every restart and preserve scopes, groups, noise and source values',()=>{
 const model=modelFor(),layout=layoutModel(model,100);
 for(const restart of ['never','word','sentence','paragraph','line']){
  const settings=config({restart,restartWords:3,lineSampling:'follow',noise:{type:'smooth',amount:25,seed:42,values:true,restartWords:true}}),source=buildStructureDistribution(layout,settings),shifted=buildStructureDistribution(layout,{...settings,patternOffset:1.25});
  assert.deepEqual(shifted.samples.flat(),offsetValues(source.samples.flat(),1.25));assert.equal(shifted.groups,source.groups);assert.equal(shifted.unitCount,source.unitCount);assert.deepEqual(buildStructureDistribution(layout,{...settings,patternOffset:0}).samples,source.samples);
  assert.deepEqual(buildStructureDistribution(layout,{...settings,patternOffset:1.25},'pointer'),buildStructureDistribution(layout,settings,'pointer'));
 }
});
test('sample width composes Style A at another width without changing the displayed layout or losing glyphs',()=>{
 const model=modelFor(),actual=layoutModel(model,100),before=JSON.stringify(actual),settings=config({sampleWidth:50}),sampler=new CurveSampling(),source=sampler.resolve(model,actual,model.a,model.b,settings);
 assert.equal(source.lines.length,6);assert.equal(actual.lines.length,3);assert.equal(JSON.stringify(actual),before);assert.equal(settings.lineSample.width,50);assert.equal(settings.lineSample.referenceWidth,100);
 const all=source.entries.filter(e=>!e.isSpace);assert.equal(all.length,24);assert.equal(new Set(all.map(e=>entryIdentity(e,true))).size,24);
 assert.deepEqual(buildStructureDistribution(source,settings).samples[0],[0,.25,.5,.75,1]);
});
test('sampled values remain attached to exact graphemes after display reflow, including repeated letters and emoji',()=>{
 const model=reflowModel('aa 👩🏽‍🎨é bb cc dd ee',{characters:true,a:{size:20},b:{size:20}}),settings=config({sampleWidth:70}),sampler=new CurveSampling(),wide=layoutModel(model,150),source=sampler.resolve(model,wide,model.a,model.b,settings),field=buildStructureDistribution(source,settings),baseline=values(wide,mapSampledStructure(field,source,wide,true));
 const narrow=layoutModel(model,85),same=sampler.resolve(model,narrow,model.a,model.b,settings);assert.strictEqual(same,source);
 assert.deepEqual(values(narrow,mapSampledStructure(field,same,narrow,true)),baseline);assert.ok(narrow.lines.length>wide.lines.length);
});
test('fixed sampling is Curve-only and defaults leave existing follow-layout behavior unchanged',()=>{
 const model=modelFor(),actual=layoutModel(model,100),sampler=new CurveSampling(),settings=config();assert.equal(defaultDistribution().lineSampling,'follow');assert.equal(sampler.resolve(model,actual,model.a,model.b,{...settings,lineSampling:'follow'}),null);
 for(const mode of ['scrub','pointer','wave','wipe','scroll','press'])assert.equal(sampler.resolve(model,actual,model.a,model.b,settings,mode),null);
 assert.equal(settings.lineSample,null);assert.equal(sampler.resolve(model,actual,model.a,model.b,{...settings,restart:'word'}),null);
});
test('curve, offset, strength and noise edits reuse a sample; width edits and Resample replace it',()=>{
 let captures=0;const model=modelFor(),sampler=new CurveSampling(()=>captures++),settings=config({sampleWidth:75}),reference=layoutModel(model,150),source=sampler.resolve(model,reference,model.a,model.b,settings);
 for(const changes of [{curve:'gaussian'},{steps:3},{patternOffset:1.375},{noise:{type:'random',amount:50,seed:42,values:true,restartWords:false}}]){Object.assign(settings,changes);assert.strictEqual(sampler.resolve(model,reference,model.a,model.b,settings),source);}
 assert.equal(captures,1);const resized=layoutModel(model,100);sampler.resolve(model,resized,model.a,model.b,settings);assert.equal(captures,1);assert.equal(settings.lineSample.width,112.5);
 settings.lineSample=null;sampler.resolve(model,resized,model.a,model.b,settings);assert.equal(captures,2);assert.equal(settings.lineSample.width,75);
 settings.sampleWidth=125;sampler.resolve(model,resized,model.a,model.b,settings);assert.equal(captures,3);assert.equal(settings.lineSample.width,125);
});
test('fixed source survives refresh and B metric preparation but updates for text, A metrics or units',()=>{
 const model=modelFor(),settings=config({sampleWidth:75}),reference=layoutModel(model,120);new CurveSampling().resolve(model,reference,model.a,model.b,settings);const saved=structuredClone(settings.lineSample);let captures=0;
 const next=reflowModel(text,{characters:true,a:{size:20,color:'#000000'},b:{size:50,color:'#ffffff'}}),sampler=new CurveSampling(()=>captures++);sampler.resolve(next,layoutModel(next,85),next.a,next.b,settings);assert.equal(captures,0);assert.deepEqual(settings.lineSample,saved);
 sampler.resolve(next,layoutModel(next,85),{...next.a,size:21},next.b,settings);assert.equal(captures,1);
 const changed=reflowModel(`${text} more`,{characters:true,a:{size:20},b:{size:20}});sampler.resolve(changed,layoutModel(changed,100),changed.a,changed.b,settings);assert.equal(captures,2);
});
test('fixed line scope uses the sampled line and offsets never leak into other source lines',()=>{
 const model=modelFor(),settings=config({sampleWidth:50,scope:'line',scopeIndex:2,patternOffset:.5}),actual=layoutModel(model,100),source=new CurveSampling().resolve(model,actual,model.a,model.b,settings),field=buildStructureDistribution(source,settings),projected=mapSampledStructure(field,source,actual,true),selected=new Set(source.lines[1].map(e=>entryIdentity(e,true)));
 assert.equal(field.scopeCount,6);for(const entry of actual.entries)if(!selected.has(entryIdentity(entry,true)))assert.equal(projected.entries[entry.index],undefined);
});
test('live reflow moves the actual lines while preserving the frozen curve and uses one fitting pass',()=>{
 const model=reflowModel(text,{characters:true,a:{size:15},b:{size:50}}),settings=config({sampleWidth:85}),reference=layoutModel(model,180),source=new CurveSampling().resolve(model,reference,model.a,model.b,settings),engine=new LiveReflow(model,reference),a=engine.compose(0,{mode:'curve',distribution:settings,samplingLayout:source}),b=engine.compose(1,{mode:'curve',distribution:settings,samplingLayout:source});
 assert.ok(b.layout.lines.length>a.layout.lines.length);assert.equal(b.passes,1);assert.equal(b.stabilized,false);const field=buildStructureDistribution(source,settings);
 for(const entry of source.entries)assert.equal(b.amounts[entry.index],field.entries[entry.index]?.value??0);
 assert.ok(b.appearances.every(app=>Number.isFinite(app.advance)));
});
test('fitted stable snapshots use the same shifted source as live reflow',()=>{
 const model=modelFor(),settings=config({sampleWidth:70,patternOffset:1.25}),reference=layoutModel(model,100),source=new CurveSampling().resolve(model,reference,model.a,model.b,settings),options={mode:'curve',distribution:settings,samplingLayout:source},fitted=fitReferenceLayout(model,reference,1,options),live=new LiveReflow(model,reference).compose(1,options);
 assert.deepEqual(fitted.fitSnapshot.amounts,live.layout.lines.flat().map(e=>live.amounts[e.index]));assert.equal(fitted.width,100);
});
test('renderer changes sample width and fractional offsets without replacing nodes or changing a color-only frame',()=>withDOM(()=>{
 const model=modelFor(),settings=config({sampleWidth:75}),renderer=new TextRenderer(node());renderer.mount(model,layoutModel(model,100));renderer.render(1,{mode:'curve',distribution:settings});const nodes=renderer.nodes.map(n=>n.node),lineCount=renderer.layout.lines.length,baseline=renderer.nodes.map(n=>n.color),sample=structuredClone(settings.lineSample);
 settings.patternOffset=.5;renderer.render(1,{mode:'curve',distribution:settings});assert.notDeepEqual(renderer.nodes.map(n=>n.color),baseline);assert.deepEqual(settings.lineSample,sample);
 settings.patternOffset=0;renderer.render(1,{mode:'curve',distribution:settings});assert.deepEqual(renderer.nodes.map(n=>n.color),baseline);
 settings.sampleWidth=125;renderer.render(1,{mode:'curve',distribution:settings});assert.notDeepEqual(settings.lineSample.lines,sample.lines);assert.equal(renderer.layout.lines.length,lineCount);assert.equal(renderer.layout.width,100);assert.ok(renderer.nodes.every((n,i)=>n.node===nodes[i]));
 renderer.render(1,{mode:'curve',distribution:settings});assert.equal(renderer.frameWrites,0);
}));
test('saved sampling controls and source roundtrip, reject malformed data and Restore defaults clears them',()=>{
 const model=modelFor(),source=defaultSetup();source.text=text;source.sample='custom';source.mode='curve';source.distribution=config({sampleWidth:72.125,patternOffset:-1.375});new CurveSampling().resolve(model,layoutModel(model,120),model.a,model.b,source.distribution);
 const saved=normalizeSetup(JSON.parse(JSON.stringify(source)));assert.deepEqual(saved.distribution,source.distribution);assert.notStrictEqual(saved.distribution.lineSample.lines,source.distribution.lineSample.lines);
 for(const malformed of [{...saved.distribution.lineSample,lines:[[1,0]]},{...saved.distribution.lineSample,width:Infinity},{version:99}]){assert.equal(validLineSample(malformed,model.words.length),false);assert.equal(normalizeSetup({...source,distribution:{...source.distribution,lineSample:malformed}}).distribution.lineSample,null);}
 const defaults=defaultSetup();assert.equal(defaults.distribution.sampleWidth,100);assert.equal(defaults.distribution.patternOffset,0);assert.equal(defaults.distribution.lineSample,null);
 for(const sampleWidth of [0,-1,Infinity,'75'])assert.equal(normalizeSetup({...source,distribution:{...source.distribution,sampleWidth}}).distribution.sampleWidth,100);
});
