export const FONT_CHOICES=[
  {id:'manrope',label:'Manrope',stack:'"Manrope Morph", sans-serif'},
  {id:'sans',label:'System sans',stack:'Arial, Helvetica, sans-serif'},
  {id:'serif',label:'Serif',stack:'Georgia, "Times New Roman", serif'},
  {id:'mono',label:'Mono',stack:'"Courier New", Courier, monospace'},
];
export const fontStack=id=>(FONT_CHOICES.find(font=>font.id===id)||FONT_CHOICES[0]).stack;
export function leadingAt(a,b,t,automatic){const leading=style=>style.lineHeight>0?style.lineHeight:automatic;return leading(a)+(leading(b)-leading(a))*t;}

export function registerFont(label,savedID){
  const id=savedID||`local-${crypto.randomUUID()}`;
  if(!/^local-[a-zA-Z0-9-]+$/.test(id))throw new Error('Invalid saved font ID.');
  const existing=FONT_CHOICES.find(font=>font.id===id);if(existing)return existing;
  const family=`Between ${id}`;
  const font={id,label,stack:`"${family}", sans-serif`,family};FONT_CHOICES.push(font);return font;
}
export function unregisterFont(id){const index=FONT_CHOICES.findIndex(font=>font.id===id);if(index>=4)FONT_CHOICES.splice(index,1);}
