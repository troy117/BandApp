import { DRUMS } from './engine.mjs';

export const DEFAULT_LANE_ORDER = ['hihat', 'kick', 'snare', 'tom1', 'tom2', 'tom3', 'crash', 'ride'];
export function drumLaneOrder(value) {
  return Array.isArray(value) && value.length === DRUMS.length && new Set(value).size === DRUMS.length && value.every(id => DRUMS.some(drum => drum.id === id)) ? [...value] : [...DEFAULT_LANE_ORDER];
}
export function orderedDrums(chart, order) {
  return drumLaneOrder(order).map(id => DRUMS.find(drum => drum.id === id)).filter(drum => chart.notes.some(note => note.drum === drum.id));
}

export function drumHighwayLane(note) {
  return note.drum === 'hihat' && (note.articulation === 'open' || [26, 46].includes(note.midiPitch)) ? 'hihat-open' : note.drum;
}
export function drumHighwayLanes(chart, order) {
  return orderedDrums(chart, order).flatMap(drum => {
    if (drum.id !== 'hihat') return [{ ...drum, drumId: drum.id }];
    const closed = { ...drum, drumId: drum.id, name: 'Closed hi-hat', short: 'CLOSED HAT' };
    return chart.notes.some(note => drumHighwayLane(note) === 'hihat-open')
      ? [closed, { ...drum, id: 'hihat-open', drumId: drum.id, name: 'Open hi-hat', short: 'OPEN HAT ○', color: '#ffe9b0' }]
      : [closed];
  });
}
