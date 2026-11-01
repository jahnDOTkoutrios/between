import { NEUTRAL_STYLE } from './properties.js';
const radians=degrees=>(degrees%360)*Math.PI/180;
export function visualBounds(width,height,effects) {
  const {rotation=0,skew=0,scaleX=100,scaleY=100}=effects;
  const r=radians(rotation),k=Math.tan(radians(-skew)),sx=scaleX/100,sy=scaleY/100;
  const w=Math.abs(Math.cos(r)*sx)*width+Math.abs((Math.cos(r)*k-Math.sin(r))*sy)*height;
  const h=Math.abs(Math.sin(r)*sx)*width+Math.abs((Math.sin(r)*k+Math.cos(r))*sy)*height;
  return {width:w,height:h,minX:(width-w)/2,minY:(height-h)/2};
}
function maximumRotated(w,h,low,high) {
  // |cos|w + |sin|h has period 180 degrees; arbitrary turns must
  // include extrema in every quadrant, not only the original ±90 range.
  if(high-low>=180)return Math.hypot(w,h);
  const start=((low%180)+180)%180,end=start+(high-low),angle=Math.atan2(h,w)*180/Math.PI;
  const candidates=[start,end,...[angle,180-angle].flatMap(value=>[value,value+180]).filter(value=>value>=start&&value<=end)];
  return Math.max(...candidates.map(value=>Math.abs(Math.cos(radians(value)))*w+Math.abs(Math.sin(radians(value)))*h));
}
function maximumSkew(a,b){
  const low=Math.min(a,b),high=Math.max(a,b),pole=90+Math.ceil((low-90)/180)*180;
  if(pole>=low-1e-9&&pole<=high+1e-9)throw new RangeError('Skew crosses a vertical angle (90° + 180°). Keep its endpoints between two vertical angles.');
  return Math.max(Math.abs(Math.tan(radians(low))),Math.abs(Math.tan(radians(high))));
}
export function envelope(width,maxSize,a,b) {
  const val=(style,key)=>style[key]??NEUTRAL_STYLE[key];
  const sx=Math.max(Math.abs(val(a,'scaleX')),Math.abs(val(b,'scaleX')))/100,sy=Math.max(Math.abs(val(a,'scaleY')),Math.abs(val(b,'scaleY')))/100;
  const skew=maximumSkew(val(a,'skew'),val(b,'skew'));
  const w=width*sx+skew*maxSize*sy,h=maxSize*sy;
  const low=Math.min(val(a,'rotation'),val(b,'rotation')),high=Math.max(val(a,'rotation'),val(b,'rotation'));
  const outline=Math.max(val(a,'outlineWidth'),val(b,'outlineWidth'))*Math.max(sx,sy);
  const shift=Math.max(Math.abs(val(a,'baseline')),Math.abs(val(b,'baseline')));
  const result={width:maximumRotated(w,h,low,high)+2*outline,height:maximumRotated(h,w,low,high)+2*shift+2*outline};
  if(!Number.isFinite(result.width)||!Number.isFinite(result.height))throw new RangeError('These values produce non-finite layout bounds. Reduce one of the values.');
  return result;
}

// Skew changes ink, like an oblique font; it does not add tracking.
// Keep true painted bounds for height/inspection, and flow bounds for advances.
export function flowBounds(width,height,effects){return visualBounds(width,height,{...effects,skew:0});}
export function flowEnvelope(width,height,a,b){
  const ink=envelope(width,height,a,b),flow=envelope(width,height,{...a,skew:0},{...b,skew:0});
  const sy=Math.max(Math.abs(a.scaleY??100),Math.abs(b.scaleY??100))/100;
  const edgePadding=maximumSkew(a.skew??0,b.skew??0)*height*sy/2;
  return{width:flow.width,height:ink.height,edgePadding};
}
