// Explicit, device-local saves. Separate database: no school records or song-library migration.
export class BeatLibrary {
  constructor(factory = globalThis.indexedDB) { this.factory = factory; this.connection = null; }
  async open() {
    if (!this.factory) throw new Error('Device storage is unavailable. Keep this tab open to use your take.');
    if (!this.connection) this.connection = new Promise((resolve, reject) => {
      const request = this.factory.open('groove-lab-beats', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('takes', { keyPath: 'id' });
        request.result.createObjectStore('audio', { keyPath: 'id' });
      };
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); this.connection = null; }; resolve(db); };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other Groove Lab tabs, then try saving again.'));
    }).catch(error => { this.connection = null; throw error; });
    return this.connection;
  }
  async transact(mode, work) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['takes', 'audio'], mode); let result;
      tx.oncomplete = () => resolve(result());
      tx.onerror = tx.onabort = () => reject(new Error('Device storage could not be updated. Your current take is still available for this visit.'));
      try { result = work(tx); } catch (error) { tx.abort(); reject(error); }
    });
  }
  list() { return this.transact('readonly', tx => { const r = tx.objectStore('takes').getAll(); return () => r.result.sort((a,b) => b.savedAt - a.savedAt); }); }
  get(id) { return this.transact('readonly', tx => { const take = tx.objectStore('takes').get(id), audio = tx.objectStore('audio').get(id); return () => take.result && audio.result ? { ...take.result, bytes: audio.result.bytes } : null; }); }
  save(take, source, name) {
    return this.transact('readwrite', tx => {
      tx.objectStore('takes').put({ id: take.id, name: name.trim().slice(0,100) || source.name, fileName: source.name, savedAt: Date.now(), take });
      tx.objectStore('audio').put({ id: take.id, bytes: source.bytes });
      return () => take.id;
    });
  }
  remove(id) { return this.transact('readwrite', tx => { tx.objectStore('takes').delete(id); tx.objectStore('audio').delete(id); return () => id; }); }
}
