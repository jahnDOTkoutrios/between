import { anchorPopover } from './popover.js';
import { NOISE_TYPES,defaultNoise,activeNoise } from '../engine/noise.js';

export class NoiseEditor {
  constructor(button,panel,distribution,onChange){
    Object.assign(this,{button,panel,distribution,onChange,mode:'curve',pending:false,timer:0,frame:0,amountDraft:null});
    distribution.noise??=defaultNoise();anchorPopover(button,panel,290);
    this.type=document.createElement('select');
    for(const[value,label]of NOISE_TYPES){const option=document.createElement('option');option.value=value;option.textContent=label;this.type.append(option);}
    this.row('Type',this.type);this.type.title='Random: independent samples. Smooth: gradual changes. Fractal: several scales.';
    const amountGroup=document.createElement('span');amountGroup.className='noise-amount';
    this.amount=document.createElement('input');Object.assign(this.amount,{type:'range',min:0,max:100,step:1});this.amount.setAttribute('aria-label','Noise amount');
    this.amountValue=document.createElement('output');amountGroup.append(this.amount,this.amountValue);this.row('Amount',amountGroup);
    const seedGroup=document.createElement('span');seedGroup.className='noise-seed';
    this.seed=document.createElement('input');Object.assign(this.seed,{type:'number',min:0,max:2147483647,step:1});this.seed.setAttribute('aria-label','Noise seed');
    this.newSeed=document.createElement('button');this.newSeed.className='icon-button';this.newSeed.type='button';this.newSeed.textContent='↻';this.newSeed.title='New seed';this.newSeed.setAttribute('aria-label','New noise seed');
    seedGroup.append(this.seed,this.newSeed);this.row('Seed',seedGroup);
    const targets=document.createElement('div');targets.className='noise-targets';
    this.values=this.checkbox(targets,'Blend values','values');this.values.title='Vary the shared A–B blend amount across the chosen units, within the endpoint styles.';
    this.words=this.checkbox(targets,'Words per restart','restartWords');this.words.title='Vary around Every … words. Requires Restart: Word.';panel.append(targets);
    this.detail=document.createElement('output');this.detail.className='noise-detail';this.detail.setAttribute('aria-live','polite');panel.append(this.detail);
    this.type.addEventListener('change',()=>{const value=this.type.value;this.flush();this.distribution.noise.type=value;this.changed();});
    this.amount.addEventListener('input',()=>{
      this.amountDraft=Number(this.amount.value);this.amountValue.value=`${this.amount.value}%`;
      if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.distribution.noise.amount=this.amountDraft;this.amountDraft=null;this.changed();});
    });
    this.amount.addEventListener('change',()=>{if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.amountDraft=null;this.distribution.noise.amount=Number(this.amount.value);this.changed();});
    this.seed.addEventListener('input',()=>{clearTimeout(this.timer);this.pending=true;this.timer=setTimeout(()=>this.flush(),220);});
    this.seed.addEventListener('change',()=>this.flush());this.seed.addEventListener('blur',()=>this.flush());this.seed.addEventListener('keydown',event=>{if(event.key==='Enter')this.flush();});
    this.newSeed.addEventListener('click',()=>{this.flush();this.discardInput();const random=new Uint32Array(1);crypto.getRandomValues(random);this.distribution.noise.seed=random[0]&2147483647;this.changed();});
    this.sync();
  }
  row(label,control){const row=document.createElement('label');row.className='setting-row';row.append(document.createTextNode(label),control);if(control.tagName==='SELECT')control.setAttribute('aria-label',`Noise ${label.toLowerCase()}`);this.panel.append(row);}
  checkbox(parent,label,key){const row=document.createElement('label');row.className='noise-target';const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label',label);row.append(input,document.createTextNode(label));parent.append(row);input.addEventListener('change',()=>{const checked=input.checked;this.flush();this.distribution.noise[key]=checked;this.changed();});return input;}
  flush(){
    clearTimeout(this.timer);this.timer=0;let changed=false;
    if(this.frame){cancelAnimationFrame(this.frame);this.frame=0;this.distribution.noise.amount=this.amountDraft;this.amountDraft=null;changed=true;}
    if(this.pending){const value=this.seed.valueAsNumber;if(this.seed.value&&this.seed.checkValidity()&&Number.isInteger(value)){this.pending=false;this.distribution.noise.seed=value;changed=true;}}
    if(changed)this.changed();
  }
  discardInput(){clearTimeout(this.timer);if(this.frame)cancelAnimationFrame(this.frame);this.timer=this.frame=0;this.pending=false;this.amountDraft=null;}
  restore(){this.discardInput();this.sync();}
  changed(){this.sync();this.onChange();}
  sync(mode=this.mode){
    this.mode=mode;const n=this.distribution.noise,enabled=n.type!=='off',wordMode=this.distribution.restart==='word';
    this.type.value=n.type;this.amount.value=n.amount;this.amountValue.value=`${n.amount}%`;if(!this.pending)this.seed.value=n.seed;
    this.values.checked=n.values;this.words.checked=n.restartWords;
    this.amount.disabled=this.seed.disabled=this.newSeed.disabled=this.values.disabled=!enabled;this.words.disabled=!enabled||!wordMode;
    const active=!!(activeNoise(n,'values')||wordMode&&activeNoise(n,'restartWords'));
    this.button.classList.toggle('has-noise',active&&mode==='curve');this.button.setAttribute('aria-pressed',String(active&&mode==='curve'));
    this.button.title=active?`Noise: ${n.type}, ${n.amount}%, seed ${n.seed} (Curve mode)`:'Noise (Curve mode)';
    this.detail.textContent=enabled&&wordMode&&n.restartWords?`Groups: ${Math.max(1,Math.round(this.distribution.restartWords*(1-n.amount/100)))}–${Math.min(Number.MAX_SAFE_INTEGER,Math.round(this.distribution.restartWords*(1+n.amount/100)))} words`:enabled&&!n.values?'Choose a target.':'';
    this.detail.hidden=!this.detail.textContent;
  }
}
