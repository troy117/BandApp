// One joined account/device owns classroom playback; charts and scoring stay local.
export function sessionAudioUserId(room) { return room?.audioUserId || room?.teacherId; }
export function isSessionAudioDevice(room, userId) { return !room || !!userId && sessionAudioUserId(room) === userId; }
export function defaultSessionAudioUserId(participants, teacherId) {
  return participants.find(person => person.instrument === 'drums')?.userId || teacherId;
}
