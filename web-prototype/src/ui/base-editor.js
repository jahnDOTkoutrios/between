import { loadLocalFont } from './local-fonts.js';
import { PROPERTIES } from '../engine/properties.js';
import { anchorPopover } from './popover.js';
import { styleInput, fieldValue } from './style-fields.js';
export class BaseEditor {
  constructor(button,panel,state,onChange){this.panel=panel;this.state=state;this.onChange=onChange;anchorPopover(button,panel,300);this.render();}
  fields(){return PROPERTIES.filter(property=>property.inherit||this.state.active.has(property.id)).flatMap(property=>property.fields);}
  valid(){return this.fields().every(field=>fieldValue(this.panel.querySelector(`#base-${field.key}`),field)!==null);}
  render(){
    this.panel.replaceChildren();
    const properties=[...PROPERTIES.filter(p=>p.inherit),...PROPERTIES.filter(p=>!p.inherit&&this.state.active.has(p.id))];
    for(const property of properties)for(const field of property.fields){
      const label=document.createElement('label');label.className='setting-row';label.htmlFor=`base-${field.key}`;label.append(document.createTextNode(field.label==='Leading'?'Line height':field.label));
      const value=document.createElement('span'),input=styleInput(field,`base-${field.key}`,`Base ${field.label==='Leading'?'line height':field.label.toLowerCase()}`,this.state.base[field.key]);value.append(input);if(field.unit)value.append(document.createTextNode(field.unit));label.append(value);this.panel.append(label);
      input.addEventListener('input',()=>{const next=fieldValue(input,field);if(next!==null)this.state.setBase(field.key,next);this.onChange(next!==null,{deferPreview:field.type==='number'});});
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
