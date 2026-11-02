import test from 'node:test';
import assert from 'node:assert/strict';
import { TextRenderer } from '../src/ui/renderer.js';
import { NEUTRAL_STYLE } from '../src/engine/properties.js';
function node(){return{style:{},children:[],append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(){}};}
test('outline color morphs when every numeric endpoint is identical',()=>{
  const saved=globalThis.document;
  globalThis.document={createElement:node,createDocumentFragment:node,createTextNode:text=>({textContent:text})};
  try{
    const a={...NEUTRAL_STYLE,size:30,outlineWidth:1,outlineColor:'#ff0000'},b={...a,outlineColor:'#0000ff'};
    const model={text:'word',words:['word'],maxSize:30,a,b,states:Array.from({length:65},()=>({size:30,weight:400,tracking:0})),space:new Float64Array(65).fill(8),widths:new Map([['word',new Float64Array(65).fill(60)]])};
    const renderer=new TextRenderer(node());renderer.mount(model,{height:50,width:200,lineHeight:50,wordCount:1,lines:[[{index:0,word:'word',envelopeCenter:30}]]});
    renderer.render(0);const start=renderer.nodes[0].ink.style.webkitTextStrokeColor;renderer.render(1);
    assert.notEqual(renderer.nodes[0].ink.style.webkitTextStrokeColor,start);assert.equal(renderer.nodes[0].ink.style.webkitTextStrokeColor,'rgb(0 0 255)');
  }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});
test('scoped curve targets reset outside text to A and restart groups affect multiple properties',()=>{
  const saved=globalThis.document;globalThis.document={createElement:node,createDocumentFragment:node,createTextNode:text=>({textContent:text})};
  try{
    const a={...NEUTRAL_STYLE,size:20,opacity:100,rotation:0},b={...a,size:40,opacity:20,rotation:12};
    const model={text:'a b c d',words:['a','b','c','d'],maxSize:40,a,b,states:Array.from({length:65},(_,i)=>({size:20+20*i/64,weight:400,tracking:0})),space:new Float64Array(65).fill(5),widths:new Map(['a','b','c','d'].map(word=>[word,new Float64Array(65).fill(20)]))};
    const entries=model.words.map((word,index)=>({word,index,wordIndex:index,paragraphIndex:Math.floor(index/2),envelopeCenter:index*30+10})),renderer=new TextRenderer(node());renderer.mount(model,{height:60,width:300,lineHeight:60,wordCount:4,lines:[entries],entries});
    renderer.render(1,{mode:'curve',distribution:{unit:'word',scope:'text',scopeIndex:1,restart:'word',restartWords:2,curve:'linear',steps:0}});
    assert.deepEqual(renderer.nodes.map(n=>n.ink.style.fontSize),['20px','40px','20px','40px']);assert.deepEqual(renderer.nodes.map(n=>n.ink.style.opacity),['1','0.2','1','0.2']);
    renderer.render(1,{mode:'curve',distribution:{unit:'word',scope:'paragraph',scopeIndex:2,restart:'never',curve:'linear',steps:0}});
    assert.deepEqual(renderer.nodes.map(n=>n.ink.style.fontSize),['20px','20px','20px','40px']);assert.equal(renderer.nodes[1].ink.style.opacity,'1');
  }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});
test('font overrides use their measured family and shared leading sets the line distance',()=>{
  const saved=globalThis.document;globalThis.document={createElement:node,createDocumentFragment:node,createTextNode:text=>({textContent:text})};
  try{
    const a={...NEUTRAL_STYLE,size:30,fontFamily:'manrope',lineHeight:40},b={...a,fontFamily:'serif',lineHeight:100};
    const states=Array.from({length:65},(_,i)=>({size:30,weight:400,tracking:0,fontFamily:i<32?'manrope':'serif'})),model={text:'one\ntwo',words:['one','two'],maxSize:30,a,b,states,space:new Float64Array(65).fill(8),widths:new Map(['one','two'].map(w=>[w,new Float64Array(65).fill(50)]))};
    const entries=model.words.map((word,index)=>({word,index,envelopeCenter:25})),renderer=new TextRenderer(node());renderer.mount(model,{height:200,width:300,lineHeight:100,autoLineHeight:50,wordCount:2,entries,lines:entries.map(e=>[e])});
    renderer.render(0);assert.equal(renderer.positions[1].y,40);assert.match(renderer.nodes[0].ink.style.fontFamily,/Manrope/);
    renderer.render(.4999);assert.match(renderer.nodes[0].ink.style.fontFamily,/Manrope/);renderer.render(.5);assert.match(renderer.nodes[0].ink.style.fontFamily,/Georgia/);
    renderer.render(1);assert.equal(renderer.positions[1].y,100);renderer.render(0);assert.equal(renderer.positions[1].y,40);
  }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});
test('live reflow keeps text nodes during animation and toggling off restores stable composition',async()=>{
  const{reflowModel}=await import('./helpers/reflow-model.js'),{layoutModel}=await import('../src/engine/measurements.js');
  const saved=globalThis.document;globalThis.document={createElement:node,createDocumentFragment:node,createTextNode:text=>({textContent:text})};
  try{
    const model=reflowModel(),reference=layoutModel(model,100),renderer=new TextRenderer(node());renderer.mount(model,reference);renderer.render(0,{liveReflow:true});const nodes=renderer.nodes.map(item=>item.node),countA=renderer.layout.lines.length;
    renderer.render(1,{liveReflow:true});assert.ok(renderer.layout.lines.length>countA);assert.ok(renderer.nodes.every((item,i)=>item.node===nodes[i]));assert.ok(renderer.inspect().maxOverflow<=0);
    renderer.render(.5,{liveReflow:false});assert.strictEqual(renderer.layout,reference);assert.equal(renderer.nodes.length,model.words.length);renderer.render(0,{liveReflow:true});assert.equal(renderer.layout.lines.length,countA);
  }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});
test('live character nodes stay attached to their original grapheme while interword spaces hide or return',async()=>{
  const{reflowModel}=await import('./helpers/reflow-model.js'),{layoutModel}=await import('../src/engine/measurements.js');
  const saved=globalThis.document;globalThis.document={createElement:node,createDocumentFragment:node,createTextNode:text=>({textContent:text})};
  try{
    const model=reflowModel('ab cd ef',{characters:true}),renderer=new TextRenderer(node());renderer.mount(model,layoutModel(model,100));renderer.render(0,{liveReflow:true});const nodes=renderer.nodes.map(item=>item.node);assert.equal(renderer.nodes[6].ink.textContent,'e');
    renderer.render(1,{liveReflow:true});assert.equal(renderer.nodes[2].node.style.display,'none');assert.equal(renderer.positions[2].hidden,true);assert.equal(renderer.nodes[6].ink.textContent,'e');assert.ok(renderer.nodes.every((item,i)=>item.node===nodes[i]));
    renderer.render(0,{liveReflow:true});assert.equal(renderer.nodes[2].node.style.display,'block');assert.equal(renderer.positions[2].hidden,undefined);assert.ok(renderer.positions.every(p=>Number.isFinite(p.width)));
  }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});
test('skew does not add per-unit spacing in the actual stable or live renderer',async()=>{
  const{reflowModel}=await import('./helpers/reflow-model.js'),{layoutModel}=await import('../src/engine/measurements.js');
  const saved=globalThis.document;globalThis.document={createElement:node,createDocumentFragment:node,createTextNode:text=>({textContent:text})};
  try{
    for(const characters of [false,true])for(const liveReflow of [false,true]){
      const model=reflowModel('aa bb cc',{characters,a:{size:30,skew:0},b:{size:30,skew:40}}),renderer=new TextRenderer(node());renderer.mount(model,layoutModel(model,300));
      renderer.render(0,{liveReflow});const baseline=renderer.positions[1].x-renderer.positions[0].x;
      renderer.render(1,{liveReflow});assert.equal(renderer.positions[1].x-renderer.positions[0].x,baseline);assert.ok(renderer.positions[0].inkWidth>renderer.positions[0].width);
      assert.match(renderer.nodes[0].ink.style.transform,/skewX\(-40deg\)/);
      renderer.render(1,{liveReflow,b:{...model.b,skew:-40}});assert.match(renderer.nodes[0].ink.style.transform,/skewX\(40deg\)/);
    }
  }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});

test('seeded Curve noise drives style properties and switching modes clears its cached assignments',async()=>{
  const{reflowModel}=await import('./helpers/reflow-model.js'),{layoutModel}=await import('../src/engine/measurements.js'),{defaultDistribution}=await import('../src/engine/distribution.js');
  const saved=globalThis.document;globalThis.document={createElement:node,createDocumentFragment:node,createTextNode:text=>({textContent:text})};
  try{
    const model=reflowModel(),renderer=new TextRenderer(node()),distribution={...defaultDistribution(),restart:'word',restartWords:4,noise:{type:'random',amount:50,seed:42,values:true,restartWords:true}};
    renderer.mount(model,layoutModel(model,600));renderer.render(1,{mode:'curve',distribution});const noisy=renderer.nodes.map(n=>n.ink.style.fontSize);assert.ok(new Set(noisy).size>1);
    renderer.render(1,{mode:'scrub',distribution});assert.ok(renderer.nodes.every(n=>n.ink.style.fontSize==='50px'));
    renderer.render(1,{mode:'curve',distribution});assert.deepEqual(renderer.nodes.map(n=>n.ink.style.fontSize),noisy);
    const writes=renderer.frameWrites;renderer.render(1,{mode:'curve',distribution});assert.equal(renderer.frameWrites,0);assert.ok(writes>0);
  }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});
