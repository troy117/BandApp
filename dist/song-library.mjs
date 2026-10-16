// Files live in IndexedDB on this origin. List views read only small metadata records.
export class SongLibrary {
  constructor(factory = globalThis.indexedDB) { this.factory = factory; this.connection = null; }
  async open() {
    if (!this.factory) throw new Error('Song storage is unavailable in this browser. You can still import and play files for this visit.');
    if (!this.connection) {
      this.connection = new Promise((resolve, reject) => {
        const request = this.factory.open('groove-lab-library', 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('songs', { keyPath: 'id' });
          request.result.createObjectStore('files', { keyPath: 'id' });
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); this.connection = null; };
          resolve(db);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Close other Groove Lab tabs and try the library again.'));
      }).catch(error => { this.connection = null; throw error; });
    }
    return this.connection;
  }
  async transact(stores, mode, work) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result;
      tx.oncomplete = () => resolve(typeof result === 'function' ? result() : result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('The song could not be saved.'));
      try { result = work(tx); }
      catch (error) { tx.abort(); reject(error); }
    });
  }
  async list(archived = false) {
    return this.transact(['songs'], 'readonly', tx => {
      const request = tx.objectStore('songs').getAll();
      return () => request.result.filter(song => Boolean(song.archived) === archived).sort((a, b) => b.savedAt - a.savedAt);
    });
  }
  async get(id) {
    return this.transact(['songs', 'files'], 'readonly', tx => {
      const meta = tx.objectStore('songs').get(id);
      const files = tx.objectStore('files').get(id);
      return () => meta.result && files.result ? { ...meta.result, ...files.result } : null;
    });
  }
  async save(draft, chart) {
    if (!(draft.midiBytes instanceof ArrayBuffer) || !draft.midiBytes.byteLength) throw new Error('Reimport the MIDI before saving this song.');
    const id = draft.libraryId || globalThis.crypto.randomUUID();
    const meta = { id, title: draft.song.title, fileName: draft.song.fileName, audioName: draft.audioName, duration: chart.duration, notes: chart.notes.length, savedAt: Date.now(), bytes: draft.midiBytes.byteLength + (draft.audioBytes?.byteLength || 0) };
    await this.transact(['songs', 'files'], 'readwrite', tx => {
      tx.objectStore('songs').put(meta);
      tx.objectStore('files').put({ id, midiBytes: draft.midiBytes, audioBytes: draft.audioBytes || null, selected: [...draft.selected], mapping: { ...draft.mapping }, offset: draft.offset, timeScale: draft.timeScale ?? 1, volume: draft.volume });
    });
    return id;
  }
  async archive(id, archived = true) {
    await this.transact(['songs', 'files'], 'readwrite', tx => {
      const store = tx.objectStore('songs');
      const request = store.get(id);
      request.onsuccess = () => { if (request.result) store.put({ ...request.result, archived }); };
    });
  }
}
