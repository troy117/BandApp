# Roland TD-17 USB setup

Version 0.9 / Prototype 09 introduces drumkit input. The input and learning logic have automated tests; physical TD-17 operation and latency still need the user's check on Windows Chrome.

1. Turn on the TD-17 and connect its **USB COMPUTER** port to the computer with a USB data cable.
2. Open Groove Lab in **Chrome** at its HTTPS Railway address, or at localhost for local development. Confirm the footer says **Prototype 09** or later. If Railway still serves an older version, deploy the latest GitHub commit and refresh.
3. Choose **Connect drumkit** in the header, or **Controls → Connect drumkit**. Allow MIDI device access if Chrome asks. Select **TD-17** in the Drumkit list; the name may vary with the driver.
4. Strike each pad. The readout should show **Kick**, **Snare**, **Closed hi-hat**, **Open hi-hat**, **Pedal hi-hat**, the toms, **Crash** or **Ride**, along with note number and strength. Check open/closed hi-hat, pedal, cymbal edges/bell and snare rim too. The hi-hat defaults follow Roland's TD-17 map; custom module settings still need checking.
5. If a pad is wrong or unassigned, open **Check or change pad assignments**. Choose **Learn pad** beside the correct drum and strike it once. Repeat to add rims/edges. Learning moves a note from its previous assignment. Select its **×** chip to ignore it. Escape or Cancel learning cancels; **Restore drumkit assignments** restores defaults.
6. Choose **Done**, choose a simple practice track and click **Start groove**. Play after the count-in. Kit hits use the same timing/scoring as keyboard hits in the highway, sheet and fullscreen score. Enter starts/stops; keyboard pads remain usable.

## If no device appears

On the module, **SETUP → USB → USB Driver Mode → GENERIC**, then turn it off/on. Roland documents GENERIC as operating-system-driver MIDI only; VENDOR uses Roland's driver for MIDI plus USB audio. If Windows already detects the kit in VENDOR mode, you can keep that setup. [Roland TD-17 Data List, USB settings, page 16](https://static.roland.com/assets/media/pdf/TD-17_DataList_eng01_W.pdf).

Check the USB COMPUTER port, cable and direct computer connection. Close other music apps/tabs that may hold the MIDI port, then try **Connect drumkit** again. With the app open, reconnecting the selected kit attempts to restore it. If it is unplugged during a run, the run stops without saving a completed result. After a page reload, choose Connect drumkit again; permission is never requested automatically.

If the device connects but no hits arrive, check **SETUP → MIDI → MIDI Tx/Rx Sw = ON** on the module. Groove Lab listens for note-on hits from every channel on the selected input, so channel 10 is not required. Keep Local Control on to hear the module's own drums. [Roland MIDI settings, page 15](https://static.roland.com/assets/media/pdf/TD-17_DataList_eng01_W.pdf).

If Chrome blocks access, allow MIDI devices in that site's settings and retry. School-managed Chrome may need administrator permission. Web MIDI requires a secure context and explicit permission; keyboard practice remains available when it is unavailable. [Web MIDI permission and security requirements](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMIDIAccess).

## Sounds and timing

**Play app drum sounds for drumkit hits** defaults off. Use the TD-17's own sounds for immediate feedback; leave its Local Control on. Switching app sounds on adds the app's synthesized drums. Keyboard and on-screen pads still play app sounds. Incoming velocity changes app sound level and the pad test readout, but is not graded.

Backing recordings, guide drums and metronome play through the computer's selected audio output. **GENERIC does not carry computer audio to the TD-17 over USB.** To hear both sources in one set of headphones, use a suitable existing computer-to-module MIX IN connection or a correctly configured VENDOR USB audio setup. The app does not choose or configure Windows audio devices. Use wired audio for timing practice.

Start with **Input delay correction = 0 ms**. If hits consistently grade late after you have checked the audible beat, a small positive correction subtracts that device delay. This is manual; there is no automatic hardware calibration yet.

Prototype 29 separates closed, open and pedal hi-hat, with default keys D/E/R and TD-17 notes 42/22, 46/26 and 44. Open and closed hits cannot match one another. MIDI note-off, zero-velocity note-on, clock, CC4 pedal-position and choke messages do not create strikes. Continuous hi-hat openness, cymbal choking and expressive hit strength are not graded. See [hi-hat mapping compatibility and the physical kit check](DRUM_REPORTS_AND_HIHAT.md).

Pad assignments, preferred device and app-sound preference save locally in this browser, separately from keyboard bindings, imported-song note assignments and school accounts. They do not travel through GitHub or student accounts. Only the selected input is listened to; no MIDI output or system-exclusive access is requested.
