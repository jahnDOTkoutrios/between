import { anchorPopover } from './popover.js';
import { CURVES, curveAt, moveCurvePoint, addCurvePoint,lineDistribution,fixedSampling } from '../engine/distribution.js';
const structures=[['text','Text'],['paragraph','Paragraph'],['sentence','Sentence'],['line','Line'],['word','Word']];
const NS='http://www.w3.org/2000/svg';
function svgElement(name,attributes){const el=document.createElementNS(NS,name);for(const[key,value]of Object.entries(attributes))el.setAttribute(key,value);return el;}
export class DistributionEditor {
  constructor(button,panel,settings,onChange){
    this.settings=settings;this.onChange=onChange;this.panel=panel;this.selected=1;this.rows={};this.controls={};this.pending=new Map();this.sliders={};this.rangeDrafts=new Map();this.rangeFrame=0;this.unitCount=100;anchorPopover(button,panel,320);
    this.select('curve','Curve',CURVES);
    this.graph=svgElement('svg',{viewBox:'0 0 260 140',role:'group','aria-label':'Curve editor',tabindex:0});this.graph.classList.add('curve-editor');
    this.grid=svgElement('path',{d:'M10 10V130H250 M10 70H250 M130 10V130',fill:'none',stroke:'#e5e5e5'});
    this.path=svgElement('path',{fill:'none',stroke:'#333','stroke-width':1.5});this.points=svgElement('g',{});this.graph.append(this.grid,this.path,this.points);panel.append(this.graph);
    this.pointTools=document.createElement('div');this.pointTools.className='curve-point-tools';
    for(const[title,text,action]of [['Add point','+',()=>this.addPoint()],['Remove point','−',()=>this.removePoint()],['Reset curve','↺',()=>{settings.points=[{x:0,y:0},{x:.5,y:1},{x:1,y:0}];this.selected=1;this.changed('points');}]]){const b=document.createElement('button');b.className='icon-button';b.type='button';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);b.addEventListener('click',()=>{this.flushNumbers();action();});this.pointTools.append(b);}
    panel.append(this.pointTools);
    this.number('pointX','Point x',0,1,.001);this.number('pointY','Point y',0,1,.001);
    this.number('peak','Peak',0,1,'any');this.number('width','Width',0,undefined,'any',true);this.number('power','Power',0,undefined,'any',true);
    this.select('unit','Values per',[['all','All'],['character','Character'],['letter','Letter'],['word','Word'],['sentence','Sentence'],['line','Line'],['paragraph','Paragraph']]);
    this.select('restart','Restart',[['never','Never'],['word','Word'],['sentence','Sentence'],['paragraph','Paragraph'],['line','Line']]);
    this.number('restartWords','Every … words',1,undefined,1);this.number('steps','Steps',0,undefined,1);this.controls.steps.title='0 = one sample per unit';
    this.select('scope','Scope',structures);this.number('scopeIndex','Which',1,10000,1);
    this.range('patternOffset','Pattern offset',-100,100,1);
    this.select('lineSampling','Line sampling',[['follow','Follow layout'],['fixed','Fixed']]);
    this.range('sampleWidth','Sample width',50,150,.1,'%',true);
    this.controls.sampleWidth.title='Percentage of the displayed block width. Sample Style A at that width, then display the pattern in the actual block. Positive fractions are allowed.';
    this.controls.patternOffset.title='Shift across restart boundaries. Positive moves forward; negative backward. Wraps at the ends. Type fractions to interpolate neighbouring samples.';
    this.samplingActions=document.createElement('div');this.samplingActions.className='sampling-actions';
    this.resample=document.createElement('button');this.resample.type='button';this.resample.className='text-button';this.resample.textContent='Resample';this.resample.setAttribute('aria-label','Resample lines');this.resample.title='Sample again at this percentage of the current text width.';
    this.resample.addEventListener('click',()=>{this.flushNumbers();settings.lineSample=null;this.changed('resample');});this.samplingActions.append(this.resample);panel.append(this.samplingActions);
    this.checkbox('invert','Invert curve');this.checkbox('smooth','Smooth');
    let drag=null;
    this.graph.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;event.preventDefault();this.flushNumbers();this.customize();const rect=this.graph.getBoundingClientRect(),at=this.pointAt(event,rect);
      const index=event.target.closest('circle')?.dataset.index;
      this.selected=index===undefined?settings.points.reduce((best,p,i)=>Math.hypot(p.x-at.x,p.y-at.y)<Math.hypot(settings.points[best].x-at.x,settings.points[best].y-at.y)?i:best,0):Number(index);
      drag={rect};this.graph.setPointerCapture(event.pointerId);this.graph.focus();this.draw();
    });
    this.graph.addEventListener('pointermove',event=>{if(!drag)return;const at=this.pointAt(event,drag.rect);moveCurvePoint(settings.points,this.selected,at.x,settings.invert?1-at.y:at.y);this.changed('points');});
    const release=()=>{drag=null;};this.graph.addEventListener('pointerup',release);this.graph.addEventListener('pointercancel',release);this.graph.addEventListener('lostpointercapture',release);
    this.graph.addEventListener('dblclick',event=>{this.customize();const at=this.pointAt(event,this.graph.getBoundingClientRect());this.selected=addCurvePoint(settings.points,at.x,settings.invert?1-at.y:at.y);this.changed('points');});
    this.graph.addEventListener('keydown',event=>{
      if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();this.removePoint();return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();this.customize();this.selected=Number(event.target.dataset.index??this.selected);const p=settings.points[this.selected],step=event.shiftKey?.05:.01;
      moveCurvePoint(settings.points,this.selected,p.x+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),p.y+(event.key==='ArrowUp'?step:event.key==='ArrowDown'?-step:0));this.changed('points');
    });
    this.sync();
  }
  row(key,label,control){const row=document.createElement('label');row.className='setting-row';row.append(document.createTextNode(label),control);this.panel.append(row);this.rows[key]=row;this.controls[key]=control;control.setAttribute('aria-label',label);}
  select(key,label,choices){const control=document.createElement('select');for(const[value,text]of choices){const option=document.createElement('option');option.value=value;option.textContent=text;control.append(option);}control.value=this.settings[key];this.row(key,label,control);control.addEventListener('change',()=>{const value=control.value;this.flushNumbers();this.settings[key]=value;this.changed(key);});}
  number(key,label,min,max,step,positive=false){const control=document.createElement('input');control.type='number';Object.assign(control,{step,value:this.settings[key]??0});if(positive||min!==undefined)control.min=positive?Number.MIN_VALUE:min;if(max!==undefined)control.max=max;this.row(key,label,control);let timer=0;
    const update=()=>{clearTimeout(timer);if(!this.pending.has(key))return;if(!control.value||!control.checkValidity()||!Number.isFinite(control.valueAsNumber)||(positive&&control.valueAsNumber<=0))return;
      this.pending.delete(key);
      if(key==='pointX'||key==='pointY'){const p=this.settings.points[this.selected];moveCurvePoint(this.settings.points,this.selected,key==='pointX'?control.valueAsNumber:p.x,key==='pointY'?control.valueAsNumber:p.y);this.changed('points');}
      else{this.settings[key]=control.valueAsNumber;this.changed(key);}
    };
    control.addEventListener('input',()=>{clearTimeout(timer);this.pending.set(key,update);timer=setTimeout(update,220);});control.addEventListener('change',update);control.addEventListener('blur',update);control.addEventListener('keydown',event=>{if(event.key==='Enter')update();});
  }
  checkbox(key,label){const control=document.createElement('input');control.type='checkbox';control.checked=this.settings[key];this.row(key,label,control);control.addEventListener('change',()=>{const value=control.checked;this.flushNumbers();this.settings[key]=value;this.changed(key);});}
  range(key,label,min,max,step,suffix='',positive=false){
    this.number(key,label,positive?Number.MIN_VALUE:undefined,undefined,'any',positive);
    const input=this.controls[key],group=document.createElement('span'),slider=document.createElement('input'),unit=document.createElement('span');group.className='distribution-range';
    Object.assign(slider,{type:'range',min,max,step,value:this.settings[key]});slider.setAttribute('aria-label',`${label} slider`);unit.className='distribution-unit';unit.textContent=suffix;
    group.append(slider,input,unit);this.rows[key].append(group);this.sliders[key]=slider;if(key==='patternOffset')this.offsetUnit=unit;
    slider.addEventListener('input',()=>{const value=step===1?Math.round(Number(slider.value)):Number(slider.value);this.pending.delete(key);input.value=value;this.rangeDrafts.set(key,value);if(!this.rangeFrame)this.rangeFrame=requestAnimationFrame(()=>this.flushRanges());});
    slider.addEventListener('change',()=>{this.rangeDrafts.set(key,step===1?Math.round(Number(slider.value)):Number(slider.value));this.flushRanges();});
  }
  flushRanges(){if(this.rangeFrame)cancelAnimationFrame(this.rangeFrame);this.rangeFrame=0;const drafts=[...this.rangeDrafts];this.rangeDrafts.clear();for(const[key,value]of drafts)this.settings[key]=value;if(drafts.length){this.sync();for(const[key]of drafts)this.onChange(key);}}
  restore(settings){this.pending.clear();if(this.rangeFrame)cancelAnimationFrame(this.rangeFrame);this.rangeFrame=0;this.rangeDrafts.clear();this.selected=1;Object.assign(this.settings,settings);this.sync();}
  flushNumbers(){this.flushRanges();for(const update of [...this.pending.values()])update();}
  customize(){if(this.settings.curve==='custom')return;this.settings.points=Array.from({length:5},(_,i)=>({x:i/4,y:curveAt(i/4,{...this.settings,invert:false})}));this.settings.curve='custom';this.settings.invert=false;this.controls.curve.value='custom';this.onChange('curve');this.sync();}
  changed(key){this.sync();this.onChange(key);}
  addPoint(){this.customize();let gap=0,index=0;for(let i=0;i<this.settings.points.length-1;i++){const width=this.settings.points[i+1].x-this.settings.points[i].x;if(width>gap){gap=width;index=i;}}const x=this.settings.points[index].x+gap/2;this.selected=addCurvePoint(this.settings.points,x,curveAt(x,{...this.settings,invert:false}));this.changed('points');}
  removePoint(){const points=this.settings.points;if(this.settings.curve!=='custom'||this.selected===0||this.selected===points.length-1)return;points.splice(this.selected,1);this.selected=Math.min(this.selected,points.length-1);this.changed('points');}
  pointAt(event,rect){return{x:Math.max(0,Math.min(1,((event.clientX-rect.left)/rect.width*260-10)/240)),y:Math.max(0,Math.min(1,1-((event.clientY-rect.top)/rect.height*140-10)/120))};}
  sync(){const s=this.settings,custom=s.curve==='custom',bell=['gaussian','sine','triangle'].includes(s.curve);this.rows.peak.hidden=!bell;this.rows.width.hidden=s.curve!=='gaussian';this.rows.power.hidden=!['in','out'].includes(s.curve);this.rows.restartWords.hidden=s.restart!=='word';this.rows.scopeIndex.hidden=s.scope==='text';this.rows.smooth.hidden=!custom;this.pointTools.hidden=this.rows.pointX.hidden=this.rows.pointY.hidden=!custom;
    this.rows.lineSampling.hidden=!lineDistribution(s);this.rows.sampleWidth.hidden=this.samplingActions.hidden=!fixedSampling(s);
    for(const[key,c]of Object.entries(this.controls)){if(key==='pointX'||key==='pointY'||this.pending.has(key)||this.rangeDrafts.has(key))continue;if(c.type==='checkbox')c.checked=s[key];else c.value=s[key];}
    const width=this.sliders.sampleWidth,widthValue=this.rangeDrafts.get('sampleWidth')??s.sampleWidth;width.min=Math.min(50,widthValue);width.max=Math.max(150,widthValue);width.value=widthValue;this.sampleCount(this.unitCount);
    this.draw();
  }
  draw(){const refocus=this.graph.contains(document.activeElement)&&document.activeElement!==this.graph;const s=this.settings;this.path.setAttribute('d',Array.from({length:97},(_,i)=>`${i?'L':'M'}${10+i*2.5},${130-curveAt(i/96,s)*120}`).join(' '));this.points.replaceChildren();
    if(s.curve==='custom')s.points.forEach((point,i)=>{const circle=svgElement('circle',{cx:10+point.x*240,cy:130-(s.invert?1-point.y:point.y)*120,r:i===this.selected?5:4,fill:'#fff',stroke:'#333','stroke-width':i===this.selected?2:1,tabindex:0,role:'button','aria-label':`Point ${i+1}`});circle.dataset.index=i;this.points.append(circle);});
    if(refocus)this.points.children[this.selected]?.focus({preventScroll:true});
    const point=s.points[this.selected]||s.points[0];if(!this.pending.has('pointX'))this.controls.pointX.value=Number(point.x.toFixed(3));if(!this.pending.has('pointY'))this.controls.pointY.value=Number(point.y.toFixed(3));
  }
  scopeCount(count){
    const max=Math.max(1,count);if(this.controls.scopeIndex.max!==String(max))this.controls.scopeIndex.max=max;
    if(this.settings.scope!=='text'&&this.settings.scopeIndex>max){this.settings.scopeIndex=max;this.controls.scopeIndex.value=max;this.onChange('scopeIndex');}
  }
  sampleCount(count){this.unitCount=Math.max(1,count);const s=this.settings,slider=this.sliders.patternOffset,value=this.rangeDrafts.get('patternOffset')??s.patternOffset;slider.min=-this.unitCount;slider.max=this.unitCount;slider.value=Math.abs(value)>this.unitCount?value%this.unitCount:value;
    this.offsetUnit.textContent=s.unit==='character'||s.unit==='letter'?'chars':s.unit==='word'?'words':s.unit==='line'?'lines':'units';
    this.resample.title=`Sample again at ${s.sampleWidth}% of the current text width.`;
  }
}
