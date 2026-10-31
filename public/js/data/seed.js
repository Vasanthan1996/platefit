// Default data bundled with the app. The API serves it until the Google Sheet is seeded,
// and `npm run setup:sheets` (or Admin > Content > Seed data) copies it into the sheet.
import { RECIPES } from './recipes/index.js';
import { INGREDIENTS } from './ingredients.js';
import { MEAL_PLANS, DEFAULT_TARGETS } from './plans.js';

export const DEFAULT_CONTENT = {
  siteName: 'PlateFit',
  heroTitle: 'Eat to the plan. Train to the plan.',
  heroSubtitle: 'Your trainer’s low-carb, high-protein week turned into 55 step-by-step South Indian recipes, a daily tracker and progress charts.',
  announcement: 'New: cook mode with step timers on every recipe.',
  trainerNote: 'Try this at home, and you will see good results in 30 to 60 days.',
  contactEmail: 'hello@platefit.app',
};

export const SEED = {
  recipes: RECIPES,
  ingredients: INGREDIENTS,
  mealPlans: MEAL_PLANS,
  content: DEFAULT_CONTENT,
  targets: DEFAULT_TARGETS,
};
