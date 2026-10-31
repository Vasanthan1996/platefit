import fs from 'node:fs';
import { RECIPES, CATEGORIES } from '../public/js/data/recipes/index.js';
import { INGREDIENTS, INGREDIENT_TYPES } from '../public/js/data/ingredients.js';
let md = `# Recipe and ingredient inventory\n\nEvery item from the trainer's plan and the 7-day high-protein week, with its id (used in URLs, photo file names and meal-plan JSON). Nutrition is approximate, per serving.\n\n`;
for (const c of CATEGORIES) {
  const list = RECIPES.filter((r) => r.category === c.id);
  md += `## ${c.label} (${list.length})\n\n| Recipe | Id | Serving | kcal | Protein | Carbs | Fat | From the plan |\n|---|---|---|---:|---:|---:|---:|---|\n`;
  for (const r of list) md += `| ${r.name} | \`${r.id}\` | ${r.serving} | ${r.nutrition.calories} | ${r.nutrition.protein} g | ${r.nutrition.carbs} g | ${r.nutrition.fat} g | ${r.planNote.replace(/\|/g, '/')} |\n`;
  md += '\n';
}
md += `## Ingredients (${INGREDIENTS.length})\n\nPhoto file: \`public/images/ingredients/<id>.jpg\`\n\n| Ingredient | Tamil | Id | Type |\n|---|---|---|---|\n`;
for (const i of INGREDIENTS) md += `| ${i.name} | ${i.local} | \`${i.id}\` | ${INGREDIENT_TYPES[i.type]} |\n`;
fs.writeFileSync(new URL('../docs/RECIPES.md', import.meta.url), md);
console.log('docs/RECIPES.md written');
