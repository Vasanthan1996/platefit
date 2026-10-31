// Every ingredient used across the plan. `shape` drives the built-in illustration;
// `local` is the Tamil name used in Tamil Nadu kitchens.
// Photo slot: /images/ingredients/<id>.jpg (or .webp/.png) replaces the illustration when present.

export const INGREDIENT_TYPES = {
  vegetable: 'Vegetables',
  greens: 'Greens & herbs',
  fruit: 'Fruits',
  pulse: 'Pulses & sprouts',
  grain: 'Grains & flours',
  protein: 'Eggs & chicken',
  dairy: 'Dairy',
  spice: 'Spices & seasoning',
  oil: 'Oils',
  'seed-nut': 'Seeds & nuts',
  beverage: 'Beverage bases',
};

const I = (id, name, local, type, shape, color, color2, benefit) =>
  ({ id, name, local, type, shape, color, color2, benefit });

export const INGREDIENTS = [
  // Vegetables
  I('cucumber', 'Cucumber', 'Vellarikkai', 'vegetable', 'long', '#5E9B3A', '#C9E4A6', 'About 95% water; keeps you hydrated with almost no calories.'),
  I('carrot', 'Carrot', 'Carrot', 'vegetable', 'long', '#E8771E', '#FFB46B', 'Beta-carotene for eyes and skin; adds crunch and fibre.'),
  I('tomato', 'Tomato', 'Thakkali', 'vegetable', 'round', '#D93A2B', '#FF8A72', 'Lycopene and vitamin C; gives sourness without extra oil.'),
  I('cabbage', 'Cabbage', 'Muttaikose', 'vegetable', 'head', '#8DBE5A', '#E1F0C4', 'High volume, low calorie; vitamin C and K.'),
  I('beetroot', 'Beetroot', 'Beetroot', 'vegetable', 'bulb', '#8E1F4A', '#D2557F', 'Natural nitrates that support blood flow during workouts.'),
  I('capsicum', 'Green capsicum', 'Kudai milagai', 'vegetable', 'round', '#3F8F2F', '#9BD27F', 'Very rich in vitamin C; crisp and filling.'),
  I('onion', 'Onion', 'Periya vengayam', 'vegetable', 'bulb', '#B5577A', '#F0B6C9', 'Adds flavour and prebiotic fibre.'),
  I('shallots', 'Small onions (shallots)', 'Chinna vengayam', 'vegetable', 'bulb', '#A44866', '#E7A2B6', 'Traditional sambar and salna flavour base.'),
  I('beans', 'French beans', 'Beans', 'vegetable', 'long', '#4F9A3B', '#A9D88A', 'Fibre and folate with very few calories.'),
  I('avarakkai', 'Broad beans (flat beans)', 'Avarakkai', 'vegetable', 'pod', '#6DAA45', '#C3E3A3', 'Plant protein and fibre; keeps you full.'),
  I('okra', 'Okra (lady’s finger)', 'Vendakkai', 'vegetable', 'long', '#3E8A35', '#8FCB76', 'Soluble fibre that helps steady blood sugar.'),
  I('drumstick', 'Drumstick', 'Murungakkai', 'vegetable', 'long', '#557C2F', '#A6C46F', 'Calcium, iron and vitamin C; classic sambar vegetable.'),
  I('mixed-veg', 'Mixed vegetables (carrot, beans, cabbage, peas)', 'Kalandha kaikari', 'vegetable', 'grain', '#E8771E', '#4F9A3B', 'Variety of vitamins and fibre in one portion.'),
  I('green-chilli', 'Green chilli', 'Pachai milagai', 'vegetable', 'long', '#2F8A2A', '#7FCB5F', 'Heat and vitamin C; use to taste.'),
  I('dry-red-chilli', 'Dry red chilli', 'Kaindha milagai', 'spice', 'long', '#B3261E', '#E5594A', 'Tempering heat for poriyal and sambar.'),
  I('ginger', 'Ginger', 'Inji', 'vegetable', 'root', '#C9A15B', '#EBD3A0', 'Aids digestion; warming flavour.'),
  I('garlic', 'Garlic', 'Poondu', 'vegetable', 'bulb', '#D8CFC0', '#F5F0E6', 'Allicin for heart health; deep flavour.'),
  I('ginger-garlic-paste', 'Ginger-garlic paste', 'Inji poondu vizhudhu', 'spice', 'powder', '#C7AE7A', '#EADBB8', 'Base flavour for chicken dishes.'),
  I('lemon', 'Lemon', 'Elumichai', 'fruit', 'round', '#E5C21B', '#FFF07A', 'Vitamin C; brightens salads without oil.'),

  // Greens and herbs
  I('coriander', 'Coriander leaves', 'Kothamalli', 'greens', 'leaf', '#3C8D3A', '#8BD07E', 'Fresh flavour, antioxidants and vitamin K.'),
  I('mint', 'Mint leaves', 'Pudhina', 'greens', 'leaf', '#2E9A63', '#86D9AA', 'Cooling, aids digestion.'),
  I('curry-leaves', 'Curry leaves', 'Karuveppilai', 'greens', 'leaf', '#2C6E2A', '#6FAF55', 'Aroma for tempering; iron and antioxidants.'),
  I('arai-keerai', 'Arai keerai (amaranth greens)', 'Arai keerai', 'greens', 'leaf', '#2F7D32', '#7CC36E', 'Iron and calcium-rich amaranth leaves.'),
  I('murungai-keerai', 'Murungai keerai (drumstick leaves)', 'Murungai keerai', 'greens', 'leaf', '#3D7F24', '#93C96A', 'One of the most nutrient-dense greens: protein, calcium, iron.'),
  I('palak', 'Palak (spinach)', 'Pasalai keerai', 'greens', 'leaf', '#27713A', '#73B983', 'Iron, folate and magnesium.'),
  I('siru-keerai', 'Siru keerai (tropical amaranth)', 'Siru keerai', 'greens', 'leaf', '#4C8A2B', '#9CCB72', 'Light, easy-to-digest greens with iron and fibre.'),
  I('lemongrass', 'Lemongrass', 'Elumichai pul', 'greens', 'long', '#8AAE3B', '#D3E58C', 'Calming herbal tea base; caffeine-free.'),

  // Fruits
  I('guava', 'Guava', 'Koyyappazham', 'fruit', 'round', '#7FB341', '#F3A0A0', 'More vitamin C than an orange; high fibre.'),
  I('apple', 'Apple', 'Apple', 'fruit', 'round', '#C62F2F', '#F27A6A', 'Pectin fibre keeps you full.'),
  I('papaya', 'Papaya', 'Pappaali', 'fruit', 'wedge', '#F08A24', '#FFC27A', 'Papain enzyme aids protein digestion.'),
  I('orange', 'Orange', 'Orange', 'fruit', 'round', '#F28B1D', '#FFC163', 'Vitamin C and hydration.'),
  I('pomegranate', 'Pomegranate', 'Maadhulai', 'fruit', 'round', '#B3203A', '#F06A7F', 'Polyphenols that support recovery.'),
  I('watermelon', 'Watermelon', 'Tharpoosani', 'fruit', 'wedge', '#E8434A', '#5FA846', 'Hydrating; citrulline may ease muscle soreness.'),
  I('grapes', 'Grapes', 'Thiraatchai', 'fruit', 'cluster', '#6A3D9A', '#A97BD6', 'Quick natural energy and antioxidants.'),
  I('pineapple', 'Pineapple', 'Annaasi pazham', 'fruit', 'wedge', '#E8B21E', '#6E9A2E', 'Bromelain enzyme; aids digestion.'),

  // Grains and flours
  I('idli-rice', 'Idli rice (parboiled)', 'Idli arisi', 'grain', 'grain', '#E9DFC8', '#C8B98F', 'Fermented batter is easy to digest.'),
  I('white-rice', 'White rice (sona masoori)', 'Pacharisi / sappadu arisi', 'grain', 'grain', '#F2EEE3', '#CFC6B0', 'Energy for training; keep to the 30% portion.'),
  I('mapillai-samba', 'Mapillai samba rice (red rice)', 'Mapillai samba arisi', 'grain', 'grain', '#8E3B2E', '#C5735E', 'Traditional red rice: more fibre and minerals than white rice.'),
  I('wheat-flour', 'Whole wheat flour (atta)', 'Godhumai maavu', 'grain', 'powder', '#D4B27D', '#EEDDBB', 'Whole-grain fibre and B vitamins.'),
  I('dosa-batter', 'Dosa batter (rice + urad dal, fermented)', 'Dosai maavu', 'grain', 'liquid', '#EFE6D2', '#D3C4A2', 'Fermented: probiotics and easy digestion.'),

  // Pulses and sprouts
  I('urad-dal', 'Whole/split urad dal', 'Ulundhu', 'pulse', 'grain', '#EDE9E0', '#3A3A3A', 'Protein that makes idli soft.'),
  I('toor-dal', 'Toor dal', 'Thuvaram paruppu', 'pulse', 'grain', '#E8B53A', '#F6D98A', 'Plant protein for sambar and dal.'),
  I('moong-dal', 'Moong dal (split, yellow)', 'Paasi paruppu', 'pulse', 'grain', '#F0C93B', '#FBE38D', 'Light, easy-to-digest protein.'),
  I('sprouts', 'Green gram sprouts', 'Mulai kattiya paasi payaru', 'pulse', 'grain', '#7DB04B', '#F3EFD6', 'Sprouting raises vitamin C and makes protein easier to absorb.'),
  I('white-chana', 'White chickpeas (kabuli chana)', 'Vellai kondakadalai', 'pulse', 'grain', '#D9B77C', '#F1DDB3', 'Protein and fibre; very filling.'),
  I('black-chana', 'Black chickpeas (kala chana)', 'Karuppu kondakadalai', 'pulse', 'grain', '#5C3A26', '#94664A', 'Iron, protein and slow-digesting carbs.'),
  I('green-peas', 'Green peas (dried or fresh)', 'Pattani', 'pulse', 'pod', '#5FA83A', '#B3DE8A', 'Protein and fibre for a light sundal.'),
  I('karamani', 'Cowpea (black-eyed peas)', 'Karamani', 'pulse', 'grain', '#E3D2B4', '#2C2C2C', 'Low-fat protein and folate.'),
  I('roasted-gram', 'Roasted gram (split)', 'Pottukadalai', 'pulse', 'grain', '#E8C66E', '#F6E2A6', 'Thickens chutneys with protein instead of coconut.'),
  I('fenugreek', 'Fenugreek seeds', 'Vendhayam', 'seed-nut', 'seed', '#C9932F', '#E9C574', 'Helps fermentation; supports blood sugar control.'),

  // Eggs and chicken
  I('egg', 'Egg (whole)', 'Muttai', 'protein', 'egg', '#F4EEE2', '#F2B630', 'Complete protein with healthy fats.'),
  I('chicken', 'Chicken breast, boneless & skinless', 'Kozhi (elumbillatha)', 'protein', 'meat', '#E9A58C', '#F6CDBA', 'Lean, complete protein for muscle repair.'),

  // Dairy
  I('milk', 'Low-fat milk (toned / double-toned)', 'Kozhuppu kuraindha paal', 'dairy', 'liquid', '#F5F3EE', '#DCD6CA', 'Casein protein and calcium; good before sleep.'),
  I('curd', 'Low-fat curd', 'Thayir', 'dairy', 'liquid', '#F7F5EF', '#E0DAD0', 'Probiotics; tenderises chicken marinades.'),

  // Spices and seasoning
  I('salt', 'Salt', 'Uppu', 'spice', 'powder', '#F2F2F2', '#CFCFCF', 'Use measured amounts; iodised salt preferred.'),
  I('pepper', 'Black pepper (crushed)', 'Milagu', 'spice', 'seed', '#2E2A27', '#6B625B', 'Piperine boosts nutrient absorption.'),
  I('cumin', 'Cumin seeds', 'Seeragam', 'spice', 'seed', '#8C6A3C', '#C49B62', 'Aids digestion.'),
  I('roasted-cumin', 'Roasted cumin powder', 'Varutha seeraga podi', 'spice', 'powder', '#7A5631', '#B2895A', 'Smoky flavour for salads.'),
  I('mustard', 'Mustard seeds', 'Kadugu', 'spice', 'seed', '#3B2A20', '#7D5A42', 'Classic tempering seed.'),
  I('turmeric', 'Turmeric powder', 'Manjal thool', 'spice', 'powder', '#E5A50A', '#F7D25C', 'Curcumin: anti-inflammatory.'),
  I('chilli-powder', 'Red chilli powder', 'Milagai thool', 'spice', 'powder', '#C8402A', '#EB7A5E', 'Heat and colour.'),
  I('kashmiri-chilli', 'Kashmiri chilli powder', 'Kashmiri milagai thool', 'spice', 'powder', '#D2391F', '#F07B5C', 'Bright colour, mild heat.'),
  I('coriander-powder', 'Coriander powder', 'Malli thool', 'spice', 'powder', '#B48A4A', '#DBBE85', 'Earthy body for curries.'),
  I('garam-masala', 'Garam masala', 'Garam masala', 'spice', 'powder', '#7B4A2A', '#B57E52', 'Warm spice blend for chicken.'),
  I('chicken-masala', 'Chicken masala powder', 'Chicken masala thool', 'spice', 'powder', '#93441F', '#CB7849', 'Ready spice blend for curry and salna.'),
  I('chaat-masala', 'Chaat masala', 'Chaat masala', 'spice', 'powder', '#A06B4A', '#D6A27D', 'Tangy salad seasoning with no calories.'),
  I('sambar-powder', 'Sambar powder', 'Sambar podi', 'spice', 'powder', '#B0451E', '#E08350', 'Roasted spice blend for sambar.'),
  I('hing', 'Asafoetida (hing)', 'Perungayam', 'spice', 'powder', '#E8D9B5', '#C9B78C', 'Aids digestion of pulses.'),
  I('fennel', 'Fennel seeds', 'Sombu', 'spice', 'seed', '#7FA04A', '#B8CF7F', 'Sweet aroma typical of salna.'),
  I('cinnamon', 'Cinnamon stick', 'Pattai', 'spice', 'long', '#8A4B2A', '#C07A4E', 'Warm aroma; helps blood sugar control.'),
  I('cloves', 'Cloves', 'Krambu', 'spice', 'seed', '#5A3220', '#8C5A3E', 'Strong aroma; use sparingly.'),
  I('cardamom', 'Green cardamom', 'Elakkai', 'spice', 'pod', '#8BAA5A', '#C5D99A', 'Fragrance for salna.'),
  I('bay-leaf', 'Bay leaf', 'Brinji ilai', 'spice', 'leaf', '#7C8A45', '#B6C27E', 'Background aroma for gravies.'),
  I('tamarind', 'Tamarind', 'Puli', 'spice', 'liquid', '#5B2E1A', '#94593A', 'Sourness for sambar.'),

  // Oils
  I('oil', 'Cold-pressed groundnut or gingelly oil', 'Kadalai ennai / nallennai', 'oil', 'liquid', '#E3B53B', '#F5DA86', 'Measure by teaspoon: 1 tsp is about 40 kcal.'),

  // Seeds and nuts
  I('coconut', 'Fresh grated coconut', 'Thuruviya thengai', 'seed-nut', 'grain', '#F4F0E6', '#8A5A3C', 'Flavour and healthy fats; keep to 1 tablespoon.'),

  // Beverage bases
  I('green-tea', 'Green tea leaves or bag', 'Green tea', 'beverage', 'leaf', '#6F9A3A', '#B9D58A', 'Catechins; light caffeine for the morning.'),
  I('coffee', 'Coffee powder (filter or instant)', 'Kaapi thool', 'beverage', 'powder', '#4A2C1E', '#7E5440', 'Caffeine boosts training energy; no sugar.'),
  I('water', 'Drinking water', 'Kudineer', 'beverage', 'liquid', '#5DB6E8', '#BFE5FA', 'Hydration for training and digestion.'),
];

export const INGREDIENT_MAP = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));
