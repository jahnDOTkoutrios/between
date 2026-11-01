// Position popovers once on opening; never measure them during animation.
export function anchorPopover(button,panel,preferredWidth=250) {
  button.addEventListener('click',()=>{
    if(panel.matches(':popover-open'))return;
    const rect=button.getBoundingClientRect(),width=Math.min(preferredWidth,innerWidth-24);
    panel.style.width=`${width}px`;panel.style.left=`${Math.max(12,Math.min(rect.left,innerWidth-width-12))}px`;
    if(innerHeight-rect.bottom>=240){panel.style.top=`${rect.bottom+6}px`;panel.style.bottom='auto';panel.style.maxHeight=`${innerHeight-rect.bottom-18}px`;}
    else{panel.style.top='auto';panel.style.bottom=`${innerHeight-rect.top+6}px`;panel.style.maxHeight=`${Math.max(150,rect.top-18)}px`;}
  });
}
