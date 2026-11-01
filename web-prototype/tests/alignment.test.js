import test from 'node:test';
import assert from 'node:assert/strict';
import { lineAlignment,paragraphEndsAt } from '../src/engine/alignment.js';
import { TextRenderer } from '../src/ui/renderer.js';
import { layoutModel } from '../src/engine/measurements.js';
import { LiveReflow } from '../src/engine/reflow.js';
import { defaultSetup,normalizeSetup,restoreCascade } from '../src/engine/settings.js';
import { StyleCascade } from '../src/engine/properties.js';
import { reflowModel } from './helpers/reflow-model.js';
const node=()=>({style:{},children:[],append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(){}});
function withDOM(callback){const saved=globalThis.document;globalThis.document={createElement:node,createDocumentFragment:node,createTextNode:text=>({textContent:text})};try{callback();}finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('alignment shares remaining width, respects paragraph ends and never shrinks overflowing text',()=>{
  assert.deepEqual(lineAlignment(100,60,2,'center'),{offset:20,space:0});assert.deepEqual(lineAlignment(100,60,2,'right'),{offset:40,space:0});
  assert.deepEqual(lineAlignment(100,60,2,'justify'),{offset:0,space:20});assert.deepEqual(lineAlignment(100,60,2,'justify',true),{offset:0,space:0});assert.deepEqual(lineAlignment(100,60,0,'justify'),{offset:0,space:0});
  for(const alignment of ['left','center','right','justify'])assert.deepEqual(lineAlignment(100,160,2,alignment),{offset:0,space:0});
});
test('paragraph ends include explicit breaks, blank paragraphs and the final composed line',()=>{
  const lines=[[{paragraphIndex:0}],[{paragraphIndex:0}],[],[{paragraphIndex:2}],[{paragraphIndex:3}]];
  assert.equal(paragraphEndsAt(lines,0),false);for(const i of [1,2,3,4])assert.equal(paragraphEndsAt(lines,i),true);
});
test('stable and live rendering align actual current widths for words and characters',()=>withDOM(()=>{
  for(const characters of [false,true])for(const liveReflow of [false,true])for(const alignment of ['left','center','right']){
    const model=reflowModel('aa bb',{characters,a:{size:20},b:{size:40}}),reference=layoutModel(model,300,model.a,model.b,alignment),renderer=new TextRenderer(node());renderer.mount(model,reference);
    for(const amount of [0,.5,1]){
      renderer.render(amount,{liveReflow,alignment});const line=renderer.layout.lines[0],first=renderer.positions[line[0].index],last=renderer.positions[line.at(-1).index],right=last.x+last.width;
      if(alignment==='left')close(first.x,0);if(alignment==='center')close(first.x,300-right);if(alignment==='right')close(right,300);
      assert.ok(renderer.inspect().minGap>=0);
    }
  }
}));
test('justification stretches word gaps only and leaves the last line of each paragraph left aligned',()=>withDOM(()=>{
  for(const characters of [false,true])for(const liveReflow of [false,true]){
    const model=reflowModel('aa bb cc dd\nee ff gg hh',{characters,a:{size:20},b:{size:20}}),reference=layoutModel(model,75,model.a,model.b,'justify'),renderer=new TextRenderer(node());renderer.mount(model,reference);renderer.render(1,{liveReflow,alignment:'justify'});
    renderer.layout.lines.forEach((line,i)=>{
      const first=renderer.positions[line[0].index],last=renderer.positions[line.at(-1).index];close(first.x,0);
      if(!paragraphEndsAt(renderer.layout.lines,i))close(last.x+last.width,75);else assert.ok(last.x+last.width<75);
      if(characters){const letters=line.filter(e=>!e.isSpace);for(let j=1;j<letters.length;j++)if(letters[j].wordIndex===letters[j-1].wordIndex){const prev=renderer.positions[letters[j-1].index],next=renderer.positions[letters[j].index];close(next.x-prev.x,prev.width);}}
    });
  }
}));
test('live aligned anchors match the painted positions and changing alignment invalidates fitting cache',()=>withDOM(()=>{
  const model=reflowModel('aa bb cc',{a:{size:20},b:{size:20}}),reference=layoutModel(model,200),engine=new LiveReflow(model,reference),left=engine.compose(.5,{alignment:'left'}),right=engine.compose(.5,{alignment:'right'});
  assert.notStrictEqual(right,left);const last=right.layout.lines[0].at(-1);close(last.envelopeX+last.envelopeWidth,200);
  const renderer=new TextRenderer(node());renderer.mount(model,reference);renderer.render(.5,{liveReflow:true,alignment:'right'});for(const entry of renderer.layout.entries)close(renderer.positions[entry.index].x,entry.envelopeX);
}));
test('Base alignment persists independently of endpoint properties and old setups default to left',()=>{
  const saved=defaultSetup();saved.styles.alignment='justify';const normalized=normalizeSetup(JSON.parse(JSON.stringify(saved))),state=new StyleCascade();restoreCascade(state,normalized.styles);assert.equal(state.alignment,'justify');assert.equal(state.styles().a.alignment,undefined);
  delete saved.styles.alignment;assert.equal(normalizeSetup(saved).styles.alignment,'left');saved.styles.alignment='bad';assert.equal(normalizeSetup(saved).styles.alignment,'left');state.alignment='right';state.reset();assert.equal(state.alignment,'left');
});
