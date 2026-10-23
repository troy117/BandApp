import { escapeHtml } from './song-import.mjs';

export function defaultSeatPart(song, student, fallback = 0) {
  return song?.parts.find(part => part.instrument === student?.defaultInstrument) || song?.parts[fallback] || song?.parts[0];
}

export const voiceStatusLabel = state => ({ 'on-pitch': 'On pitch', low: 'Sing higher', high: 'Sing lower', quiet: 'Listening for voice', rest: 'Rest', off: 'Mic off', ready: 'Getting ready', unclear: 'Pitch unclear', changing: 'Finding note', 'no-melody': 'Lyrics only' })[state] || 'No pitch signal';

export function classMeter(person, duration) {
  const stats = person.result || person.progress, follow = ['vocals','guitar','bass'].includes(person.instrument);
  const judged = stats && !follow ? stats.hits + stats.misses + (stats.wrong || 0) + stats.extras : 0;
  const accuracy = judged ? Math.round(stats.hits / judged * 100) : null;
  return { follow, accuracy, progress: Math.max(0, Math.min(100, (person.result ? duration : stats?.position || 0) / Math.max(1, duration) * 100)),
    label: person.instrument === 'vocals' ? person.state === 'playing' && person.connected ? voiceStatusLabel(person.progress?.voice?.state) : person.state === 'completed' ? 'Completed' : !person.connected ? 'Not connected' : 'Waiting to sing' : follow ? 'Follow along' : accuracy === null ? 'Waiting for notes' : accuracy + '%',
    voice: person.state === 'playing' && person.connected ? person.progress?.voice : null, detail: follow ? 'Unscored · song progress' : stats ? stats.hits + ' matched · ' + stats.misses + ' missed · Best streak ' + stats.bestStreak : 'Ready for a new take',
  };
}

export function classMeterMarkup(person, duration) {
  const meter = classMeter(person, duration), strong = meter.voice?.state === 'on-pitch' || meter.accuracy >= 85;
  return '<article class="band-person class-meter" data-strong="' + strong + '"><div class="class-meter-heading"><h4>' + escapeHtml(person.name) + '</h4><span>' + escapeHtml(person.instrument) + '</span></div><p>' + escapeHtml(person.state) + ' · ' + (person.connected ? 'Connected' : 'Not connected') + '</p><strong class="class-meter-value">' + escapeHtml(meter.label) + '</strong>' + (!meter.follow ? '<meter min="0" max="100" value="' + (meter.accuracy || 0) + '" aria-label="' + escapeHtml(person.name) + ' accuracy on notes judged so far"></meter>' : '') + '<small>' + escapeHtml(meter.detail) + '</small><progress max="100" value="' + meter.progress + '" aria-label="' + escapeHtml(person.name) + ' song progress"></progress><p>' + escapeHtml(person.message || '') + '</p></article>';
}
