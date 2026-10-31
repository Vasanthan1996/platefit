// Google Sheets layout. Shared by the server (Sheets + local memory store) and the
// browser demo store, so every environment reads and writes the same columns.
// Types: s = string, n = number, b = boolean, j = JSON (stored as text in the cell).

const T = (cols) => cols.split(/\s+/).filter(Boolean).map((c) => {
  const [name, type = 's'] = c.split(':');
  return { name, type };
});

export const SHEETS = {
  users: {
    title: 'Users',
    columns: T(`id name email username passwordHash role status goal heightCm:n weightKg:n targetWeightKg:n
      targets:j favourites:j savedPlans:j resetTokenHash resetExpires lastLoginAt loginCount:n createdAt updatedAt`),
    private: ['passwordHash', 'resetTokenHash', 'resetExpires'],
  },
  recipes: {
    title: 'Recipes',
    columns: T(`id name local category mealType slot summary planNote serving yield:n prep:n cook:n wait difficulty
      calories:n protein:n carbs:n fat:n fibre:n ingredients:j steps:j storage benefits:j tips:j mistakes:j tags:j art:j
      published:b createdAt updatedAt`),
  },
  ingredients: {
    title: 'Ingredients',
    columns: T('id name local type shape color color2 benefit createdAt updatedAt'),
  },
  mealPlans: {
    title: 'Meal Plans',
    columns: T('id name summary goal level duration color featured:b days:j createdAt updatedAt'),
  },
  feedback: {
    title: 'Feedback',
    columns: T('id userId userName email recipeId rating:n message status createdAt updatedAt'),
  },
  activity: {
    title: 'User Activity',
    columns: T('id timestamp userId email action entity entityId details ip userAgent'),
  },
  analytics: {
    title: 'Analytics',
    columns: T('id timestamp event path recipeId planId query results:n userId sessionId visitorId returning:b referrer device'),
  },
  contact: {
    title: 'Contact Form Submissions',
    columns: T('id name email subject message status createdAt updatedAt'),
  },
  mealLogs: {
    title: 'Meal Logs',
    columns: T('id userId date type slot recipeId recipeName servings:n calories:n protein:n carbs:n fat:n value:n createdAt updatedAt'),
  },
  content: {
    title: 'Content',
    columns: T('id value updatedAt'),
  },
};

export const SHEET_KEYS = Object.keys(SHEETS);

// Cell text -> typed value
export function decodeRow(key, row) {
  if (!row) return row;
  const out = {};
  for (const { name, type } of SHEETS[key].columns) {
    const v = row[name];
    if (v === undefined || v === null || v === '') { out[name] = type === 'j' ? null : type === 'b' ? false : type === 'n' ? null : ''; continue; }
    if (type === 'n') { const n = Number(v); out[name] = Number.isFinite(n) ? n : null; }
    else if (type === 'b') out[name] = v === true || v === 'TRUE' || v === 'true' || v === '1' || v === 1;
    else if (type === 'j') { if (typeof v === 'object') out[name] = v; else { try { out[name] = JSON.parse(v); } catch { out[name] = null; } } }
    else out[name] = String(v);
  }
  return out;
}

// Typed value -> cell text (all cells written as plain text, never formulas)
export function encodeRow(key, obj) {
  const out = {};
  for (const { name, type } of SHEETS[key].columns) {
    const v = obj[name];
    if (v === undefined || v === null) { out[name] = ''; continue; }
    if (type === 'j') out[name] = JSON.stringify(v);
    else if (type === 'b') out[name] = v ? 'TRUE' : 'FALSE';
    else out[name] = String(v);
  }
  return out;
}

export function publicRow(key, row) {
  const hidden = SHEETS[key].private || [];
  const out = { ...row };
  for (const h of hidden) delete out[h];
  return out;
}

// Recipe object (as used by pages) <-> Recipes sheet row
export function recipeToRow(r) {
  const n = r.nutrition || {};
  return {
    ...r,
    calories: n.calories, protein: n.protein, carbs: n.carbs, fat: n.fat, fibre: n.fibre,
    published: r.published !== false,
  };
}
export function rowToRecipe(row) {
  const { calories, protein, carbs, fat, fibre, ...rest } = row;
  return {
    ...rest,
    ingredients: row.ingredients || [],
    steps: row.steps || [],
    benefits: row.benefits || [],
    tips: row.tips || [],
    mistakes: row.mistakes || [],
    tags: row.tags || [],
    nutrition: { calories, protein, carbs, fat, fibre, approximate: true },
  };
}

// CSV-safe cell: neutralises spreadsheet formula injection when opened in Excel.
export function safeCell(value) {
  const s = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
