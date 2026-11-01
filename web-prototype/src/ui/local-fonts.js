import { registerFont,unregisterFont } from '../engine/typography.js';
import { storeFont,storedFonts } from './font-storage.js';

async function decodeFont(label,bytes,id){
  const font=registerFont(label,id);
  try{
    const face=new FontFace(font.family,bytes,{weight:'1 1000'});
    await face.load();document.fonts.add(face);return font;
  }catch{unregisterFont(font.id);throw new Error('Could not read this font. Try another font file.');}
}
export async function loadLocalFont(file){
  if(!/\.(woff2?|ttf|otf)$/i.test(file.name))throw new Error('Choose a WOFF, WOFF2, TTF or OTF font.');
  const bytes=await file.arrayBuffer(),font=await decodeFont(file.name.replace(/\.[^.]+$/,''),bytes);
  font.persisted=await storeFont({id:font.id,label:font.label,bytes});return font;
}
export async function restoreLocalFonts(){
  for(const record of await storedFonts()){
    try{await decodeFont(record.label,record.bytes,record.id);}catch{/* A damaged font must not prevent the editor from opening. */}
  }
}
