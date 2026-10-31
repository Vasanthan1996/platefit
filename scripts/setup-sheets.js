// Creates every tab with its header row in your Google Sheet and seeds recipes,
// ingredients, meal plans and site content. Safe to run more than once.
//   npm run setup:sheets
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.js';
import { createSheetsStore, readServiceAccount } from '../api/_lib/google-sheets.js';
import { SEED } from '../public/js/data/seed.js';
import { recipeToRow } from '../public/js/shared/schema.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);

const account = readServiceAccount(process.env);
if (!process.env.GOOGLE_SHEET_ID || !account) {
  console.error('Missing GOOGLE_SHEET_ID and service account credentials. Copy .env.example to .env and fill them in (see README, step 2).');
  process.exit(1);
}

const store = createSheetsStore({ sheetId: process.env.GOOGLE_SHEET_ID, account, cacheMs: 0 });
console.log('Checking tabs and header rows...');
const { created, headerFixes } = await store.setup();
console.log(created.length ? `Created tabs: ${created.join(', ')}` : 'All tabs already exist.');
if (headerFixes.length) console.log(`Header rows written: ${headerFixes.join(', ')}`);

const now = new Date().toISOString();
const seedSets = [
  ['recipes', SEED.recipes.map(recipeToRow)],
  ['ingredients', SEED.ingredients],
  ['mealPlans', SEED.mealPlans],
  ['content', Object.entries(SEED.content).map(([id, value]) => ({ id, value }))],
];
for (const [key, rows] of seedSets) {
  const have = new Set((await store.list(key)).map((r) => r.id));
  const missing = rows.filter((r) => !have.has(r.id)).map((r) => ({ ...r, createdAt: now, updatedAt: now }));
  if (missing.length) await store.insertMany(key, missing);
  console.log(`${key}: ${missing.length} added, ${have.size} already present`);
}
console.log('Done. Your Google Sheet is ready.');
