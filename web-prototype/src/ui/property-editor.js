import { PROPERTIES, StyleCascade } from '../engine/properties.js';
import { anchorPopover } from './popover.js';
import { BaseEditor } from './base-editor.js';
import { styleInput, fieldValue, setInputValue, refreshFontChoices } from './style-fields.js';

export class PropertyEditor {
  constructor(form,button,menu,onChange,{baseButton,basePanel}={}) {
    this.form=form;this.button=button;this.menu=menu;this.onChange=onChange;this.state=new StyleCascade();
    this.fields=new Map(PROPERTIES.flatMap(property=>property.fields).map(field=>[field.key,field]));
    anchorPopover(button,menu);form.addEventListener('submit',event=>event.preventDefault());
    form.addEventListener('input',event=>{
      const input=event.target,field=this.fields.get(input.dataset.field),endpoint=input.dataset.endpoint;if(!field||!endpoint)return;
      const value=fieldValue(input,field);if(value!==null){this.state.override(endpoint,field.key,value);this.showInheritance(input);}
      this.onChange(this.read(),{deferPreview:field.type==='number'});
    });
    if(baseButton&&basePanel)this.baseEditor=new BaseEditor(baseButton,basePanel,this.state,(valid,options)=>{if(valid){refreshFontChoices(this.form);this.syncInherited();}this.onChange(valid?this.read():null,options);});
    this.render();
  }
  read() {
    for(const input of this.form.querySelectorAll('input,select'))if(fieldValue(input,this.fields.get(input.dataset.field))===null)return null;
    if(this.baseEditor&&!this.baseEditor.valid())return null;
    return this.state.styles();
  }
  showInheritance(input){const owns=this.state.owns(input.dataset.endpoint,input.dataset.field),row=input.closest('.property-row');row.classList.toggle('inherited',!owns);row.querySelector('.inherit-property').disabled=!owns;input.title=owns?'Endpoint override. Use the arrow to inherit Base.':'Inherited from Base. Edit to override.';if(input.dataset.field==='fontFamily')input.title+=' Different fonts switch at the midpoint.';if(input.dataset.field==='lineHeight')input.title+=' Empty or 0 = Auto.';}
  syncInherited(){for(const input of this.form.querySelectorAll('input,select')){const endpoint=input.dataset.endpoint,key=input.dataset.field;if(!this.state.owns(endpoint,key))setInputValue(input,this.fields.get(key),this.state.base[key]);this.showInheritance(input);}}
  toggle(id,enabled) {
    if(enabled)this.state.active.add(id);else this.state.active.delete(id);
    this.render();this.baseEditor?.render();this.onChange(this.read());
    if(this.menu.matches(':popover-open'))this.menu.hidePopover();this.button.focus();
  }
  setTheme(dark){
    const from=dark?['#252525','#a2a29b']:['#e5e5e5','#999992'],to=dark?['#e5e5e5','#999992']:['#252525','#a2a29b'];
    for(const style of [this.state.base,this.state.raw.a,this.state.raw.b])for(const key of ['color','outlineColor']){const i=from.indexOf(style[key]);if(i>=0)style[key]=to[i];}
    this.dark=dark;this.render();this.baseEditor?.render();return this.read();
  }
  reset(){this.state.reset();if(this.dark)this.setTheme(true);this.render();this.baseEditor?.render();return this.read();}
  render() {
    this.form.replaceChildren();const styles=this.state.styles();
    for(const endpoint of ['a','b']) {
      const fieldset=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=endpoint.toUpperCase();fieldset.append(legend);
      for(const property of PROPERTIES)if(this.state.active.has(property.id))property.fields.forEach((field,index)=>{
        const row=document.createElement('div');row.className='property-row';
        const caption=document.createElement('div');caption.className='property-label';
        const label=document.createElement('label');label.htmlFor=`${endpoint}-${field.key}`;label.textContent=field.label;caption.append(label);
        if(index===0){const remove=document.createElement('button');remove.type='button';remove.className='remove-property';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${property.label.toLowerCase()} from both styles`);remove.title=`Remove ${property.label.toLowerCase()} from both styles`;remove.addEventListener('click',()=>this.toggle(property.id,false));caption.append(remove);}
        const value=document.createElement('span');value.className='property-value';
        const inherit=document.createElement('button');inherit.type='button';inherit.className='inherit-property';inherit.textContent='↶';inherit.setAttribute('aria-label',`Use Base for ${endpoint.toUpperCase()} ${field.label.toLowerCase()}`);inherit.title='Use Base';
        const input=styleInput(field,`${endpoint}-${field.key}`,`Style ${endpoint.toUpperCase()} ${field.label.toLowerCase()}`,styles[endpoint][field.key]);input.dataset.endpoint=endpoint;
        inherit.addEventListener('click',()=>{this.state.inherit(endpoint,field.key);setInputValue(input,field,this.state.base[field.key]);this.showInheritance(input);this.onChange(this.read());});
        value.append(inherit,input);if(field.unit){const unit=document.createElement('span');unit.textContent=field.unit;value.append(unit);}
        row.append(caption,value);fieldset.append(row);
      });this.form.append(fieldset);
    }
    this.syncInherited();this.menu.replaceChildren();
    for(const property of PROPERTIES)if(!this.state.active.has(property.id)){
      const add=document.createElement('button');add.type='button';add.textContent=property.label;add.addEventListener('click',()=>this.toggle(property.id,true));this.menu.append(add);
    }
    if(!this.menu.children.length){const message=document.createElement('span');message.textContent='All properties added';this.menu.append(message);}
  }
}
