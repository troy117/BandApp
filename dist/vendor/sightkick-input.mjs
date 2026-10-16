/* Adapted from SightKick (MIT), Anton Korolkov.
 * Upstream 8b43c1018ed15f43166d03725645dcf3cf4295f8:
 * src/renderer/input/keyboard-source.ts and helpers.ts.
 * Changes: plain JS, native timestamps, SELECT protection, injectable target.
 * License: /licenses/sightkick.txt; provenance: THIRD_PARTY_NOTICES.md.
 */
export function makeControlId(sourceId, raw) {
  return `${sourceId}:${raw}`;
}

export function isTypingTarget(target) {
  return Boolean(target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable));
}

export class KeyboardSource {
  id = 'keyboard';
  start(emit, target = window) {
    const handle = event => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      emit({ controlId: makeControlId('keyboard', event.code), value: 127, timestamp: event.timeStamp, nativeEvent: event });
    };
    target.addEventListener('keydown', handle);
    return () => target.removeEventListener('keydown', handle);
  }
  listDevices() {
    return Promise.resolve([{ id: 'keyboard', name: 'Keyboard', sourceId: 'keyboard' }]);
  }
}
