import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const files = ['lessons.mjs', 'engine.mjs', 'vendor/sightkick-input.mjs', 'vendor/midi-parser.mjs', 'audio.mjs', 'midi.mjs', 'demo-data.mjs', 'song-library.mjs', 'sync.mjs', 'audio-sync.mjs', 'song-import.mjs', 'notation.mjs', 'practice.mjs', 'practice-tools.mjs', 'app.mjs'];
const modules = await Promise.all(files.map(file => readFile(new URL(`dist/${file}`, root), 'utf8')));
const code = modules.map(source => source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')).join('\n\n');
const checked = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: code, encoding: 'utf8' });
if (checked.status !== 0) throw new Error(checked.stderr);
const [index, css, icon, license, midiLicense, viewCss, practiceCss, syncCss] = await Promise.all(['dist/index.html', 'dist/styles.css', 'dist/icon.svg', 'dist/licenses/sightkick.txt', 'dist/licenses/midi-file.txt', 'dist/practice-views.css', 'dist/practice-tools.css', 'dist/audio-sync.css'].map(file => readFile(new URL(file, root), 'utf8')));
const html = index
  .replace('<!doctype html>', `<!doctype html>\n<!-- SightKick attribution and license for adapted input helpers:\n${license}\nMIDI parser attribution and license:\n${midiLicense}\n-->`)
  .replace('<link rel="stylesheet" href="./styles.css">', `<style>${css}\n${viewCss}\n${practiceCss}\n${syncCss}</style>`)
  .replace('<link rel="stylesheet" href="./practice-views.css">', '')
  .replace('<link rel="stylesheet" href="./practice-tools.css">', '')
  .replace('<link rel="stylesheet" href="./audio-sync.css">', '')
  .replace('href="./icon.svg"', `href="data:image/svg+xml,${encodeURIComponent(icon)}"`)
  .replace('href="./licenses/sightkick.txt"', 'href="https://github.com/tonygoldcrest/sightkick/blob/8b43c1018ed15f43166d03725645dcf3cf4295f8/LICENSE"')
  .replace('href="./licenses/midi-file.txt"', 'href="https://github.com/carter-thaxton/midi-file/blob/master/LICENSE.md"')
  .replace('<script type="module" src="./app.mjs"></script>', `<script type="module">\n${code}\n</script>`);
await mkdir(new URL('artifacts/', root), { recursive: true });
await writeFile(new URL('artifacts/Groove Lab.html', root), html);
console.log('Created artifacts/Groove Lab.html — open directly in a browser, with no server or network required.');
