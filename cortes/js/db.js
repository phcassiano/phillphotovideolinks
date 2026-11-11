// IndexedDB mínimo: guarda os vídeos gerados e o estado do projeto no próprio navegador.
const NOME = "cortes-db";
let dbp = null;

const abrir = () =>
  (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(NOME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("renders")) db.createObjectStore("renders", { keyPath: "id" });
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));

const tx = async (store, mode, fn) => {
  const db = await abrir();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
};

export const db = {
  async put(store, value, key) {
    try { return await tx(store, "readwrite", (s) => (key === undefined ? s.put(value) : s.put(value, key))); } catch (e) { console.warn("db.put", e); }
  },
  async get(store, key) {
    try { return await tx(store, "readonly", (s) => s.get(key)); } catch { return undefined; }
  },
  async all(store) {
    try { return await tx(store, "readonly", (s) => s.getAll()); } catch { return []; }
  },
  async del(store, key) {
    try { return await tx(store, "readwrite", (s) => s.delete(key)); } catch {}
  },
  async clear(store) {
    try { return await tx(store, "readwrite", (s) => s.clear()); } catch {}
  },
};
