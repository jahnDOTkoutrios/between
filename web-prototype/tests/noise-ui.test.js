import test from 'node:test';
import assert from 'node:assert/strict';
import { NoiseEditor } from '../src/ui/noise-editor.js';
import { defaultDistribution } from '../src/engine/distribution.js';
class Element {
  constructor(tag='button'){this.tagName=tag.toUpperCase();this.events={};this.children=[];this.attributes={};this.classes=new Set();this.classList={toggle:(key,yes)=>yes?this.classes.add(key):this.classes.delete(key)};this._value='';}
  set value(v){this._value=String(v);}get value(){return this._value;}get valueAsNumber(){return Number(this.value);}
  append(...children){this.children.push(...children);}addEventListener(event,fn){this.events[event]=fn;}setAttribute(key,value){this.attributes[key]=value;}
  checkValidity(){return this.value!==''&&Number.isFinite(this.valueAsNumber)&&this.valueAsNumber>=Number(this.min)&&this.valueAsNumber<=Number(this.max)&&Number.isInteger(this.valueAsNumber);}
}
function harness(run){
  const saved={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame},frames=new Map();let id=0,changes=0,editor;
  globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text})};globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};globalThis.cancelAnimationFrame=key=>frames.delete(key);
  try{const distribution=defaultDistribution(),button=new Element();editor=new NoiseEditor(button,new Element('div'),distribution,()=>changes++);run({editor,distribution,button,frames,changes:()=>changes,paint:()=>{for(const[key,fn]of [...frames]){frames.delete(key);fn();}}});}
  finally{editor?.discardInput();Object.assign(globalThis,saved);}
}
test('noise controls start Off, enable only usable targets and keep their activity specific to Curve',()=>harness(({editor,distribution,button})=>{
  assert.equal(editor.type.value,'off');assert.equal(editor.amount.disabled,true);assert.equal(editor.words.disabled,true);
  editor.type.value='smooth';editor.type.events.change();assert.equal(distribution.noise.type,'smooth');assert.equal(editor.amount.disabled,false);assert.equal(editor.words.disabled,true);assert.equal(button.attributes['aria-pressed'],'true');
  editor.sync('scrub');assert.equal(button.attributes['aria-pressed'],'false');assert.equal(distribution.noise.type,'smooth');distribution.restart='word';editor.sync('curve');assert.equal(editor.words.disabled,false);
}));
test('noise sliders coalesce updates into one animation frame and commit the final drag value',()=>harness(({editor,distribution,frames,paint,changes})=>{
  editor.type.value='random';editor.type.events.change();const before=changes();for(const value of [30,40,60]){editor.amount.value=value;editor.amount.events.input();}
  assert.equal(frames.size,1);assert.equal(distribution.noise.amount,25);paint();assert.equal(distribution.noise.amount,60);assert.equal(changes(),before+1);
  editor.amount.value=73;editor.amount.events.input();editor.amount.events.change();assert.equal(frames.size,0);assert.equal(distribution.noise.amount,73);
}));
test('noise seed typing is deferred and pending valid values flush on refresh with the slider',()=>harness(({editor,distribution,frames})=>{
  editor.seed.value='200';editor.seed.events.input();assert.equal(distribution.noise.seed,1);editor.amount.value=64;editor.amount.events.input();editor.flush();assert.equal(distribution.noise.seed,200);assert.equal(distribution.noise.amount,64);assert.equal(frames.size,0);
  editor.seed.value='-1';editor.seed.events.input();editor.flush();assert.equal(distribution.noise.seed,200);editor.seed.value='0';editor.seed.events.input();editor.flush();assert.equal(distribution.noise.seed,0);
}));
test('pending seed commits do not swallow target or noise-type edits',()=>harness(({editor,distribution})=>{
  editor.seed.value='123';editor.seed.events.input();editor.type.value='fractal';editor.type.events.change();assert.equal(distribution.noise.seed,123);assert.equal(distribution.noise.type,'fractal');
  distribution.restart='word';editor.sync();editor.seed.value='456';editor.seed.events.input();editor.words.checked=true;editor.words.events.change();assert.equal(distribution.noise.seed,456);assert.equal(distribution.noise.restartWords,true);assert.match(editor.detail.textContent,/Groups:/);
}));
test('Restore defaults cancels pending noise input and scheduled slider calculations',()=>harness(({editor,distribution,frames})=>{
  editor.seed.value='999';editor.seed.events.input();editor.amount.value=88;editor.amount.events.input();Object.assign(distribution,defaultDistribution());editor.restore();assert.equal(frames.size,0);assert.equal(editor.pending,false);assert.equal(editor.type.value,'off');assert.equal(editor.seed.value,'1');assert.equal(editor.amount.value,'25');editor.flush();assert.equal(distribution.noise.seed,1);
}));
