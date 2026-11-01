import test from 'node:test';
import assert from 'node:assert/strict';
import { TextRenderer } from '../src/ui/renderer.js';
import { layoutModel } from '../src/engine/measurements.js';
import { reflowModel } from './helpers/reflow-model.js';
const node=()=>({style:{},children:[],append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(){}});
function withDOM(fn){const saved=globalThis.document;globalThis.document={createElement:node,createDocumentFragment:node,createTextNode:text=>({textContent:text})};try{fn();}finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}}
const logicalText=renderer=>renderer.nodes.filter(item=>item.node.className!=='word is-space').map(item=>item.ink.textContent+(item.gap?.textContent||'')).join('');

test('selectable word runs retain spaces and blank paragraph breaks without changing ink text',()=>withDOM(()=>{
  const text='One quiet word.\n\nAnother quiet word.',model=reflowModel(text,{a:{size:20},b:{size:20}}),renderer=new TextRenderer(node());renderer.mount(model,layoutModel(model,90));renderer.render(.5);
  assert.equal(logicalText(renderer),text);assert.equal(renderer.nodes[0].ink.textContent,'One');assert.equal(renderer.nodes[2].gap.textContent,'\n\n');assert.match(renderer.nodes[2].gap.className,/paragraph-gap/);assert.equal(renderer.nodes.at(-1).gap,null);
}));
test('character selection has one logical space per word even when live spaces hide at line ends',()=>withDOM(()=>{
  const text='aa bb cc dd',model=reflowModel(text,{characters:true,a:{size:20},b:{size:50}}),renderer=new TextRenderer(node());renderer.mount(model,layoutModel(model,100));assert.equal(logicalText(renderer),text);
  renderer.render(0,{liveReflow:true});assert.equal(logicalText(renderer),text);renderer.render(1,{liveReflow:true});assert.equal(logicalText(renderer),text);assert.ok(renderer.nodes.some(item=>item.hidden&&item.node.className==='word is-space'));
}));
test('selection spaces follow justified gaps without changing measured text widths',()=>withDOM(()=>{
  for(const characters of [false,true])for(const liveReflow of [false,true]){
    const model=reflowModel('aa bb cc dd',{characters,a:{size:20},b:{size:20}}),renderer=new TextRenderer(node());renderer.mount(model,layoutModel(model,75,model.a,model.b,'justify'));renderer.render(1,{liveReflow,alignment:'justify'});
    assert.equal(logicalText(renderer),'aa bb cc dd');assert.ok(renderer.nodes.filter(item=>item.gap).every(item=>Number.parseFloat(item.gap.style.width)>=0));assert.ok(renderer.inspect().maxOverflow<=0);
    const first=renderer.nodes.find(item=>item.gap);assert.equal(Number.parseFloat(first.gap.style.width),7.5);assert.equal(first.ink.style.letterSpacing,'0px');
  }
}));
test('selection spaces inherit baseline and opacity while cached frames avoid repeat writes',()=>withDOM(()=>{
  const model=reflowModel('aa bb',{a:{size:20},b:{size:20,baseline:-12,opacity:25}}),renderer=new TextRenderer(node());renderer.mount(model,layoutModel(model,200));renderer.render(1);const gap=renderer.nodes[0].gap;
  assert.equal(gap.style.opacity,'0.25');assert.equal(gap.style.transform,'translateY(-12px)');renderer.render(1);assert.equal(renderer.frameWrites,0);
}));
