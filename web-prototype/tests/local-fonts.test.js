import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLocalFont } from '../src/ui/local-fonts.js';
import { FONT_CHOICES,fontStack,unregisterFont } from '../src/engine/typography.js';
import { StyleCascade } from '../src/engine/properties.js';

test('local fonts register only after successful decoding and participate in Base inheritance',async()=>{
  const savedFace=globalThis.FontFace,savedDocument=globalThis.document,originalCount=FONT_CHOICES.length;let added=null;
  globalThis.FontFace=class {constructor(family,data,descriptors){this.family=family;this.data=data;this.descriptors=descriptors;}async load(){return this;}};
  globalThis.document={fonts:{add(face){added=face;}}};
  let font;
  try{
    font=await loadLocalFont({name:'Custom Variable.woff2',arrayBuffer:async()=>new ArrayBuffer(8)});
    assert.equal(FONT_CHOICES.length,originalCount+1);assert.equal(font.label,'Custom Variable');assert.match(fontStack(font.id),new RegExp(added.family));assert.equal(added.descriptors.weight,'1 1000');
    const cascade=new StyleCascade();cascade.active.add('fontFamily');cascade.override('b','fontFamily','serif');cascade.setBase('fontFamily',font.id);assert.equal(cascade.styles().a.fontFamily,font.id);assert.equal(cascade.styles().b.fontFamily,'serif');
    globalThis.FontFace=class {async load(){throw new Error('bad font');}};
    await assert.rejects(loadLocalFont({name:'Broken.ttf',arrayBuffer:async()=>new ArrayBuffer(8)}),/Could not read/);assert.equal(FONT_CHOICES.length,originalCount+1);
    await assert.rejects(loadLocalFont({name:'Not a font.txt'}),/Choose a WOFF/);assert.equal(FONT_CHOICES.length,originalCount+1);
  }finally{if(font)unregisterFont(font.id);if(savedFace===undefined)delete globalThis.FontFace;else globalThis.FontFace=savedFace;if(savedDocument===undefined)delete globalThis.document;else globalThis.document=savedDocument;}
});
