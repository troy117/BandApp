import { DRUMS } from './engine.mjs';

export const DEFAULT_LANE_ORDER = ['hihat', 'kick', 'snare', 'tom1', 'tom2', 'tom3', 'crash', 'ride'];
export function drumLaneOrder(value) {
  return Array.isArray(value) && value.length === DRUMS.length && new Set(value).size === DRUMS.length && value.every(id => DRUMS.some(drum => drum.id === id)) ? [...value] : [...DEFAULT_LANE_ORDER];
}
export function orderedDrums(chart, order) {
  return drumLaneOrder(order).map(id => DRUMS.find(drum => drum.id === id)).filter(drum => chart.notes.some(note => note.drum === drum.id));
}
