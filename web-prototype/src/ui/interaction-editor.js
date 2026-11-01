import { anchorPopover } from './popover.js';
const definitions={
  radius:{label:'Radius',min:0,positive:true,step:'any',unit:'px',modes:['pointer']},
  width:{label:'Width',min:0,positive:true,step:'any',unit:'',modes:['wipe','wave']},
  speed:{label:'Duration',min:0,positive:true,step:'any',unit:'s',modes:['scrub','curve','wipe','wave']},
  playback:{label:'Playback',choices:[['bounce','Back and forth'],['loop','Loop']],modes:['scrub','curve','wipe','wave']},
  response:{label:'Response',min:0,step:'any',unit:'ms'},
  sensitivity:{label:'Scroll range',min:0,positive:true,step:'any',unit:'px',modes:['scroll']},
  easing:{label:'Ease',choices:[['linear','Linear'],['smooth','Smooth'],['in','Ease in'],['out','Ease out']]},
  reverse:{label:'Reverse',type:'checkbox',modes:['wipe','wave']},
  invert:{label:'Invert A/B',type:'checkbox'},
};
export class InteractionEditor {
  constructor(button,panel,onChange) {this.panel=panel;this.onChange=onChange;anchorPopover(button,panel);}
  render(mode,settings) {
    this.panel.replaceChildren();
    for(const [key,definition] of Object.entries(definitions)){
      if(definition.modes&&!definition.modes.includes(mode))continue;
      const label=document.createElement('label');label.className='setting-row';label.append(document.createTextNode(definition.label));
      const wrapper=document.createElement('span');let control;
      if(definition.choices){control=document.createElement('select');for(const [value,text] of definition.choices){const option=document.createElement('option');option.value=value;option.textContent=text;control.append(option);}control.value=settings[key];}
      else{control=document.createElement('input');control.type=definition.type||'number';if(control.type==='checkbox')control.checked=settings[key];else{if(definition.min!==undefined)control.min=definition.positive?Number.MIN_VALUE:definition.min;if(definition.max!==undefined)control.max=definition.max;control.step=definition.step;control.value=settings[key];}}
      control.setAttribute('aria-label',definition.label);
      control.addEventListener('input',()=>{if(!control.checkValidity())return;const value=definition.choices?control.value:control.type==='checkbox'?control.checked:control.valueAsNumber;if(typeof value==='number'&&(!Number.isFinite(value)||(definition.positive&&value<=0)))return;this.onChange(key,value);});
      wrapper.append(control);if(definition.unit)wrapper.append(document.createTextNode(definition.unit));label.append(wrapper);this.panel.append(label);
    }
  }
}
