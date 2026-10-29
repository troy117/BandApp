# Drum reports, Retry and hi-hat voices — Prototype 29

October 29, 2026. Prepared locally; publication requires approval.

## Reviewing and retrying a solo attempt

The drum report starts with a smaller **Your music, in focus** heading and its song context. The timing graph comes next, above six compact summary fields. Zoom, source-bar selection, detailed notes, timing breakdowns and CSV remain available. Desktop summaries use one row; narrow screens wrap them without horizontal report scrolling. Keyboard and vocal reports keep their existing layout.

**Retry**, beside **Exit** at the top, returns the current solo drum attempt to fullscreen, reset and ready. Press **Play** to start a fresh count-in. Retry itself does not play audio or start a scored attempt. It retains the loaded song/revision/backing and volume, tempo, practice range, pass count, tempo ladder, drum focus, timing settings, and current view/metronome/guide choices. Report-only bar highlighting does not replace the attempted practice range.

The click requests native browser fullscreen directly. If fullscreen is unsupported or rejected, the score fills the browser viewport with Play and Exit still available. Keyboard Enter/Space can activate Retry; focus moves to Play and stays in the expanded practice area. Escape exits expansion without starting playback.

The previous report stays in the journal and existing account-save queue. Retry neither creates nor resubmits a result. The next completed attempt gets its own identifier. Repeated Retry activation is inert after the report closes. Pending audio startup, stale hits, flashes and live score counters are reset through the existing transport.

Retry is offered for the current solo drum report, including a stopped attempt. It is not a control for a shared take or another student's history. A jam room, changed account, changed song or active practice blocks it. Saved-history **Play again**, section practice, teacher reports and other instruments retain their existing behavior. A song no longer loaded must be reopened through the normal song/history controls.

## Open, closed and pedal hi-hat

The prior highway could draw an open-hi-hat lane while accepting the same input as a closed hit. New attempts use separate voices throughout import, input, judging, highway labels, notation, guide sounds and detailed reports.

| Voice | Default computer key | TD-17 default MIDI notes |
| --- | --- | --- |
| Closed hi-hat | D | 42 bow, 22 edge |
| Open hi-hat | E | 46 bow, 26 edge |
| Pedal hi-hat / chick | R | 44 |

A different hi-hat voice cannot satisfy the expected note. It uses the existing drum rule: an extra hit, with the unmatched target becoming a miss when its timing window closes. Timing windows and scoring arithmetic are unchanged. Bow and edge are accepted within their matching open/closed voice. Pedal/chick is separate from both stick-hit targets. Cymbals-only practice retains all three voices. Built-in patterns remain closed-hi-hat exercises.

These defaults follow Roland's [TD-17 note map](https://support.roland.com/hc/en-us/articles/39437016357147-VAD307-Default-MIDI-Note-Map). The module can customize notes under **OTHER → MIDI NOTE**. The [TD-17 MIDI Implementation v1.00, pages 1 and 3–4](https://static.roland.com/assets/media/pdf/TD-17_MIDI_Imple_eng01_W.pdf) describes changing open/closed note numbers with pedal depression, as well as CC4 position messages. Groove Lab follows the actual mapped Note On; it does not invent a CC4 threshold or infer half-open expression. CC4, note-off and zero-velocity Note On never become strikes. The selected input still accepts any MIDI channel. No new permissions, MIDI output or SysEx are used.

Existing keyboard bindings remain intact. On first upgrade, the two added voices take E/R when free; if a custom binding already occupies either key, an unused key is chosen and displayed in Controls and the legends. Deliberately unbound existing drums stay unbound. Existing lane order is retained, inserting open and pedal after closed hi-hat.

Legacy generic `hihat` song/pad assignments resolve notes 26/46 as open, 44 as pedal, and other pitches as closed. Custom assignments to other drums and ignored notes stay unchanged. New explicit closed mappings store `hihat-closed`, which resolves to the existing runtime/built-in `hihat` ID; this lets Learn pad or a song override intentionally assign even note 46 to a closed hit without reinterpreting it on reload. Open/pedal use `hihat-open` and `hihat-pedal`. Source MIDI, published song revisions, accounts and old saved scores are not rewritten. Old reports retain the generic Hi-hat label and their original combined assessment; new drum details mark `hiHatVoices: true` and label closed/open/pedal separately.

## Physical TD-17 check still required

1. In Windows Chrome, connect the TD-17 and open **Controls → Check or change pad assignments**.
2. Strike the bow and edge while fully closed, then open. Check the live name, note number and strength. The default numbers above are a reference, not proof of this kit's configuration.
3. Close the pedal for a chick and confirm it reads **Pedal hi-hat**. Moving the pedal without a note-producing chick should not register a scored hit.
4. If the kit uses other note numbers, use **Learn pad** separately for Closed, Open and Pedal. Recheck both bow and edge after learning. Reopen the app and confirm assignments remain saved.
5. Practice a short MIDI section containing both open and closed targets. Confirm a deliberate mismatch fails to match, then use Retry and play the correct notes. Verify both reports and backing timing with the actual sound setup.

Physical pad triggering, driver latency, half-open module behavior and school-network ensemble timing cannot be verified in the cloud. No automatic hi-hat or hardware-latency calibration was added; existing input-delay correction remains available.

## Validation and storage

- 252 Node tests pass, including MIDI messages and releases/controllers, distinct matching/mismatches, legacy and explicit mapping round trips, collision-free key migration, lane migration, notation, report compatibility and all ten drum summary voices. Existing school/storage, shared-session, keyboard, guitar/bass and vocal regressions pass.
- `npm run check` and `npm run standalone` pass. The app has no separate compilation build; standalone export bundles the modules and styles.
- Chromium 154 browser QA uses an isolated synthetic school and generated original MIDI/audio. It covers complete → report → Retry → native fullscreen ready → Play → complete; repeated activation; Enter/Space/Tab/Escape; Exit, Back/Forward and refresh; desktop 1365×900, portrait 390×844 and landscape 844×390; rejected/unsupported fullscreen; backing, tempo, range/pass/view retention; pending-save recovery; jam guarding; historical, vocal/keyboard and staff report flows.
- Seven independent completed reports persist with details. The hi-hat browser case scores 4/5 for a deliberate open-for-closed keyboard mismatch, then 5/5 with correct synthetic MIDI after Retry. Neither physical MIDI hardware nor classroom audio was used.
- The local browser harness, screenshots and evidence JSON are ignored under `artifacts/drum-report-qa/`. No production records, songs or credentials were accessed. No schema, dependency, hosting variable or volume change is needed.
