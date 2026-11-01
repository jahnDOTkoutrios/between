import test from 'node:test';
import assert from 'node:assert/strict';
import { fitReferenceLayout } from '../src/engine/reflow.js';
import { layoutModel } from '../src/engine/measurements.js';
import { TextRenderer } from '../src/ui/renderer.js';
import { reflowModel } from './helpers/reflow-model.js';
const node=()=>({style:{},children:[],append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(){}});
function withDOM(fn){const saved=globalThis.document;globalThis.document={createElement:node,createDocumentFragment:node,createTextNode:text=>({textContent:text})};try{fn();}finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}}

test('box fitting uses the current text, rather than reserving the larger endpoint',()=>{
  const model=reflowModel(),reference=layoutModel(model,100),fitted=fitReferenceLayout(model,reference,0);
  assert.ok(reference.lines.length>1);assert.equal(fitted.lines.length,1);assert.equal(fitted.lines[0].filter(e=>!e.isSpace).length,8);
});
test('resizing refits words and characters at either endpoint while keeping dense render identities',()=>withDOM(()=>{
  for(const characters of [false,true])for(const amount of [0,.5,1]){
    const model=reflowModel('aa bb cc dd ee ff gg hh',{characters}),widths=model.widths,states=model.states;
    const counts=[];
    for(const width of [100,200,400]){
      const reference=layoutModel(model,width),fitted=fitReferenceLayout(model,reference,amount),renderer=new TextRenderer(node());renderer.mount(model,fitted);renderer.render(amount);
      assert.deepEqual(fitted.entries.map(e=>e.index),Array.from({length:fitted.entries.length},(_,i)=>i));assert.ok(renderer.inspect().maxOverflow<.001);counts.push(fitted.lines.length);
      assert.equal(model.widths,widths);assert.equal(model.states,states);
    }
    assert.ok(counts[0]>=counts[1]&&counts[1]>=counts[2]);
  }
}));
test('live-off line membership stays fixed during morphing and refits when the box is resized',()=>withDOM(()=>{
  const model=reflowModel(),fitted=fitReferenceLayout(model,layoutModel(model,100),0),renderer=new TextRenderer(node());renderer.mount(model,fitted);renderer.render(0);
  const signature=renderer.layout.lines.map(l=>l.map(e=>e.wordIndex));renderer.render(1);assert.deepEqual(renderer.layout.lines.map(l=>l.map(e=>e.wordIndex)),signature);
  const resized=fitReferenceLayout(model,layoutModel(model,120),1);renderer.mount(model,resized);renderer.render(1);assert.ok(renderer.layout.lines.length>1);assert.ok(renderer.inspect().maxOverflow<.001);
}));
test('fitted paragraph layouts retain blank lines, alignment and native-selection whitespace',()=>withDOM(()=>{
  const text='aa bb\n\ncc dd',model=reflowModel(text,{characters:true}),reference=layoutModel(model,200,model.a,model.b,'right'),fitted=fitReferenceLayout(model,reference,.5,{alignment:'right'}),renderer=new TextRenderer(node());
  assert.equal(fitted.lines[1].length,0);assert.equal(fitted.alignment,'right');renderer.mount(model,fitted);renderer.render(.5,{alignment:'right'});
  const logical=renderer.nodes.filter(n=>n.node.className!=='word is-space').map(n=>n.ink.textContent+(n.gap?.textContent||'')).join('');assert.equal(logical,text);
  renderer.render(.5,{liveReflow:true,alignment:'right'});assert.ok(renderer.positions.every(p=>p.hidden||Number.isFinite(p.x)));
}));
test('line-based curve snapshots retain the exact fitted samples instead of overflowing on repaint',()=>withDOM(()=>{
  for(const characters of [false,true])for(const unit of ['word','line',...(characters?['character']:[])])for(const restart of ['never','line'])for(const width of [80,110,150]){
    const model=reflowModel(undefined,{characters}),distribution={unit,scope:'text',scopeIndex:1,restart,restartWords:1,curve:'gaussian',steps:0,peak:.5,width:.22,power:2,invert:false,smooth:true,points:[{x:0,y:0},{x:.5,y:1},{x:1,y:0}]};
    const reference=fitReferenceLayout(model,layoutModel(model,width),1,{mode:'curve',distribution}),renderer=new TextRenderer(node());renderer.mount(model,reference);renderer.render(1,{mode:'curve',distribution});
    assert.ok(renderer.inspect().maxOverflow<.001,`${characters}/${unit}/${restart}/${width}`);renderer.render(1,{mode:'curve',distribution});assert.ok(renderer.inspect().maxOverflow<.001);
  }
}));
