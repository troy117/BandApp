# Vocal warm-up and highway experience — Prototype 16 / 17

## Vocal practice

Open a song's Vocals part, then **Sound & pitch settings → Warm up your voice**. The opening-melody exercise takes five consecutive distinct pitches from the selected vocal melody. It retains the song's actual pitches; it does not infer a song key from the first note. Major/minor five-note scale exercises have an explicit Practice key selector. A warm-up octave selector shifts the exercise, with out-of-detector-range choices explained rather than silently changing individual notes.

**Start warm-up** asks for microphone access if needed. In Prototype 17, each reference sustains for four seconds, followed by a 0.3-second quiet gap and a four-second singing turn. Listen/Your turn countdowns identify each phase. A dedicated Target/You meter shows low/center/high pitch during the response. Feedback compares the exact exercise pitch, with at least 0.7 seconds near the target needed to count a held note. The reference/listen interval is excluded from pitch matching. Headphones reduce speaker echo during the student’s turn. Students can practice by ear if microphone permission is denied. No grade, recording, upload, account field or school-song revision is created. See [the vocal highway guide](VOCAL_HIGHWAY.md) for the new song display.

**Find a comfortable octave** asks for an easy steady vowel. It needs at least 15 confident, unclipped observations spanning 1.4 seconds, with stable pitch in a recent 2.5-second window. A result proposes an octave for the exercise; **Use this octave** applies it to the warm-up and optional melody-guide sound. This is a starting suggestion, not a measured vocal range or a declaration that a singer is warmed up. Students keep the octave that feels easy. Sheet music and stored concert pitches remain unchanged; song singing range can still accept a comfortable octave or require the written octave.

Warm-ups are separate from song playback and are disabled inside a jam room. Starting a song, switching songs/parts/accounts, closing the settings panel, hiding/leaving the page or cancelling the exercise stops its tone. Cancelling a pending microphone request prevents a late-start exercise. Existing microphone opt-in, visible on/off state and cleanup remain. Real student/phone microphone and comfort testing is still necessary.

## Highways and meters

Every solo and band/jam highway has a reserved side strip with a meter. Drums/keyboard show matched percentage among **notes judged so far**, including misses, wrong piano notes and extras, plus the current streak. Pending future notes do not lower the live percentage. This is the existing judge's data; no timing, score, reports or saved attempt format changes. Listen mode, teacher guide and guitar/bass follow-along show explicitly unscored **Song progress**, because those modes do not measure a player's performance. Sheet music/tab/lyrics do not show this highway meter.

Choose **Style → Arcade** inside the highway to use a neon runway, glowing outlined notes, a smooth light swell and small hit bursts for actual scored hits. Guitar/bass remain timing guides and do not invent hit detections. **Classic** remains available; **Effects** disables added motion. Operating-system reduced-motion preference also disables the added pulse/bursts. Highway style/effects are saved only as browser display preferences and synchronized between the solo and band surfaces. Notes use the same geometry/clock/judge in both styles. No full-screen flashes or background media is added.

`highway-experience.mjs` owns shared style controls, live-meter semantics and canvas effect helpers; `vocal-warmup.mjs` owns exercise planning, octave evidence and the interactive warm-up. Standalone export includes both. Tests cover score denominators, unscored modes, rendering at narrow/wide sizes without chart mutation, exact melody/key intervals, unreliable octave evidence, reference/sing separation, held notes and pending-request cancellation. Browser QA additionally uses generated audio without opening the physical microphone.

## Concert background question

The user asked about stock concert photos/videos **as a future possibility only**. No media was fetched, bundled or implemented. A later version could assign licensed imagery or muted inline loops by song theme, darken them behind the highway, and provide a simple off switch/static fallback. Mobile bandwidth, battery and autoplay behavior need consideration. References: [Pexels licensing](https://www.pexels.com/license/), [muted inline autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).

No database schema, persistent volume or Railway variable changes are needed. Preserve school accounts, music, revisions and the current volume.
