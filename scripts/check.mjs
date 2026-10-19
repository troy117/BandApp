import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
for (const directory of ['dist', 'server', 'scripts']) {
const files = await readdir(new URL(`../${directory}/`, import.meta.url), { recursive: true });
for (const file of files.filter(file => file.endsWith('.mjs') || file.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(`../${directory}/${file.replaceAll('\\', '/')}`, import.meta.url))], { encoding: 'utf8' });
  if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
}
}
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
if (!html.includes('app.mjs')) throw new Error('Missing app entry');
console.log('Browser module syntax and entry point verified.');
