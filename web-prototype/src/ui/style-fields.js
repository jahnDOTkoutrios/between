import { FONT_CHOICES } from '../engine/typography.js';
import { validStyleNumber } from '../engine/properties.js';
export function styleInput(field,id,label,value){
  const input=document.createElement(field.type==='select'?'select':'input');input.id=id;input.name=id;input.dataset.field=field.key;input.setAttribute('aria-label',label);
  if(field.type==='select'){for(const[value,text]of (field.key==='fontFamily'?FONT_CHOICES.map(font=>[font.id,font.label]):field.choices)){const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option);}input.title='Different endpoint fonts switch at the midpoint.';}
  else{input.type=field.type;if(field.type==='number'){if(field.min!==undefined)input.min=field.min;if(field.max!==undefined)input.max=field.max;input.step=field.step;if(field.auto){input.placeholder='Auto';input.title=field.autoTitle||'Empty or 0 = automatic line height.';}}}
  setInputValue(input,field,value);return input;
}
export function setInputValue(input,field,value){input.value=field.auto&&value===0?'':value;}
export function fieldValue(input,field){if(!input.checkValidity())return null;if(field.auto&&input.value==='')return 0;return field.type==='number'?(validStyleNumber(field,input.valueAsNumber)?input.valueAsNumber:null):input.value;}

export function refreshFontChoices(root){
  for(const input of root.querySelectorAll('select[data-field="fontFamily"]')){
    const selected=input.value;input.replaceChildren();
    for(const font of FONT_CHOICES){const option=document.createElement('option');option.value=font.id;option.textContent=font.label;input.append(option);}
    input.value=selected;
  }
}
