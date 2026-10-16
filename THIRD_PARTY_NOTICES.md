# Third-party notices

## SightKick

- Project: https://github.com/tonygoldcrest/sightkick
- Reviewed revision: `8b43c1018ed15f43166d03725645dcf3cf4295f8`
- Copyright: 2025-present Anton Korolkov
- License: MIT. The full upstream notice ships in `dist/licenses/sightkick.txt`.
- Adapted files: `src/renderer/input/keyboard-source.ts` and `src/renderer/input/helpers.ts`, combined into `dist/vendor/sightkick-input.mjs`.
- Changes: removed TypeScript interfaces, retained the source/control ID convention, added native event timestamps, added SELECT to typing targets, and allowed an injectable event target for verification.

## Reuse assessment

The renderer/input code is independent enough to reuse now. The existing judge (`src/renderer/services/engine/judge.ts`) is coupled to parsed chart measures, notation prefixes, chart tick conversion, and the existing renderer. It reports hit counts rather than exposing the per-hit signed timing records needed here. The prototype implements a small independent judge with timestamped input, one-to-one matching, and signed millisecond errors. No SightKick judge code was copied.

SightKick's chart parser uses rhythm-game chart data and notation-specific structures. Standard MIDI import in this milestone instead uses the portable midi-file decoder below, with an original track/channel selector, tempo/meter timeline, and drum-note mapper. SightKick's VexFlow renderer remains a candidate for the sheet-music milestone. The desktop MIDI backend, filesystem song library, stem splitting, update system, and Electron bridge were not carried into this browser prototype. No upstream songs, fixtures, branding, or audio were copied. Exercises, sample MIDI, and synthesized sounds are original.

The eight drum IDs are compatible with SightKick's conceptual input elements. The included MIDI numbers are a preliminary common percussion mapping for future development, not a tested Roland module profile. Web MIDI device access and MIDI learning are not implemented in this milestone.

## midi-file

- Project: https://github.com/carter-thaxton/midi-file
- Parser source blob SHA: `50ed069ef8e41f86cb288f77492ddd68f280517a`
- Copyright: 2016 Carter Thaxton
- License: MIT, included in `dist/licenses/midi-file.txt` and the standalone HTML.
- Adapted file: `lib/midi-parser.js`, vendored as `dist/vendor/midi-parser.mjs`.
- Changes: converted the CommonJS export to an ES module; added byte/event bounds, a four-byte variable-length limit, unsigned chunk sizes, chunked string conversion, and moved running-status initialization ahead of the event loop. These reject malformed input without bringing Node.js APIs or an external runtime dependency into the browser.
