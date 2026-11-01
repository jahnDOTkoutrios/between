export class WidthControl {
  constructor(slider,output,auto,onChange){
    this.slider=slider;this.output=output;this.auto=auto;
    slider.addEventListener('input',()=>{const value=Number(slider.value);onChange(value>=Number(slider.max)?0:value);});
    auto.addEventListener('click',()=>onChange(0));
  }
  sync(requested,available){
    const key=`${requested}:${available}`;if(key===this.key)return;this.key=key;
    const max=Math.max(1,available),width=requested>0?Math.min(requested,max):max;
    this.slider.max=String(max);this.slider.value=String(Math.max(1,width));
    this.slider.style.setProperty('--width-progress',`${Math.max(0,Math.min(100,width/max*100))}%`);
    this.slider.setAttribute('aria-valuetext',`${Math.round(width)} pixels${requested===0?' (Auto)':''}`);
    this.output.textContent=`${Math.round(width)} px`;this.auto.setAttribute('aria-pressed',String(requested===0));
  }
}
