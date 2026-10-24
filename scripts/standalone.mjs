import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const files = ['lessons.mjs', 'engine.mjs', 'drum-lanes.mjs', 'student-preferences.mjs', 'run-report.mjs', 'vendor/sightkick-input.mjs', 'vendor/midi-parser.mjs', 'audio.mjs', 'midi.mjs', 'midi-input.mjs', 'drumkit-controls.mjs', 'demo-data.mjs', 'song-library.mjs', 'sync.mjs', 'audio-sync.mjs', 'song-import.mjs', 'notation.mjs', 'full-score.mjs', 'score-screen.mjs', 'practice.mjs', 'session-transport.mjs', 'drum-highway.mjs', 'practice-tools.mjs', 'password-policy.mjs', 'classroom.mjs', 'instruments.mjs', 'lyrics.mjs', 'lyric-timing.mjs', 'follow-along.mjs', 'follow-view.mjs', 'fretted-score.mjs', 'report-view.mjs', 'vocal-guide.mjs', 'arrangements.mjs', 'piano-audio.mjs', 'band-markup.mjs', 'band-link.mjs', 'band-import.mjs', 'band-rooms.mjs', 'band-practice.mjs', 'app.mjs'];
files.splice(files.indexOf('drum-highway.mjs'), 0, 'highway-experience.mjs');
files.splice(files.indexOf('score-screen.mjs'), 0, 'screen-awake.mjs');
files.splice(files.indexOf('band-markup.mjs'), 0, 'class-experience.mjs', 'mobile-practice.mjs');
files.splice(files.indexOf('band-markup.mjs'), 0, 'vocal-pitch.mjs', 'vocal-microphone.mjs', 'vocal-warmup.mjs', 'vocal-highway.mjs', 'singing-practice.mjs');
files.splice(files.indexOf('band-practice.mjs'), 0, 'karaoke-view.mjs');
files.splice(files.indexOf('audio-sync.mjs'), 0, 'audio-sync-markup.mjs');
files.splice(files.indexOf('audio-sync.mjs'), 0, 'backing-range.mjs', 'timing-map.mjs', 'backing-tracks.mjs');
files.splice(files.indexOf('band-practice.mjs'), 0, 'keyboard-score.mjs');
files.splice(files.indexOf('band-import.mjs'), 0, 'band-backing.mjs');
const modules = await Promise.all(files.map(file => readFile(new URL(`dist/${file}`, root), 'utf8')));
const code = modules.map(source => source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')).join('\n\n');
const checked = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: code, encoding: 'utf8' });
if (checked.status !== 0) throw new Error(checked.stderr);
const [index, css, icon, license, midiLicense, viewCss, practiceCss, syncCss, schoolCss, bandCss] = await Promise.all(['dist/index.html', 'dist/styles.css', 'dist/icon.svg', 'dist/licenses/sightkick.txt', 'dist/licenses/midi-file.txt', 'dist/practice-views.css', 'dist/practice-tools.css', 'dist/audio-sync.css', 'dist/classroom.css', 'dist/band.css'].map(file => readFile(new URL(file, root), 'utf8')));
const html = index
  .replace('<!doctype html>', `<!doctype html>\n<!-- SightKick attribution and license for adapted input helpers:\n${license}\nMIDI parser attribution and license:\n${midiLicense}\n-->`)
  .replace('<link rel="stylesheet" href="./styles.css">', `<style>${css}\n${viewCss}\n${practiceCss}\n${syncCss}\n${schoolCss}
${bandCss}</style>`)
  .replace('<link rel="stylesheet" href="./practice-views.css">', '')
  .replace('<link rel="stylesheet" href="./practice-tools.css">', '')
  .replace('<link rel="stylesheet" href="./audio-sync.css">', '')
  .replace('<link rel="stylesheet" href="./classroom.css">', '')
  .replace('<link rel="stylesheet" href="./band.css">', '')
  .replace('href="./icon.svg"', `href="data:image/svg+xml,${encodeURIComponent(icon)}"`)
  .replace('href="./licenses/sightkick.txt"', 'href="https://github.com/tonygoldcrest/sightkick/blob/8b43c1018ed15f43166d03725645dcf3cf4295f8/LICENSE"')
  .replace('href="./licenses/midi-file.txt"', 'href="https://github.com/carter-thaxton/midi-file/blob/master/LICENSE.md"')
  .replace('<script type="module" src="./app.mjs"></script>', `<script type="module">\n${code}\n</script>`);
await mkdir(new URL('artifacts/', root), { recursive: true });
await writeFile(new URL('artifacts/Groove Lab.html', root), html);
console.log('Created artifacts/Groove Lab.html — open directly in a browser, with no server or network required.');
