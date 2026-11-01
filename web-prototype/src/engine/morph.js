import { fontStack } from './typography.js';
export const FONT_FAMILY = 'Manrope Morph';
export const STATE_COUNT = 65;
export const DEFAULT_A = Object.freeze({ size: 30, weight: 350, tracking: -0.5, color: '#252525' });
export const DEFAULT_B = Object.freeze({ size: 46, weight: 720, tracking: 1.4, color: '#a2a29b' });
export const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
export const lerp = (a, b, t) => a + (b - a) * t;
export function mixColor(a, b, t) {
  const channels = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const av = channels(a), bv = channels(b);
  return `rgb(${av.map((v, i) => Math.round(lerp(v, bv[i], clamp(t)))).join(' ')})`;
}
export function typeState(a, b, t) {
  t = clamp(t);
  const style={ size: lerp(a.size, b.size, t), weight: lerp(a.weight, b.weight, t), tracking: lerp(a.tracking, b.tracking, t) };
  if(a.fontFamily||b.fontFamily)style.fontFamily=t<.5?(a.fontFamily||'manrope'):(b.fontFamily||'manrope');
  return style;
}
export function fontString(style) { return `${style.weight} ${style.size}px ${fontStack(style.fontFamily)}`; }
export function stateIndex(t, count = STATE_COUNT) { return Math.round(clamp(t) * (count - 1)); }
export function tokenize(text) {
  return text.replace(/\r\n?/g, '\n').split('\n').map(paragraph => paragraph.match(/\S+/gu) || []);
}
export function pointerAmount(x, y, pointer, radius = 180) {
  if (!pointer) return 0;
  const distance = Math.hypot(x - pointer.x, y - pointer.y);
  return Math.exp(-0.5 * (distance / radius) ** 2);
}
export function metricKey(a, b) { return [a.size, a.weight, a.tracking, b.size, b.weight, b.tracking,a.fontFamily||'manrope',b.fontFamily||'manrope'].join(':'); }

export function typeIndex(t,a,b){const index=stateIndex(t);return (a.fontFamily||'manrope')!==(b.fontFamily||'manrope')&&t<.5&&index===32?31:index;}
