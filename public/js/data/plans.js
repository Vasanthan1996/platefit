// Daily time slots and the two meal plans built from the trainer's document.

export const SLOTS = [
  { id: 'early-morning', time: '6:30 AM', label: 'Wake-up drink', window: '6:30–7:00 AM' },
  { id: 'breakfast', time: '8:30 AM', label: 'Breakfast', window: '8:30–9:30 AM' },
  { id: 'mid-morning', time: '11:00 AM', label: 'Salad bowl', window: '11:00 AM' },
  { id: 'lunch', time: '1:00 PM', label: 'Lunch', window: '1:00–2:00 PM' },
  { id: 'after-lunch', time: '3:00 PM', label: 'Fruit', window: '3:00–4:00 PM' },
  { id: 'evening', time: '4:30 PM', label: 'Evening snack', window: '4:30–5:00 PM' },
  { id: 'dinner', time: '8:00 PM', label: 'Dinner', window: '8:00–9:00 PM' },
  { id: 'night', time: '9:00 PM', label: 'Bedtime milk', window: '9:00–10:00 PM' },
];
export const SLOT_MAP = Object.fromEntries(SLOTS.map((s) => [s.id, s]));

export const ROUTINE = {
  wake: '5:00 AM',
  sleep: '10:30 PM',
  water: '3–3.5 litres',
  resultWindow: '30 to 60 days',
};

export const DEFAULT_TARGETS = { calories: 2200, protein: 140, carbs: 280, fat: 60, water: 3.5 };

const x = (id, extra = {}) => ({ id, portion: 1, ...extra });
const opt = (id, note) => ({ id, portion: 1, optional: true, note });

const wake = [x('green-tea', { alternatives: ['lemongrass-tea', 'black-coffee'] })];
const night = [x('low-fat-milk')];
const nightEggs = opt('egg-whites', 'Only if your trainer confirms');

const day = (key, label, chicken, slots) => ({ key, label, chicken, slots: { 'early-morning': wake, night, ...slots } });

export const MEAL_PLANS = [
  {
    id: 'high-protein-week',
    name: '7-Day Low-Carb, High-Protein Week',
    summary: 'Your trainer’s plan with the confirmed protein: 2 egg whites at breakfast, 250 g chicken and 2 eggs at lunch, and 2 egg whites at night if confirmed.',
    goal: 'Fat loss while building muscle',
    level: 'Gym, 5–6 days a week',
    duration: '7 days, repeat for 30–60 days',
    color: '#1F6B45',
    featured: true,
    days: [
      day('mon', 'Monday', 'Grilled', {
        breakfast: [x('idli'), x('egg-whites'), x('guava')],
        'mid-morning': [x('salad-cucumber-carrot-tomato')],
        lunch: [x('white-rice-plate'), x('beans-poriyal'), x('arai-keerai-poriyal'), x('grilled-chicken'), x('boiled-eggs')],
        'after-lunch': [x('grapes')],
        evening: [x('chana-sundal')],
        dinner: [x('chapati'), x('moong-dal'), nightEggs],
      }),
      day('tue', 'Tuesday', 'Pepper', {
        breakfast: [x('wheat-dosa'), x('egg-whites'), x('apple')],
        'mid-morning': [x('salad-sprouts')],
        lunch: [x('mapillai-samba-rice'), x('cabbage-poriyal'), x('pepper-chicken'), x('boiled-eggs')],
        'after-lunch': [x('pineapple')],
        evening: [x('guava')],
        dinner: [x('plain-dosa'), x('mint-chutney'), nightEggs],
      }),
      day('wed', 'Wednesday', 'Curry', {
        breakfast: [x('idli'), x('egg-whites'), x('papaya')],
        'mid-morning': [x('salad-beetroot-carrot-cabbage')],
        lunch: [x('white-rice-plate'), x('drumstick-sambar'), x('murungai-keerai-poriyal'), x('chicken-curry'), x('boiled-eggs')],
        'after-lunch': [x('grapes')],
        evening: [x('peas-sundal')],
        dinner: [x('chapati'), x('veg-kurma'), nightEggs],
      }),
      day('thu', 'Thursday', 'Tandoori', {
        breakfast: [x('wheat-dosa'), x('egg-whites'), x('orange')],
        'mid-morning': [x('salad-cucumber-capsicum-tomato')],
        lunch: [x('mapillai-samba-rice'), x('avarakkai-poriyal'), x('tandoori-chicken'), x('boiled-eggs')],
        'after-lunch': [x('pineapple')],
        evening: [x('black-chana-sundal')],
        dinner: [x('plain-dosa'), x('tomato-chutney'), nightEggs],
      }),
      day('fri', 'Friday', 'Pepper fry', {
        breakfast: [x('idli'), x('egg-whites'), x('guava')],
        'mid-morning': [x('salad-kosambari')],
        lunch: [x('white-rice-plate'), x('vendakkai-poriyal'), x('palak-keerai'), x('chicken-pepper-fry'), x('boiled-eggs')],
        'after-lunch': [x('grapes')],
        evening: [x('guava')],
        dinner: [x('chapati'), x('moong-dal'), nightEggs],
      }),
      day('sat', 'Saturday', 'Grilled', {
        breakfast: [x('wheat-dosa'), x('egg-whites'), x('papaya')],
        'mid-morning': [x('salad-sprouts-cabbage-carrot')],
        lunch: [x('mapillai-samba-rice'), x('beans-poriyal'), x('grilled-chicken'), x('boiled-eggs')],
        'after-lunch': [x('pineapple')],
        evening: [x('karamani-sundal')],
        dinner: [x('plain-dosa'), x('veg-sambar'), nightEggs],
      }),
      day('sun', 'Sunday', 'Salna', {
        breakfast: [x('idli'), x('egg-whites'), x('apple')],
        'mid-morning': [x('salad-cucumber-beetroot-mint')],
        lunch: [x('white-rice-plate'), x('mixed-veg-poriyal'), x('siru-keerai-poriyal'), x('chicken-salna'), x('boiled-eggs')],
        'after-lunch': [x('grapes')],
        evening: [x('guava')],
        dinner: [x('chapati'), x('veg-kurma'), nightEggs],
      }),
    ],
  },
  {
    id: 'trainer-original',
    name: 'Trainer’s Low-Carb Day (Original)',
    summary: 'The original one-page plan from your trainer, exactly as written, with the choices for each time slot.',
    goal: 'Low-carb fat loss',
    level: 'Any',
    duration: 'Daily template; results in 30–60 days',
    color: '#9A5B00',
    featured: false,
    days: [
      {
        key: 'any',
        label: 'Every day',
        chicken: null,
        slots: {
          'early-morning': [x('green-tea', { alternatives: ['lemongrass-tea', 'black-coffee'] })],
          breakfast: [x('idli', { alternatives: ['wheat-dosa'] }), x('guava', { alternatives: ['apple', 'papaya', 'orange'], note: 'Any one fruit' }), x('boiled-eggs', { portion: 0.5, note: 'One whole egg' })],
          'mid-morning': [x('salad-cucumber-carrot-tomato', { note: 'Vegetable salad and fruits 250 g' })],
          lunch: [x('white-rice-plate', { note: '30% white rice, 70% vegetables', alternatives: ['mapillai-samba-rice'] }), x('beans-poriyal', { note: 'Vegetables' }), x('palak-keerai', { note: 'Any spinach' }), x('boiled-eggs', { portion: 0.5, note: 'Egg 1 (white and yellow) with the brown-rice option' })],
          'after-lunch': [x('grapes', { alternatives: ['pineapple'] })],
          evening: [x('multi-sundal', { alternatives: ['guava'] })],
          dinner: [x('chapati', { alternatives: ['plain-dosa'] }), x('egg-whites', { portion: 0.5, note: '1 egg white' })],
          night: [x('low-fat-milk', { note: 'Avoid white sugar' })],
        },
      },
    ],
  },
];

export const PLAN_MAP = Object.fromEntries(MEAL_PLANS.map((p) => [p.id, p]));
export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
