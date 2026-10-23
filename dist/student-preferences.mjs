export const STUDENT_INSTRUMENTS = { drums: 'Drums', keyboard: 'Keyboard', guitar: 'Guitar', bass: 'Bass', vocals: 'Vocals' };
export function studentInstrument(value = 'drums') {
  if (!Object.hasOwn(STUDENT_INSTRUMENTS, value)) throw new Error('Choose a default instrument.');
  return value;
}
export function instrumentOptions(selected = 'drums') {
  return Object.entries(STUDENT_INSTRUMENTS).map(([id, label]) => '<option value="' + id + '"' + (id === selected ? ' selected' : '') + '>' + label + '</option>').join('');
}
