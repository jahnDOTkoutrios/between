import { loadLocalFont } from './local-fonts.js';
import { ALIGNMENTS } from '../engine/alignment.js';
import { PROPERTIES } from '../engine/properties.js';
import { anchorPopover } from './popover.js';
import { styleInput, fieldValue } from './style-fields.js';
const FRAME_WIDTH={key:'frameWidth',label:'Text width',type:'number',min:0,step:'any',unit:'px',auto:true,autoTitle:'Empty or 0 = fill the available width. Larger widths fit the available screen.'};
export class BaseEditor {
  constructor(button,panel,state,onChange){this.panel=panel;this.state=state;this.onChange=onChange;anchorPopover(button,panel,260);this.render();}
  fields(){return [...PROPERTIES.filter(property=>property.inherit||this.state.active.has(property.id)).flatMap(property=>property.fields),FRAME_WIDTH];}
  valid(){return this.fields().every(field=>fieldValue(this.panel.querySelector(`#base-${field.key}`),field)!==null);}
  render(){
    this.panel.replaceChildren();
    const properties=[...PROPERTIES.filter(p=>p.inherit),{id:'alignment',fields:[]},{id:'frameWidth',layout:true,fields:[FRAME_WIDTH]},...PROPERTIES.filter(p=>!p.inherit&&this.state.active.has(p.id))];
    for(const property of properties){
      if(property.id==='alignment'){
        const label=document.createElement('label');label.className='setting-row';label.textContent='Alignment';
        const input=document.createElement('select');input.id='base-alignment';label.htmlFor=input.id;input.setAttribute('aria-label','Base alignment');
        for(const[value,text]of ALIGNMENTS){const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option);}
        input.value=this.state.alignment||'left';input.addEventListener('change',()=>{this.state.alignment=input.value;this.onChange(true);});label.append(input);this.panel.append(label);
      }
      for(const field of property.fields){
      const label=document.createElement('label');label.className='setting-row';label.htmlFor=`base-${field.key}`;label.append(document.createTextNode(field.label==='Leading'?'Line height':field.label));
      const value=document.createElement('span'),input=styleInput(field,`base-${field.key}`,`Base ${field.label==='Leading'?'line height':field.label.toLowerCase()}`,property.layout?this.state[field.key]:this.state.base[field.key]);value.append(input);if(field.unit)value.append(document.createTextNode(field.unit));label.append(value);this.panel.append(label);
      input.addEventListener('input',()=>{const next=fieldValue(input,field);if(next!==null){if(property.layout)this.state[field.key]=next;else this.state.setBase(field.key,next);}this.onChange(next!==null,{deferPreview:field.type==='number'});});
    }
    }
    const actions=document.createElement('div');actions.className='font-actions';
    const open=document.createElement('button');open.type='button';open.className='text-button';open.textContent='Open font…';open.title='Load a local WOFF, WOFF2, TTF or OTF file';
    const picker=document.createElement('input');picker.type='file';picker.accept='.woff,.woff2,.ttf,.otf';picker.hidden=true;picker.setAttribute('aria-label','Open font file');
    const status=document.createElement('span');status.className='font-status';status.setAttribute('role','status');
    open.addEventListener('click',()=>picker.click());
    picker.addEventListener('change',async()=>{
      const file=picker.files[0];if(!file)return;open.disabled=true;status.textContent='Loading…';
      try{const font=await loadLocalFont(file);this.state.setBase('fontFamily',font.id);this.render();if(!font.persisted)this.panel.querySelector('.font-status').textContent='Loaded for this session; browser storage is unavailable.';this.onChange(true);}
      catch(error){status.textContent=error.message;}
      finally{open.disabled=false;picker.value='';}
    });
    actions.append(open,picker,status);this.panel.append(actions);
  }
}
