export const ALIGNMENTS=[['left','Left'],['center','Center'],['right','Right'],['justify','Justified']];
export const isWordGap=entry=>entry.isSpace||entry.gapAfter===true;
export function paragraphEndsAt(lines,index){
  const line=lines[index],next=lines[index+1];
  return !line.length||!next?.length||line.at(-1).lastInParagraph===true||line.at(-1).paragraphIndex!==next[0].paragraphIndex;
}
export function lineAlignment(width,usedWidth,spaces,alignment,paragraphEnd=false){
  const remaining=Math.max(0,width-usedWidth);
  return{offset:alignment==='right'?remaining:alignment==='center'?remaining/2:0,space:alignment==='justify'&&!paragraphEnd&&spaces>0?remaining/spaces:0};
}
// Align cached anchors as well as ink, so pointer fields follow the text.
export function alignLayout(layout,alignment='left'){
  if(alignment==='left')return{...layout,alignment};
  const padding=layout.edgePadding||0,width=layout.contentWidth??layout.width;
  const lines=layout.lines.map((line,i)=>{
    if(!line.length)return line;
    const used=line.at(-1).envelopeX+line.at(-1).envelopeWidth-padding;
    const spacing=lineAlignment(width,used,line.filter(isWordGap).length,alignment,paragraphEndsAt(layout.lines,i));
    let shift=spacing.offset;
    const aligned=line.map(entry=>{const moved={...entry,envelopeX:entry.envelopeX+shift,envelopeCenter:entry.envelopeCenter+shift};if(isWordGap(entry))shift+=spacing.space;return moved;});
    for(const key of ['y','fontSize','autoLineHeight','advance'])if(key in line)aligned[key]=line[key];
    if('totalWidth'in line)aligned.totalWidth=line.totalWidth+shift;
    return aligned;
  });
  return{...layout,lines,entries:lines.flat(),alignment};
}
