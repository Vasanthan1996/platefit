// schema.org markup shared by the app and the build script (prerendered recipe pages).
const iso = (m) => {
  if (m === null || m === undefined) return undefined;
  const s = `PT${Math.floor(m / 60) ? `${Math.floor(m / 60)}H` : ''}${m % 60 ? `${m % 60}M` : ''}`;
  return s === 'PT' ? 'PT0M' : s;
};

export function recipeJsonLd(r, url) {
  const n = r.nutrition;
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.name,
    alternateName: r.local || undefined,
    description: r.summary,
    url,
    recipeCategory: r.mealType,
    recipeCuisine: 'South Indian',
    keywords: r.tags.join(', '),
    prepTime: iso(r.prep),
    cookTime: iso(r.cook),
    totalTime: iso((r.prep || 0) + (r.cook || 0)),
    recipeYield: r.serving,
    nutrition: {
      '@type': 'NutritionInformation',
      calories: n.calories !== null ? `${n.calories} kcal` : undefined,
      proteinContent: n.protein !== null ? `${n.protein} g` : undefined,
      carbohydrateContent: n.carbs !== null ? `${n.carbs} g` : undefined,
      fatContent: n.fat !== null ? `${n.fat} g` : undefined,
      fiberContent: n.fibre !== null ? `${n.fibre} g` : undefined,
      servingSize: r.serving,
    },
    recipeIngredient: r.ingredients.map((i) => `${i.qty} ${i.name}${i.note ? ` (${i.note})` : ''}`),
    recipeInstructions: r.steps.map((s) => ({ '@type': 'HowToStep', name: s.title, text: s.text })),
  };
}
