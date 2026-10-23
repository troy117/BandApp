# Phone practice and teacher dashboard

Prototype 18 / 0.18.0, October 23, 2026.

## Students

On small screens the instrument menu sits beside Song library and the account button. Selecting an instrument closes the menu. The account's default instrument still opens after sign-in. An assigned active jam adds a Join jam button to the same menu; a single invitation opens the assigned part directly. Invitations refresh every ten seconds while the page is visible.

For vocals, the Practice song dropdown sits beside Focus view. Background volume is immediately below the microphone controls and changes only the backing mix. The melody-guide sound retains its own existing control under Melody & sheet music. Enter Focus view and rotate the phone: Pitch highway fills the available middle area, with Target / You and a high/center/low meter on the far right. Large lyrics uses the same space and keeps that meter visible. Song, microphone, backing volume, display choice and transport stay inside focus view. A teacher-led session keeps song and transport controls locked to the teacher.

Other band instruments also have a song dropdown inside fullscreen. Solo drums moves its existing track selector into the fullscreen toolbar, including available school drum songs. Stop a solo drum run before changing tracks. Selecting a new band song stops the current solo run and retains focus view.

Focus/fullscreen requests the browser's screen wake lock and shows Screen awake when held. Exiting releases it; returning to a visible page requests it again. A browser or phone can deny/release it, for example under power-saving settings. In that case the screen says Screen may sleep and practice remains usable. This does not override the physical power button or keep a background tab active. See the [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

## Teachers

Choosing a student for a new jam selects a matching part for their default instrument when the song offers one. Teachers can still choose another part. If the default instrument is absent, an available part is used; check the assignment before creating the session.

The teacher's Jam screen contains session controls and Live class meters instead of a Band practice panel. Drum/keyboard meters use accuracy on notes judged so far, matched/missed counts and best streak. Guitar and bass show unscored participation/progress. Vocals show current guidance, such as On pitch, Sing higher or Sing lower, only while that participant is connected and playing. These are compact live cards, not streamed student screens.

Microphone audio never leaves the student's device. During an active jam, only the current vocal guidance state and cents deviation go through the existing authenticated session to that student's teacher. The microphone notice explains this before use. Values are validated, omitted for other instruments and held in memory only. They are not audio, recordings, saved voice history or vocal grades. Solo feedback stays on the device. Student room responses still contain only their own participant.

Recent shared takes offers Delete take. This hides a teacher's own take from the recent list, while preserving each student's results and reports. Use Deleted takes > Restore take to recover it. A playing take must be stopped first. The tombstone uses the existing settings table and an audit entry; no schema or Railway configuration change is required.

## Verification

Automated checks cover wake-lock lifecycle, pending grants, denial, default-part matching, class-meter semantics, escaping, live voice validation/teacher relay, student isolation and teacher-owned delete/restore with preserved results. Browser trials use isolated synthetic accounts and original music to check portrait/landscape layouts, song switching inside focus, backing volume, actual browser wake-lock status, default assignments, live cards and delete/restore. Physical iPhone/Android screen sleep and microphone testing remains a classroom check. Existing school music, lyrics, revisions, accounts and mounted storage are retained.
