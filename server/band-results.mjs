import { randomUUID } from 'node:crypto';

export const BAND_SCHEMA = 2;
export function migrateBandStorage(db) {
  if (db.prepare('PRAGMA user_version').get().user_version >= BAND_SCHEMA) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec("CREATE TABLE IF NOT EXISTS band_takes (id TEXT PRIMARY KEY,teacher_id TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,state TEXT NOT NULL,record TEXT NOT NULL); CREATE TABLE IF NOT EXISTS band_results (take_id TEXT NOT NULL REFERENCES band_takes(id),user_id TEXT NOT NULL REFERENCES users(id),state TEXT NOT NULL,record TEXT NOT NULL,PRIMARY KEY(take_id,user_id)); PRAGMA user_version=2;");
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function validatePartResult(input, total, tolerance = 140) {
  if (!input || typeof input !== 'object' || input.total !== total) throw new Error('The result does not match the assigned part.');
  for (const key of ['total', 'hits', 'misses', 'wrong', 'extras', 'bestStreak']) if (!Number.isSafeInteger(input[key]) || input[key] < 0 || input[key] > 250000) throw new Error('Invalid note counts.');
  if (input.hits + input.misses + input.wrong !== total || input.bestStreak > input.hits) throw new Error('The note totals do not match.');
  for (const key of ['meanMs', 'meanAbsMs']) if (input.hits ? !Number.isFinite(input[key]) || Math.abs(input[key]) > tolerance + 0.001 : input[key] !== null) throw new Error('Invalid timing result.');
  if (input.meanAbsMs < 0 || (input.hits && Math.abs(input.meanMs) > input.meanAbsMs + 0.001)) throw new Error('Invalid average timing.');
  return { total, hits: input.hits, misses: input.misses, wrong: input.wrong, extras: input.extras, bestStreak: input.bestStreak, meanMs: input.meanMs, meanAbsMs: input.meanAbsMs, accuracy: input.hits / Math.max(1, total + input.extras) * 100 };
}
export function bandRecord(arrangement, part, summary, { id = randomUUID(), takeId = null, at = Date.now() } = {}) {
  const practice = part.chart.practice;
  return { id, at, ...summary, sourceKind: arrangement.sourceKind, sourceId: arrangement.id, revisionId: arrangement.revisionId, title: arrangement.title, instrument: part.instrument, partId: part.id, partName: part.name, takeId, grooveId: null, bpm: part.chart.bpm, endBpm: part.chart.tempos?.at(-1)?.bpm || part.chart.bpm, tolerance: 140, focus: part.instrument, section: practice ? practice.startBar + '–' + practice.endBar : '1–' + part.chart.bars, full: practice?.full ?? true, repeats: 1, drums: [] };
}
