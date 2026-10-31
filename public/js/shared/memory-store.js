// In-memory table store with the same interface as the Google Sheets driver.
// Used by the local dev server (no Google account needed) and by the browser demo,
// which passes `persist` to save into localStorage.
import { SHEETS, encodeRow, decodeRow } from './schema.js';

export function createMemoryStore({ load, persist, label = 'memory' } = {}) {
  let tables = {};
  try { tables = (load && load()) || {}; } catch { tables = {}; }
  for (const key of Object.keys(SHEETS)) if (!Array.isArray(tables[key])) tables[key] = [];
  const save = () => { if (persist) { try { persist(tables); } catch { /* storage full or blocked: keep working in memory */ } } };

  return {
    label,
    async list(key) { return tables[key].map((r) => decodeRow(key, r)); },
    async get(key, id) { const r = tables[key].find((x) => x.id === id); return r ? decodeRow(key, r) : null; },
    async insert(key, obj) { tables[key].push(encodeRow(key, obj)); save(); return obj; },
    async insertMany(key, objs) { for (const o of objs) tables[key].push(encodeRow(key, o)); save(); return objs.length; },
    async update(key, id, patch) {
      const i = tables[key].findIndex((x) => x.id === id);
      if (i < 0) return null;
      const merged = { ...decodeRow(key, tables[key][i]), ...patch, id };
      tables[key][i] = encodeRow(key, merged);
      save();
      return merged;
    },
    async remove(key, id) {
      const before = tables[key].length;
      tables[key] = tables[key].filter((x) => x.id !== id);
      save();
      return tables[key].length < before;
    },
    async count(key) { return tables[key].length; },
    reset() { tables = {}; for (const key of Object.keys(SHEETS)) tables[key] = []; save(); },
  };
}
