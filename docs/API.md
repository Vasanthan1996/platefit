# API reference

Base path: `/api/v1`. JSON in, JSON out. The session lives in an HttpOnly `pf_session` cookie set by login or registration (API clients may send `Authorization: Bearer <token>` instead). Every request other than GET must include `X-Requested-With: PlateFit`.

Errors look like `{ "error": "Message", "fields": { "email": "Enter a valid email..." } }` with status 400 (validation), 401 (sign in), 403 (not allowed), 404, 409 (duplicate), 429 (rate limit) or 500.

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `health` | `{ ok, mode: google|memory, sheets }` |
| GET | `config` | GA id, site URL, whether email is enabled |
| GET | `recipes` | Published recipes |
| GET | `recipes/:id` | One recipe |
| GET | `ingredients` | Ingredient library |
| GET | `meal-plans` | All plans |
| GET | `content` | Site text |
| POST | `feedback` | `{ rating 1-5, message?, recipeId?, name?, email? }` |
| POST | `contact` | `{ name, email, subject?, message }` |
| POST | `analytics/events` | `{ events: [{ event, path, recipeId, planId, query, results, sessionId, visitorId, returning, device, referrer }] }`, max 50 |

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `auth/register` | `{ name, email, password, goal? }`; password 8+ with a letter and a number |
| POST | `auth/login` | `{ identifier, password }`; identifier is an email, or the admin username |
| POST | `auth/logout` | Clears the cookie |
| GET | `auth/session` | `{ user }` or `{ user: null }` |
| GET | `auth/me` | Signed-in user (401 if not) |
| PUT | `auth/me` | `{ name?, goal?, heightCm?, weightKg?, targetWeightKg?, targets?: { calories, protein, carbs, fat, water } }` |
| POST | `auth/password` | `{ current, next }` |
| POST | `auth/forgot` | `{ email }`; always the same reply so emails cannot be probed |
| POST | `auth/reset` | `{ token, password }`; token valid 1 hour, single use |

## Signed-in member

| Method | Path | Notes |
|---|---|---|
| PUT | `me/favourites` | `{ ids: [recipeId] }` |
| PUT | `me/plans` | `{ plans: [{ id, name, basePlanId, custom?, active }] }` |
| GET | `logs?from=YYYY-MM-DD&to=YYYY-MM-DD` | Own meal, water and weight entries |
| POST | `logs` | Meal: `{ type:"meal", date, slot, recipeId, servings }` (macros computed on the server) or a custom food `{ type:"meal", date, slot, recipeName, calories, protein, carbs, fat }`. Water: `{ type:"water", date, value: litres }`. Weight: `{ type:"weight", date, value: kg }` |
| PUT | `logs/:id` | Same fields |
| DELETE | `logs/:id` | |

## Admin

| Method | Path | Notes |
|---|---|---|
| GET | `admin/summary?days=30` | Totals, daily/weekly/monthly series, top recipes, searches, plans, pages, devices, referrers |
| GET | `admin/users` | |
| PUT | `admin/users/:id` | `{ name?, role?: user|admin, status?: active|disabled }` |
| DELETE | `admin/users/:id` | |
| POST | `admin/users/:id/password` | `{ password }` |
| GET/POST | `admin/recipes` | Create takes the recipe object (see `docs/RECIPES.md` for fields) |
| PUT/DELETE | `admin/recipes/:id` | |
| GET/POST, PUT/DELETE | `admin/ingredients`, `admin/ingredients/:id` | |
| GET/POST, PUT/DELETE | `admin/meal-plans`, `admin/meal-plans/:id` | |
| GET/PUT | `admin/content` | `{ content: { key: value } }` |
| GET | `admin/feedback`, `admin/contact` | |
| PUT | `admin/feedback/:id`, `admin/contact/:id` | `{ status: new|reviewed|resolved }` |
| DELETE | `admin/feedback/:id`, `admin/contact/:id` | |
| GET | `admin/activity?limit=300` | Audit log, newest first |
| GET | `admin/export/:sheet` | `users, recipes, ingredients, mealPlans, feedback, activity, analytics, contact, mealLogs, content`; private columns removed |
| POST | `admin/seed` | Adds missing built-in recipes, ingredients, plans and content rows |

Every create, update and delete writes a row to **User Activity** with the user, action, item, IP and browser.
