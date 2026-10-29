import { DRUMS } from './engine.mjs';

export const DEFAULT_LANE_ORDER = ['hihat', 'hihat-open', 'hihat-pedal', 'kick', 'snare', 'tom1', 'tom2', 'tom3', 'crash', 'ride'];
export function drumLaneOrder(value) {
  if(Array.isArray(value)&&value.length===8&&new Set(value).size===8&&value.every(id=>DRUMS.some(drum=>drum.id===id))&&value.includes('hihat')&&!value.includes('hihat-open')&&!value.includes('hihat-pedal'))value=value.flatMap(id=>id==='hihat'?[id,'hihat-open','hihat-pedal']:[id]);
  return Array.isArray(value) && value.length === DRUMS.length && new Set(value).size === DRUMS.length && value.every(id => DRUMS.some(drum => drum.id === id)) ? [...value] : [...DEFAULT_LANE_ORDER];
}
export function orderedDrums(chart, order) {
  return drumLaneOrder(order).map(id => DRUMS.find(drum => drum.id === id)).filter(drum => chart.notes.some(note => note.drum === drum.id));
}

export function drumHighwayLane(note) {
  return note.drum;
}
export function drumHighwayLanes(chart, order) {
  return orderedDrums(chart, order).map(drum => ({...drum,drumId:drum.id}));
}
