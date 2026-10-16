import { mkdir, writeFile } from 'node:fs/promises';
import { createDemoMidi, createDemoWav } from '../dist/demo-data.mjs';
const destination = new URL('../artifacts/sample-song/', import.meta.url);
await mkdir(destination, { recursive: true });
await writeFile(new URL('Groove Lab sample.mid', destination), createDemoMidi());
await writeFile(new URL('Groove Lab sample backing.wav', destination), new Uint8Array(createDemoWav()));
console.log('Created the original sample MIDI and backing WAV in artifacts/sample-song/.');
