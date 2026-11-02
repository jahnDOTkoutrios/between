import './ui/styles.css';
import { DEFAULT_A, DEFAULT_B, clamp, metricKey } from './engine/morph.js';
import { layoutKey } from './engine/properties.js';
import { envelope } from './engine/geometry.js';
import { MODES, defaultInteraction, timelineAmount } from './engine/interactions.js';
import { prepareModel, layoutModel } from './engine/measurements.js';
import { fitReferenceLayout } from './engine/reflow.js';
import { WidthControl } from './ui/width-control.js';
import { TextRenderer } from './ui/renderer.js';
import { PropertyEditor } from './ui/property-editor.js';
import { InteractionEditor } from './ui/interaction-editor.js';
import { DistributionEditor } from './ui/distribution-editor.js';
import { NoiseEditor } from './ui/noise-editor.js';
import { activeNoise } from './engine/noise.js';
import { defaultDistribution, characterUnits, buildStructureDistribution } from './engine/distribution.js';
import { runComparison } from './benchmark/runner.js';
import { PHRASE, PARAGRAPH } from './samples.js';
import { defaultSetup,normalizeSetup,cascadeSnapshot,restoreCascade,readSetup,writeSetup } from './engine/settings.js';
import { restoreLocalFonts } from './ui/local-fonts.js';

await restoreLocalFonts();
let settingsStorage;try{settingsStorage=localStorage;}catch{}
let stored=readSetup(settingsStorage);
if(!stored){let legacyDark=false;try{legacyDark=settingsStorage.getItem('between-theme')==='dark';}catch{}stored=defaultSetup(legacyDark);}
const initialSetup=normalizeSetup(stored);
let canSave=false,saveTimer=0;

const $=id=>document.getElementById(id),stage=$('stage'),specimen=stage.parentElement,renderer=new TextRenderer(stage);
let text=initialSetup.text,a={...DEFAULT_A},b={...DEFAULT_B},model=null,layout=null;
const OVERSIZE_MESSAGE='A word is wider than the frame. Reduce the size or widen the window.';
let liveReflow=initialSetup.liveReflow,currentStatus=null,stableOversized=false;
let amount=initialSetup.amount,playing=false,mode=initialSetup.mode,pointer=null,frame=0,generation=0,rebuilding=false;
let fontReady=false,lastGoodStyles=null;
let lastWidth=0,lastFrameWidth=null,widthFitPending=false,availableWidth=Math.max(1,specimen.clientWidth);
let stageRect=null,preparationTimer=0,benchmarkController=null,disposed=false,animationStart=0,animationPhase=0,lastPaint=0,touchScroll=null;
const distribution=initialSetup.distribution;
const profiles=new Map(Object.entries(initialSetup.profiles));
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
$('benchmark').disabled=true;
$('performance').hidden=!new URLSearchParams(location.search).has('test');
const propertyEditor=new PropertyEditor($('styles'),$('add-property'),$('property-menu'),stylesChanged,{baseButton:$('base-settings'),basePanel:$('base-panel')});
restoreCascade(propertyEditor.state,initialSetup.styles);
const widthControl=new WidthControl($('text-width'),$('text-width-value'),$('width-auto'),width=>{
  if(width===propertyEditor.state.frameWidth)return;
  stopPlayback();pointer=null;propertyEditor.state.frameWidth=width;applyFrameWidth();queueSave();
  widthFitPending=true;requestPaint();
});
let dark=initialSetup.dark;
function applyTheme(value){
  dark=value;document.documentElement.dataset.theme=dark?'dark':'light';
  $('theme-toggle').setAttribute('aria-pressed',String(dark));
  document.querySelector('meta[name="theme-color"]').content=dark?'#171717':'#ffffff';
  const next=propertyEditor.setTheme(dark);if(next)({a,b}=next);requestPaint();queueSave();
}
// Restored colors are exact; do not reinterpret them as a theme transition.
propertyEditor.dark=dark;propertyEditor.render();propertyEditor.baseEditor.render();({a,b}=propertyEditor.read());
document.documentElement.dataset.theme=dark?'dark':'light';$('theme-toggle').setAttribute('aria-pressed',String(dark));document.querySelector('meta[name="theme-color"]').content=dark?'#171717':'#ffffff';
$('theme-toggle').addEventListener('click',()=>applyTheme(!dark));

const interactionEditor=new InteractionEditor($('interaction-settings'),$('interaction-panel'),(key,value)=>{
  profiles.get(mode)[key]=value;queueSave();
  if(playing&&(key==='speed'||key==='playback'))alignPlayback();
  requestPaint();
});
interactionEditor.render(mode,profiles.get(mode));
let noiseEditor=null;
function distributionChanged(key){
  queueSave();
  noiseEditor?.sync(mode);
  if(key==='scope'&&layout)distributionEditor.scopeCount(buildStructureDistribution(layout,distribution).scopeCount);
  const editsCurve=['curve','points','peak','width','power','steps','invert','smooth'].includes(key)||key==='noise'&&!!(activeNoise(distribution.noise,'values')||distribution.restart==='word'&&activeNoise(distribution.noise,'restartWords'));
  if((editsCurve||mode==='scrub'&&['unit','restart','restartWords'].includes(key))&&mode!=='curve')setMode('curve');
  else if(editsCurve)stopPlayback();
  if(model&&model.characters!==characterUnits(distribution)){
    generation++;clearTimeout(preparationTimer);preparationTimer=setTimeout(rebuild,220);
  }else requestPaint();
}
const distributionEditor=new DistributionEditor($('distribution-settings'),$('distribution-panel'),distribution,distributionChanged);
noiseEditor=new NoiseEditor($('noise-settings'),$('noise-panel'),distribution,()=>distributionChanged('noise'));

function currentSetup(){return normalizeSetup({version:1,styles:cascadeSnapshot(propertyEditor.state),text,distribution,profiles:Object.fromEntries(profiles),mode,amount,liveReflow,dark});}
function queueSave(){if(!canSave)return;clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,250);}
function saveNow(){
  clearTimeout(saveTimer);saveTimer=0;if(!canSave)return;
  if(!writeSetup(settingsStorage,currentSetup()))status('Browser storage is unavailable. Settings cannot survive refresh.');
}
function syncSample(){for(const key of ['phrase','paragraph']){const selected=text===(key==='phrase'?PHRASE:PARAGRAPH);$(key).classList.toggle('active',selected);$(key).setAttribute('aria-pressed',String(selected));}}
function restoreDefaults(){
  canSave=false;clearTimeout(saveTimer);clearTimeout(preparationTimer);generation++;stopPlayback();
  const defaults=defaultSetup();text=defaults.text;profiles.clear();for(const[key,value]of Object.entries(defaults.profiles))profiles.set(key,value);
  distributionEditor.restore(defaults.distribution);noiseEditor.restore();restoreCascade(propertyEditor.state,defaults.styles);applyTheme(false);applyFrameWidth();
  liveReflow=false;$('live-reflow').checked=false;pointer=null;touchScroll=null;stage.scrollLeft=0;
  $('editor').hidden=true;$('edit').setAttribute('aria-expanded','false');syncSample();
  for(const panel of document.querySelectorAll(':popover-open'))panel.hidePopover();
  setMode('scrub');amount=0;updateAmount();status('');canSave=true;saveNow();rebuild();
}
// Restore controls without starting playback or resetting the saved slider.
const restoredAmount=amount;setMode(mode);amount=restoredAmount;updateAmount();syncSample();$('live-reflow').checked=liveReflow;applyFrameWidth();canSave=true;

function applyFrameWidth(){
  const width=propertyEditor.state.frameWidth;widthControl.sync(width,availableWidth);
  if(width===lastFrameWidth)return false;
  stage.style.width=width>0?`${width}px`:'100%';lastFrameWidth=width;return true;
}
function stageWidth(){return Math.max(1,stage.clientWidth);}
function cacheRect(){stageRect=stage.getBoundingClientRect();}
function status(message){if(message===currentStatus)return;currentStatus=message;$('status').textContent=message;$('status').hidden=!message;}
function updateAmount(value=amount){$('morph').value=String(value*100);$('amount').textContent=`${Math.round(value*100)}%`;}
function requestPaint(){if(!frame&&!disposed)frame=requestAnimationFrame(paint);}
function paint(now){
  frame=0;
  if(benchmarkController||!model||rebuilding||document.hidden)return;
  if(widthFitPending){widthFitPending=false;mount();distributionEditor.scopeCount(renderer.structure?.scopeCount??1);return;}
  const settings=profiles.get(mode),deltaMs=Math.min(64,lastPaint?now-lastPaint:16);lastPaint=now;
  if(playing){amount=timelineAmount(now-animationStart,settings,animationPhase);updateAmount();}
  renderer.render(amount,{mode,pointer,a,b,settings,distribution,liveReflow,deltaMs,alignment:propertyEditor.state.alignment});
  layout=renderer.layout;
  if(!currentStatus||currentStatus===OVERSIZE_MESSAGE)status((liveReflow?layout.oversized:stableOversized)?OVERSIZE_MESSAGE:'');
  distributionEditor.scopeCount(renderer.structure?.scopeCount??1);
  if(mode==='pointer'||mode==='press')updateAmount(Math.max(0,...renderer.positions.map(position=>position.amount)));
  if(playing||renderer.needsAnimation)requestPaint();
}
function stopPlayback(){playing=false;$('play').textContent='Play';$('play').setAttribute('aria-pressed','false');}
function alignPlayback(){
  const settings=profiles.get(mode),fraction=settings.playback==='loop'?amount:Math.acos(1-2*amount)/(Math.PI*2);
  animationPhase=fraction;animationStart=performance.now();
}
function syncControls(){
  const automatic=mode==='pointer'||mode==='press';
  $('morph').disabled=automatic;$('play').disabled=!['scrub','curve','wipe','wave'].includes(mode);
  $('morph-start').textContent=mode==='wave'?'0':'A';$('morph-end').textContent=mode==='wave'?'1':'B';
  stage.classList.toggle('pointer-mode',mode==='pointer');stage.classList.toggle('gesture-mode',mode==='press'||mode==='scroll');
}
function setMode(value){
  stopPlayback();mode=value;$('interaction').value=value;pointer=null;touchScroll=null;
  noiseEditor?.sync(mode);
  if(mode==='press'||mode==='pointer')amount=0;
  if(mode==='wave')amount=.5;
  if(mode==='curve')amount=1;
  const hints={curve:'The curve is distributed across the chosen units. The slider controls its strength.',scrub:'Drag the slider or press Play.',pointer:'Move across the text, or focus it and use arrow keys.',wipe:'Use the slider or Play to reveal words in reading order.',wave:'Move the slider or press Play for a traveling wave.',scroll:'Scroll over the text or use the slider. Escape returns to Scrub.',press:'Hold the text or hold Space while it is focused. Release to return.'};
  queueSave();$('hint').textContent=hints[mode];interactionEditor.render(mode,profiles.get(mode));syncControls();updateAmount();requestPaint();
}
function mount(nextModel=model){
  widthFitPending=false;
  const reference=layoutModel(nextModel,stageWidth(),a,b,propertyEditor.state.alignment);
  const nextLayout=fitReferenceLayout(nextModel,reference,amount,{a,b,mode,pointer,settings:profiles.get(mode),distribution,alignment:propertyEditor.state.alignment});lastWidth=nextLayout.width;
  stableOversized=nextLayout.oversized;
  $('benchmark').disabled=false;model=nextModel;layout=nextLayout;lastGoodStyles={a:{...a},b:{...b}};renderer.mount(model,layout);cacheRect();
  renderer.render(amount,{mode,pointer,a,b,settings:{...profiles.get(mode),response:0},distribution,liveReflow,alignment:propertyEditor.state.alignment});
  layout=renderer.layout;
  const oversized=liveReflow?renderer.reflowState.oversized:stableOversized;
  status(oversized?OVERSIZE_MESSAGE:'');
}
async function rebuild(){
  if(!fontReady)return;
  const latest=propertyEditor.read();if(latest){a=latest.a;b=latest.b;}
  const token=++generation,sourceText=text,sourceA={...a},sourceB={...b},characters=characterUnits(distribution);
  rebuilding=true;stage.classList.add('is-preparing');status('Preparing type…');
  try{
    const prepared=await prepareModel(sourceText,sourceA,sourceB,progress=>{if(token===generation)status(`Preparing type… ${Math.round(progress*100)}%`);},{characters});
    if(token!==generation||disposed)return;
    mount(prepared);rebuilding=false;requestPaint();
  }catch(error){if(token===generation){rebuilding=false;if(lastGoodStyles){a=lastGoodStyles.a;b=lastGoodStyles.b;}stopPlayback();status(`Could not prepare text: ${error.message}`);requestPaint();}}
  finally{if(token===generation)stage.classList.remove('is-preparing');}
}
function stylesChanged(next,options={}){
  if(next)queueSave();
  if(!next){clearTimeout(preparationTimer);generation++;rebuilding=false;stage.classList.remove('is-preparing');status('Enter a finite number valid for this property.');return;}
  if(options.deferPreview){generation++;clearTimeout(preparationTimer);preparationTimer=setTimeout(()=>stylesChanged(next,{commit:true}),220);return;}
  clearTimeout(preparationTimer);preparationTimer=0;
  try{envelope(1,Math.max(next.a.size,next.b.size),next.a,next.b);}catch(error){rebuilding=false;stage.classList.remove('is-preparing');if(lastGoodStyles){a=lastGoodStyles.a;b=lastGoodStyles.b;}status(error.message);requestPaint();return;}
  const previousA=a,previousB=b;
  const widthChanged=applyFrameWidth();
  const geometryChanged=widthChanged||layoutKey(a,b)!==layoutKey(next.a,next.b)||renderer.referenceLayout?.alignment!==propertyEditor.state.alignment;a=next.a;b=next.b;
  if(!model||model.characters!==characterUnits(distribution)||metricKey(model.a,model.b)!==metricKey(a,b)||rebuilding){
    generation++;clearTimeout(preparationTimer);if(options.commit)rebuild();else preparationTimer=setTimeout(rebuild,220);
  }else{try{if(geometryChanged)mount();else{lastGoodStyles={a:{...a},b:{...b}};status('');}requestPaint();}catch(error){a=previousA;b=previousB;status(error.message);}}
}
function selectSample(value,name){
  if(benchmarkController)return;
  stopPlayback();generation++;text=value;
  for(const key of ['phrase','paragraph']){$(key).classList.toggle('active',key===name);$(key).setAttribute('aria-pressed',String(key===name));}
  $('editor').hidden=true;$('edit').setAttribute('aria-expanded','false');pointer=null;queueSave();
  clearTimeout(preparationTimer);rebuild();
}
$('reset').addEventListener('click',restoreDefaults);
$('live-reflow').addEventListener('change',event=>{liveReflow=event.target.checked;pointer=null;requestPaint();queueSave();});
$('morph').addEventListener('input',event=>{stopPlayback();amount=clamp(Number(event.target.value)/100);updateAmount();requestPaint();queueSave();});
$('interaction').addEventListener('change',event=>setMode(event.target.value));
$('play').addEventListener('click',()=>{
  if(playing)stopPlayback();
  else{playing=true;alignPlayback();$('play').textContent='Pause';$('play').setAttribute('aria-pressed','true');requestPaint();}
  queueSave();
});
$('phrase').addEventListener('click',()=>selectSample(PHRASE,'phrase'));
$('paragraph').addEventListener('click',()=>selectSample(PARAGRAPH,'paragraph'));
$('edit').addEventListener('click',()=>{
  stopPlayback();const opened=$('editor').hidden;$('editor').hidden=!opened;$('edit').setAttribute('aria-expanded',String(opened));
  if(opened){$('text-input').value=text;$('text-input').focus();}
});
$('cancel-edit').addEventListener('click',()=>{$('editor').hidden=true;$('edit').setAttribute('aria-expanded','false');});
$('use-text').addEventListener('click',()=>selectSample($('text-input').value,'custom'));
function eventPoint(event){if(!stageRect)cacheRect();return{x:event.clientX-stageRect.left+stage.scrollLeft,y:event.clientY-stageRect.top};}
stage.addEventListener('pointerenter',cacheRect);
stage.addEventListener('selectstart',stopPlayback);
// Select the document text, never chrome or anonymous text inside controls.
document.addEventListener('keydown',event=>{
  if(!(event.metaKey||event.ctrlKey)||event.altKey||event.key.toLowerCase()!=='a')return;
  if(event.target.closest('input,textarea,select,[contenteditable=true]'))return;
  event.preventDefault();stopPlayback();
  const selection=window.getSelection();selection.removeAllRanges();
  const first=stage.firstElementChild?.querySelector('.word-ink')?.firstChild,last=stage.lastElementChild?.querySelector('.word-ink')?.firstChild;
  if(!first||!last)return;
  const range=document.createRange();range.setStart(first,0);range.setEnd(last,last.length);selection.addRange(range);
});
stage.addEventListener('pointerdown',event=>{
  if(benchmarkController)return;
  if(mode==='pointer'){pointer=eventPoint(event);requestPaint();}
  if(mode==='press'||mode==='scroll'){
    stage.focus({preventScroll:true});stage.setPointerCapture(event.pointerId);
    if(mode==='press'){amount=1;requestPaint();}
    else touchScroll={y:event.clientY,amount};
  }
});
stage.addEventListener('pointermove',event=>{
  if(benchmarkController)return;
  if(mode==='pointer'){pointer=eventPoint(event);requestPaint();}
  else if(mode==='scroll'&&touchScroll){amount=clamp(touchScroll.amount+(touchScroll.y-event.clientY)/profiles.get(mode).sensitivity);updateAmount();requestPaint();}
});
stage.addEventListener('pointerleave',()=>{if(mode==='pointer'){pointer=null;requestPaint();}});
function release(event){
  if(mode==='press'){amount=0;requestPaint();}
  if(mode==='pointer'&&event.pointerType==='touch'){pointer=null;requestPaint();}
  touchScroll=null;queueSave();
}
window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);
stage.addEventListener('wheel',event=>{if(mode!=='scroll'||benchmarkController)return;event.preventDefault();const scale=event.deltaMode===1?16:event.deltaMode===2?stage.clientHeight:1;amount=clamp(amount+event.deltaY*scale/profiles.get(mode).sensitivity);updateAmount();requestPaint();queueSave();},{passive:false});
stage.addEventListener('keydown',event=>{
  if(!layout||benchmarkController)return;
  if(event.key==='Escape'){setMode('scrub');return;}
  if(mode==='press'&&event.code==='Space'){event.preventDefault();amount=1;requestPaint();return;}
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();
  if(mode==='pointer'){
    pointer||={x:layout.width/2,y:layout.lineHeight/2};
    pointer.x=clamp(pointer.x+(event.key==='ArrowRight'?35:event.key==='ArrowLeft'?-35:0),0,layout.width);
    pointer.y=clamp(pointer.y+(event.key==='ArrowDown'?35:event.key==='ArrowUp'?-35:0),0,layout.height);
  }else if(mode!=='press'){stopPlayback();amount=clamp(amount+(['ArrowRight','ArrowUp'].includes(event.key)?.05:-.05));updateAmount();}
  requestPaint();queueSave();
});
window.addEventListener('keyup',event=>{if(mode==='press'&&event.code==='Space'){amount=0;requestPaint();}});
stage.addEventListener('blur',()=>{if(mode==='press'){amount=0;requestPaint();}});
window.addEventListener('blur',()=>{stopPlayback();release({});pointer=null;requestPaint();});
window.addEventListener('scroll',cacheRect,{passive:true});
const resizeObserver=new ResizeObserver(()=>{
  availableWidth=Math.max(1,specimen.clientWidth);widthControl.sync(propertyEditor.state.frameWidth,availableWidth);
  const width=stageWidth();if(Math.abs(width-lastWidth)<.5)return;cacheRect();
  if(benchmarkController){benchmarkController.abort();return;}
  if(model&&!rebuilding){widthFitPending=true;requestPaint();}
});
resizeObserver.observe(stage);resizeObserver.observe(specimen);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPlayback();release({});pointer=null;distributionEditor.flushNumbers();saveNow();benchmarkController?.abort();}else requestPaint();});
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)stopPlayback();});

function lockControls(lock){
  for(const control of document.querySelectorAll('input,select,button,textarea'))if(control.id!=='benchmark')control.disabled=lock;
  if(!lock){syncControls();propertyEditor.syncInherited();}
}
function showReport(report){
  const table=document.createElement('table');table.innerHTML='<thead><tr><th>Sample / method</th><th>fps</th><th>Update p95</th><th>Slow frames</th></tr></thead>';
  const body=document.createElement('tbody');
  for(const row of report.cases){const tr=document.createElement('tr');for(const value of [`${row.sample} / ${row.method}`,row.fps.toFixed(1),`${row.updateP95Ms.toFixed(2)} ms`,`${row.slowFrames} / ${row.frames}`]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}
  table.append(body);$('benchmark-results').replaceChildren(table);
  const note=document.createElement('p');note.textContent=`${report.validation.filter(item=>item.pass).length}/${report.validation.length} geometry and endpoint checks pass. Idle cadence: ${report.baselineFps.toFixed(1)} fps. Reprepare uses Pretext’s warm cache.`;$('benchmark-results').append(note);
}
$('benchmark').addEventListener('click',async()=>{
  if(benchmarkController){benchmarkController.abort();return;}
  if(!model||rebuilding||preparationTimer&&metricKey(model.a,model.b)!==metricKey(a,b)){$('benchmark-status').textContent='Wait for type preparation to finish.';return;}
  clearTimeout(preparationTimer);stopPlayback();generation++;
  for(const panel of document.querySelectorAll(':popover-open'))panel.hidePopover();
  benchmarkController=new AbortController();document.body.classList.add('benchmarking');lockControls(true);$('benchmark').textContent='Stop test';$('benchmark-results').replaceChildren();
  try{
    const report=await runComparison(renderer,stageWidth(),message=>{$('benchmark-status').textContent=message;},benchmarkController.signal);
    showReport(report);$('benchmark-status').textContent='Comparison complete.';
    if(import.meta.env.DEV)try{const response=await fetch('/__test-results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});if(!response.ok)throw new Error();}catch{/* Production has no local report writer. */}
  }catch(error){$('benchmark-status').textContent=error.name==='AbortError'?'Test stopped. Keep the tab visible and avoid resizing during a run.':error.message;}
  finally{benchmarkController=null;document.body.classList.remove('benchmarking');lockControls(false);$('benchmark').textContent='Run comparison';mount();requestPaint();$('performance').scrollIntoView({block:'center',behavior:'instant'});}
});
window.addEventListener('pageshow',event=>{if(event.persisted){disposed=false;resizeObserver.observe(stage);resizeObserver.observe(specimen);requestPaint();}});
window.addEventListener('pagehide',()=>{disposed=true;distributionEditor.flushNumbers();noiseEditor.flush();noiseEditor.discardInput();saveNow();clearTimeout(preparationTimer);cancelAnimationFrame(frame);frame=0;resizeObserver.disconnect();benchmarkController?.abort();});
try{
  await document.fonts.load('400 30px "Manrope Morph"');await document.fonts.ready;
  if(!document.fonts.check('400 30px "Manrope Morph"'))throw new Error('The bundled font did not load.');
  fontReady=true;await rebuild();
}catch(error){status(error.message);}
