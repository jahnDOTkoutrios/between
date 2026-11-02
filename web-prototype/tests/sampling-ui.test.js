import test from 'node:test';
import assert from 'node:assert/strict';
import { DistributionEditor } from '../src/ui/distribution-editor.js';
import { defaultDistribution } from '../src/engine/distribution.js';
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.events={};this.children=[];this.attributes={};this.classList={add(){}};this._value='';this.type='';}
 set value(value){this._value=String(value);}get value(){return this._value;}get valueAsNumber(){return this.value===''?NaN:Number(this.value);}
 append(...children){for(const child of children){if(child.parentElement)child.parentElement.children=child.parentElement.children.filter(e=>e!==child);child.parentElement=this;this.children.push(child);}}
 replaceChildren(...children){this.children=[];this.append(...children);}addEventListener(key,fn){this.events[key]=fn;}setAttribute(key,value){this.attributes[key]=value;}contains(){return false;}
 checkValidity(){return Number.isFinite(this.valueAsNumber)&&(this.min===undefined||this.valueAsNumber>=Number(this.min))&&(this.max===undefined||this.valueAsNumber<=Number(this.max));}
}
function harness(run){
 const saved={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame},frames=new Map(),changes=[];let id=0,editor;
 globalThis.document={activeElement:null,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),createTextNode:text=>({textContent:text})};
 globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 try{const settings=defaultDistribution();editor=new DistributionEditor(new Element('button'),new Element(),settings,key=>changes.push(key));run({editor,settings,changes,frames,tick(){for(const[id,fn]of [...frames]){frames.delete(id);fn();}}});}
 finally{editor?.restore(defaultDistribution());Object.assign(globalThis,saved);}
}
test('sampling controls default to Follow layout and expose Sample width only for Fixed line structures',()=>harness(({editor,settings})=>{
 assert.equal(editor.controls.patternOffset.value,'0');assert.equal(editor.controls.sampleWidth.value,'100');assert.equal(editor.rows.lineSampling.hidden,true);assert.equal(editor.rows.sampleWidth.hidden,true);
 settings.restart='line';editor.sync();assert.equal(editor.rows.lineSampling.hidden,false);assert.equal(editor.rows.sampleWidth.hidden,true);
 settings.lineSampling='fixed';editor.sync();assert.equal(editor.rows.sampleWidth.hidden,false);assert.equal(editor.samplingActions.hidden,false);
 settings.restart='word';editor.sync();assert.equal(editor.rows.sampleWidth.hidden,true);assert.equal(editor.rows.patternOffset.hidden,undefined);
}));
test('sample sliders coalesce changes per animation frame and release flushes the last value',()=>harness(({editor,settings,frames,tick,changes})=>{
 for(const value of [90,82,75.3]){editor.sliders.sampleWidth.value=value;editor.sliders.sampleWidth.events.input();}
 assert.equal(settings.sampleWidth,100);assert.equal(editor.controls.sampleWidth.value,'75.3');assert.equal(frames.size,1);tick();assert.equal(settings.sampleWidth,75.3);assert.deepEqual(changes,['sampleWidth']);
 editor.sliders.sampleWidth.value=125;editor.sliders.sampleWidth.events.input();editor.sliders.sampleWidth.events.change();assert.equal(settings.sampleWidth,125);assert.equal(frames.size,0);
}));
test('offset dragging snaps to signed units while numeric fractions and large values remain exact',()=>harness(({editor,settings,tick})=>{
 editor.sampleCount(20);assert.equal(editor.sliders.patternOffset.min,-20);assert.equal(editor.sliders.patternOffset.max,20);
 editor.sliders.patternOffset.value=-1.875;editor.sliders.patternOffset.events.input();tick();assert.equal(settings.patternOffset,-2);
 editor.controls.patternOffset.value='21.375';editor.controls.patternOffset.events.input();assert.equal(settings.patternOffset,-2);editor.flushNumbers();assert.equal(settings.patternOffset,21.375);assert.equal(Number(editor.sliders.patternOffset.value),1.375);assert.equal(editor.controls.patternOffset.value,'21.375');
}));
test('positive typed sample widths are delayed, allow fractions and expand the slider beyond its usual span',()=>harness(({editor,settings})=>{
 const input=editor.controls.sampleWidth;input.value='200.125';input.events.input();assert.equal(settings.sampleWidth,100);editor.flushNumbers();assert.equal(settings.sampleWidth,200.125);assert.equal(editor.sliders.sampleWidth.max,200.125);
 for(const invalid of ['0','-1','bad','']){input.value=invalid;input.events.input();editor.flushNumbers();assert.equal(settings.sampleWidth,200.125);}
}));
test('Resample flushes pending input and clears the source without changing curve or offset',()=>harness(({editor,settings,changes})=>{
 settings.lineSample={lines:[[0,1]]};settings.patternOffset=1.375;settings.curve='gaussian';editor.controls.sampleWidth.value='72.125';editor.controls.sampleWidth.events.input();editor.resample.events.click();
 assert.equal(settings.lineSample,null);assert.equal(settings.sampleWidth,72.125);assert.equal(settings.patternOffset,1.375);assert.equal(settings.curve,'gaussian');assert.equal(changes.at(-1),'resample');
}));
test('refresh flushing captures draft sliders and Restore defaults cancels all pending sampling edits',()=>harness(({editor,settings,frames})=>{
 editor.sliders.sampleWidth.value=85;editor.sliders.sampleWidth.events.input();editor.controls.patternOffset.value='1.25';editor.controls.patternOffset.events.input();editor.flushNumbers();assert.equal(settings.sampleWidth,85);assert.equal(settings.patternOffset,1.25);
 editor.sliders.sampleWidth.value=60;editor.sliders.sampleWidth.events.input();editor.controls.patternOffset.value='900';editor.controls.patternOffset.events.input();editor.restore(defaultDistribution());assert.equal(frames.size,0);assert.equal(settings.sampleWidth,100);assert.equal(settings.patternOffset,0);editor.flushNumbers();assert.equal(settings.patternOffset,0);
}));
