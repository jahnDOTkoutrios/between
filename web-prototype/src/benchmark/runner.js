import { DEFAULT_A, DEFAULT_B, STATE_COUNT } from '../engine/morph.js';
import { prepareModel, layoutModel } from '../engine/measurements.js';
import { defaultInteraction } from '../engine/interactions.js';
import { defaultDistribution } from '../engine/distribution.js';
import { PHRASE, PARAGRAPH } from '../samples.js';

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const percentile = (list, p) => [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor((list.length - 1) * p))] || 0;
export function summarizeFrames(intervals, work, baselineMs) {
  const total = intervals.reduce((a, b) => a + b, 0);
  return {
    frames: intervals.length,
    fps: total ? intervals.length * 1000 / total : 0,
    frameIntervalP95Ms: percentile(intervals, .95),
    updateMedianMs: percentile(work, .5),
    updateP95Ms: percentile(work, .95),
    updateMaxMs: Math.max(0, ...work),
    slowFrames: intervals.filter(ms => ms > baselineMs * 1.5).length,
    estimatedMissedFrames: intervals.reduce((n, ms) => n + Math.max(0, Math.round(ms / baselineMs) - 1), 0),
  };
}

function visible(signal) {
  if (signal.aborted) throw new DOMException('Test stopped', 'AbortError');
  if (document.hidden) throw new Error('The tab was hidden. Keep it visible and run the comparison again.');
}

async function runCase(renderer, model, layout, { pointer, fresh, durationMs, signal, baselineMs, mode = null, settings = null, distribution = null, liveReflow = false }) {
  renderer.mount(model, layout);
  renderer.stage.scrollIntoView({ block: 'start', behavior: 'instant' });
  let last = await nextFrame(), started = last;
  const intervals = [], work = [];
  while (true) {
    visible(signal);
    const now = await nextFrame(), elapsed = now - started;
    const t = (1 - Math.cos(elapsed / 1100 * Math.PI)) / 2;
    const from = performance.now();
    renderer.render(t, { fresh, distribution, liveReflow, mode: mode || (pointer ? 'pointer' : 'scrub'), settings, pointer: pointer ? { x: (Math.sin(elapsed / 800) + 1) * layout.width / 2, y: (Math.sin(elapsed / 1400) + 1) * layout.height / 2 } : null });
    const end = performance.now();
    // Warm each runner for 300 ms before collecting RAF delivery and JS timings.
    if (elapsed > 300) { intervals.push(now - last); work.push(end - from); }
    last = now;
    if (elapsed >= durationMs + 300) break;
  }
  return summarizeFrames(intervals, work, baselineMs);
}

function verifyRendering(renderer, model, layout) {
  const results = [];
  const check = (name, pass, detail = null) => results.push({ name, pass, detail });
  let worstWidthError = 0, worstOverflow = 0, minGap = Infinity;
  for (const t of [0, .125, .5, .875, 1]) {
    renderer.render(t);
    const inspect = renderer.inspect(); worstOverflow = Math.max(worstOverflow, inspect.maxOverflow);
    if (inspect.minGap !== null) minGap = Math.min(minGap, inspect.minGap);
    for (let i = 0; i < renderer.nodes.length; i++) {
      // Validation is intentionally outside the animation hot path.
      const actual = renderer.nodes[i].ink.getBoundingClientRect().width;
      worstWidthError = Math.max(worstWidthError, Math.abs(actual - renderer.positions[i].inkWidth));
    }
  }
  check('Pretext word widths match rendered DOM', worstWidthError < 1, { maxErrorPx: worstWidthError });
  check('All sampled sizes fit their fixed lines', worstOverflow < 1, { maxOverflowPx: worstOverflow });
  check('Words do not overlap', minGap >= 0, { minimumGapPx: minGap });
  renderer.render(0); let computed = getComputedStyle(renderer.nodes[0].ink);
  check('A endpoint has exact size, weight, tracking and color', Math.abs(parseFloat(computed.fontSize) - DEFAULT_A.size) < .01 && Math.abs(parseFloat(computed.fontWeight) - DEFAULT_A.weight) < .01 && Math.abs(parseFloat(computed.letterSpacing) - DEFAULT_A.tracking) < .01 && computed.color.replace(/\s/g,'')==='rgb(37,37,37)');
  renderer.render(1); computed = getComputedStyle(renderer.nodes[0].ink);
  check('B endpoint has exact size, weight, tracking and color', Math.abs(parseFloat(computed.fontSize) - DEFAULT_B.size) < .01 && Math.abs(parseFloat(computed.fontWeight) - DEFAULT_B.weight) < .01 && Math.abs(parseFloat(computed.letterSpacing) - DEFAULT_B.tracking) < .01 && computed.color.replace(/\s/g,'')==='rgb(162,162,155)');
  const lineSignature = JSON.stringify(layout.lines.map(line => line.map(entry => entry.index)));
  renderer.render(.5, { mode: 'pointer', pointer: { x: 0, y: 0 } });
  check('Pointer changes words independently', new Set(renderer.positions.map(pos => pos.state)).size > 1);
  check('Morphing preserves line membership', JSON.stringify(renderer.layout.lines.map(line => line.map(entry => entry.index))) === lineSignature);
  return results;
}

function verifyEffects(renderer,model,layout) {
  const results=[],check=(name,pass,detail=null)=>results.push({sample:'Paragraph + effects',name,pass,detail});
  renderer.mount(model,layout);let overflow=0,widthError=0;
  for(const t of [0,.25,.5,.75,1]){
    renderer.render(t);const stage=renderer.stage.getBoundingClientRect();
    for(let i=0;i<renderer.nodes.length;i++){
      const rect=renderer.nodes[i].ink.getBoundingClientRect();
      overflow=Math.max(overflow,stage.left-rect.left,rect.right-stage.right,stage.top-rect.top,rect.bottom-stage.bottom);
      widthError=Math.max(widthError,Math.abs(rect.width-renderer.positions[i].inkWidth));
    }
  }
  check('Combined transforms fit reserved frame bounds',overflow<1,{maxOverflowPx:overflow});
  check('Transformed width math matches actual DOM bounds',widthError<1,{maxErrorPx:widthError});
  const computed=getComputedStyle(renderer.nodes[0].ink);
  check('Opacity and outline reach the added endpoint',Math.abs(Number(computed.opacity)-.35)<.001&&Math.abs(parseFloat(computed.getPropertyValue('-webkit-text-stroke-width'))-.8)<.001);
  renderer.render(.5,{mode:'wave',settings:{...defaultInteraction('wave'),response:0}});
  check('Wave distributes independent word amounts',new Set(renderer.positions.map(pos=>pos.state)).size>1);
  renderer.render(.5,{mode:'wipe',settings:{...defaultInteraction('wipe'),unit:'line',response:0}});
  let consistent=true;for(const line of layout.lines){if(new Set(line.map(entry=>renderer.positions[entry.index].state)).size>1)consistent=false;}
  check('Line wipe gives each line one shared amount',consistent);
  return results;
}

function verifyLive(renderer,model,width,characters=false){
  const results=[],check=(name,pass,detail=null)=>results.push({sample:characters?'Live characters':'Live words',name,pass,detail}),reference=layoutModel(model,width),stableSignature=JSON.stringify(reference.lines.map(line=>line.map(entry=>entry.wordIndex)));
  renderer.mount(model,reference);renderer.render(0,{liveReflow:true});const first=renderer.layout.lines.length,nodes=renderer.nodes.map(item=>item.node);let widthError=0,overflow=0,minGap=Infinity;
  for(const t of [0,.25,.5,.75,1]){
    renderer.render(t,{liveReflow:true});const bounds=renderer.stage.getBoundingClientRect(),inspect=renderer.inspect();minGap=Math.min(minGap,inspect.minGap??Infinity);
    for(let i=0;i<renderer.nodes.length;i++){if(renderer.positions[i].hidden)continue;const rect=renderer.nodes[i].ink.getBoundingClientRect();widthError=Math.max(widthError,Math.abs(rect.width-renderer.positions[i].inkWidth));overflow=Math.max(overflow,bounds.left-rect.left,rect.right-bounds.right,bounds.top-rect.top,rect.bottom-bounds.bottom);}
  }
  check('Current styles change the fitted line count',renderer.layout.lines.length>first,{atA:first,atB:renderer.layout.lines.length});
  check('Live widths match DOM without overlap or frame clipping',widthError<1&&overflow<1&&minGap>=-.001,{maxWidthErrorPx:widthError,maxOverflowPx:overflow,minGapPx:minGap});
  check('Animation reuses the exact existing text nodes',renderer.nodes.length===nodes.length&&renderer.nodes.every((item,i)=>item.node===nodes[i]));
  const distribution={...defaultDistribution(),unit:characters?'letter':'word',restart:'line',curve:'gaussian'};let bounded=true,fitted=true,stabilized=0;
  for(const amount of [.25,.5,.75,1]){renderer.render(amount,{mode:'curve',distribution,liveReflow:true});bounded&&=renderer.reflowState.passes<=6;fitted&&=renderer.inspect().maxOverflow<1;if(renderer.reflowState.stabilized)stabilized++;}
  check('Line restart curves settle or retain fitted sampled assignments in bounded passes',bounded&&fitted,{sampledFallbackFrames:stabilized});
  renderer.render(.5,{liveReflow:false});check('Disabling live reflow restores the original stable lines',JSON.stringify(renderer.layout.lines.map(line=>line.map(entry=>entry.wordIndex)))===stableSignature);
  return results;
}

export async function runComparison(renderer, availableWidth, onProgress, signal) {
  const baselineIntervals = []; let last = await nextFrame();
  for (let i = 0; i < 40; i++) { visible(signal); const now = await nextFrame(); baselineIntervals.push(now - last); last = now; }
  const baselineMs = percentile(baselineIntervals, .5), cases = [], validation = [], preparation = [];
  for (const [label, text] of [['Phrase', PHRASE], ['Paragraph', PARAGRAPH]]) {
    onProgress(`Preparing ${label.toLowerCase()}…`);
    const model = await prepareModel(text, DEFAULT_A, DEFAULT_B), layout = layoutModel(model, availableWidth);
    preparation.push({ sample: label, words: model.words.length, ...model.preparation });
    renderer.mount(model, layout);
    validation.push(...verifyRendering(renderer, model, layout).map(result => ({ sample: label, ...result })));
    for (const [method, pointer, fresh] of [['Cached', false, false], ['Reprepare', false, true], ['Pointer · cached', true, false]]) {
      onProgress(`${label} / ${method}…`);
      const metrics = await runCase(renderer, model, layout, { pointer, fresh, durationMs: 2100, signal, baselineMs });
      cases.push({ sample: label, words: model.words.length, method, ...metrics });
    }
  }
  onProgress('Preparing combined effects…');
  const effectsA={...DEFAULT_A,opacity:100,baseline:0,rotation:0,skew:0,scaleX:100,scaleY:100,outlineWidth:0,outlineColor:'#252525'};
  const effectsB={...DEFAULT_B,opacity:35,baseline:-18,rotation:8,skew:-8,scaleX:110,scaleY:110,outlineWidth:.8,outlineColor:'#252525'};
  const effectsModel=await prepareModel(PARAGRAPH,effectsA,effectsB),effectsLayout=layoutModel(effectsModel,availableWidth);
  preparation.push({sample:'Paragraph + effects',words:effectsModel.words.length,...effectsModel.preparation});
  validation.push(...verifyEffects(renderer,effectsModel,effectsLayout));
  for(const [method,mode,settings]of [
    ['Wave + effects','wave',defaultInteraction('wave')],
    ['Line wipe + effects','wipe',{...defaultInteraction('wipe'),unit:'line'}],
    ['Press response + effects','press',defaultInteraction('press')],
  ]){
    onProgress(`Paragraph / ${method}…`);
    const metrics=await runCase(renderer,effectsModel,effectsLayout,{pointer:false,fresh:false,durationMs:2100,signal,baselineMs,mode,settings});
    cases.push({sample:'Paragraph',words:effectsModel.words.length,method,...metrics});
  }
  onProgress('Preparing character distribution…');
  const characterModel=await prepareModel(PARAGRAPH,DEFAULT_A,DEFAULT_B,()=>{},{characters:true}),characterLayout=layoutModel(characterModel,availableWidth);
  const characterDistribution={...defaultDistribution(),unit:'letter',restart:'word',curve:'gaussian'};
  renderer.mount(characterModel,characterLayout);renderer.render(1,{mode:'curve',distribution:characterDistribution,settings:{...defaultInteraction('curve'),response:0}});
  let charError=0;for(let i=0;i<renderer.nodes.length;i++)charError=Math.max(charError,Math.abs(renderer.nodes[i].ink.getBoundingClientRect().width-renderer.positions[i].inkWidth));
  const check=(name,pass,detail=null)=>validation.push({sample:'Character distribution',name,pass,detail});
  check('Grapheme widths match actual DOM bounds',charError<1,{maxErrorPx:charError});
  check('Character curves fit fixed lines without overlap',renderer.inspect().maxOverflow<1&&renderer.inspect().minGap>=-0.001,renderer.inspect());
  check('Each word restarts at A and longer odd words reach B',characterLayout.lines.every(line=>[...new Set(line.filter(e=>!e.isSpace).map(e=>e.wordIndex))].every(word=>{const entries=line.filter(e=>e.wordIndex===word&&!e.isSpace);return renderer.positions[entries[0].index].state===0&&renderer.positions[entries.at(-1).index].state===0;}))&&renderer.positions.some(p=>p.state===64));
  const scopeDistribution={...defaultDistribution(),unit:'letter',scope:'sentence',scopeIndex:2};renderer.render(1,{mode:'curve',distribution:scopeDistribution,settings:{...defaultInteraction('curve'),response:0}});
  check('Scope leaves outside text at A while the target reaches B',characterLayout.entries.every(e=>renderer.structure.entries[e.index]||renderer.positions[e.index].state===0)&&renderer.positions.some(p=>p.state===64));
  preparation.push({sample:'Paragraph characters',words:characterModel.words.length,renderedUnits:characterLayout.entries.length,...characterModel.preparation});
  for(const [method,caseMode]of [['Letter curves','curve'],['Letter wave','wave']]){
    onProgress(`Paragraph / ${method}…`);const metrics=await runCase(renderer,characterModel,characterLayout,{pointer:false,fresh:false,durationMs:2100,signal,baselineMs,mode:caseMode,distribution:characterDistribution});
    cases.push({sample:'Paragraph',words:characterModel.words.length,renderedUnits:characterLayout.entries.length,method,...metrics});
  }
  onProgress('Checking shared typography and endpoint overrides…');
  const typographyA={...DEFAULT_A,fontFamily:'serif',lineHeight:40},typographyB={...DEFAULT_B,fontFamily:'mono',lineHeight:120};
  const typographyModel=await prepareModel(PHRASE,typographyA,typographyB),typographyLayout=layoutModel(typographyModel,availableWidth);renderer.mount(typographyModel,typographyLayout);
  const typographyCheck=(name,pass,detail=null)=>validation.push({sample:'Base typography',name,pass,detail});let typographyError=0;
  for(const t of [0,.4999,.5,1]){renderer.render(t);for(let i=0;i<renderer.nodes.length;i++)typographyError=Math.max(typographyError,Math.abs(renderer.nodes[i].ink.getBoundingClientRect().width-renderer.positions[i].inkWidth));}
  typographyCheck('Mixed serif/mono measurements match DOM across the font switch',typographyError<1,{maxErrorPx:typographyError});
  renderer.render(.4999);const before=getComputedStyle(renderer.nodes[0].ink).fontFamily;renderer.render(.5);const after=getComputedStyle(renderer.nodes[0].ink).fontFamily;
  typographyCheck('Font family switches at exactly half without changing before it',before.includes('Georgia')&&after.includes('Courier'));
  let leadingMatches=typographyLayout.lines.length>1;
  for(const[t,expected]of [[0,40],[.5,80],[1,120]]){renderer.render(t);if(typographyLayout.lines.length>1){const first=typographyLayout.lines[0][0].index,second=typographyLayout.lines[1][0].index;const gap=renderer.nodes[second].ink.getBoundingClientRect().top-renderer.nodes[first].ink.getBoundingClientRect().top;if(Math.abs(gap-expected)>.01)leadingMatches=false;}}
  typographyCheck('Actual baseline rows follow shared/overridden leading and interpolate',leadingMatches);
  const sansA={...DEFAULT_A,fontFamily:'sans',lineHeight:60},sansB={...DEFAULT_B,fontFamily:'sans',lineHeight:60},sansModel=await prepareModel(PHRASE,sansA,sansB),sansLayout=layoutModel(sansModel,availableWidth);renderer.mount(sansModel,sansLayout);let sansError=0;
  for(const t of [0,.5,1]){renderer.render(t);for(let i=0;i<renderer.nodes.length;i++)sansError=Math.max(sansError,Math.abs(renderer.nodes[i].ink.getBoundingClientRect().width-renderer.positions[i].inkWidth));}
  typographyCheck('Shared system-sans measurements match DOM at A/B and midpoint',sansError<1,{maxErrorPx:sansError});
  onProgress('Phrase / Font and leading overrides…');const typographyMetrics=await runCase(renderer,typographyModel,typographyLayout,{pointer:false,fresh:false,durationMs:2100,signal,baselineMs});
  cases.push({sample:'Phrase',words:typographyModel.words.length,method:'Font and leading overrides',...typographyMetrics});
  onProgress('Checking live reflow…');
  const liveModel=await prepareModel(PARAGRAPH,DEFAULT_A,DEFAULT_B),liveLayout=layoutModel(liveModel,availableWidth);
  validation.push(...verifyLive(renderer,liveModel,availableWidth));validation.push(...verifyLive(renderer,characterModel,availableWidth,true));
  for(const [method,caseMode,caseModel,caseLayout,distribution]of [
    ['Live reflow','scrub',liveModel,liveLayout,defaultDistribution()],
    ['Live line curves','curve',liveModel,liveLayout,{...defaultDistribution(),restart:'line',curve:'gaussian'}],
    ['Live letter wave','wave',characterModel,characterLayout,{...defaultDistribution(),unit:'letter'}],
  ]){
    onProgress(`Paragraph / ${method}…`);const metrics=await runCase(renderer,caseModel,caseLayout,{pointer:false,fresh:false,durationMs:2100,signal,baselineMs,mode:caseMode,distribution,liveReflow:true});
    cases.push({sample:'Paragraph',words:caseModel.words.length,method,...metrics});
  }
  return {
    schemaVersion: 1, featureSet:'live-reflow', timestamp: new Date().toISOString(), userAgent: navigator.userAgent,
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }, specimenWidth: availableWidth,
    fontLoaded: document.fonts.check('400 30px "Manrope Morph"'),
    baselineFrameMs: baselineMs, baselineFps: 1000 / baselineMs, typeStates: STATE_COUNT,
    endpoints: { a: DEFAULT_A, b: DEFAULT_B }, preparation, cases, validation,
    notes: [
      'Same text, font, line allocation, 65 type states and renderer in both methods. Color remains continuous.',
      'Reprepare invokes the public Pretext prepare/measure API for each word each frame; Pretext internal caches are warm. It does not represent a DOM layout benchmark.',
      'Update timing measures JavaScript preparation and style writes; RAF intervals also reflect scheduling and browser rendering. Neither is a GPU profiler.',
      'A slow frame exceeds 1.5 times this tab’s idle median RAF interval. Missed frames are an estimate relative to that measured cadence.',
      'Browser visibility, viewport, other applications and thermal load affect results. No claim of universal 60 fps.',
      'Validation geometry reads occur before timed cases, never inside the animation loop.',
      'The specimen is scrolled into view for every case. Long paragraphs extend beyond the viewport; all words update, but only visible text needs painting.',
    ],
  };
}
