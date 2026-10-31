# PlateFit

A nutrition, recipe and meal-tracking web app built from a gym trainer's low-carb, high-protein diet plan. Every food in the plan is a full recipe with quantities, step-by-step instructions, timings, storage, benefits, tips, mistakes to avoid and approximate nutrition. Members follow a 7-day plan, tick off meals, track water and weight, and see daily, weekly and monthly progress. An admin panel manages everything, with Google Sheets as the database.

- **Front end:** HTML5, CSS3 and modern JavaScript (ES modules). No framework, no build step needed to run.
- **Back end:** one Vercel serverless function (Node 18+), no npm dependencies.
- **Database:** Google Sheets through a Google Cloud service account.
- **Hosting:** Vercel, deployed from GitHub.

## What's inside

| Area | Details |
|---|---|
| Recipes | 55 recipes across Breakfast, Lunch, Dinner, Snacks, Salads, Fruits and Beverages; 79 ingredients with Tamil names. Full list in [docs/RECIPES.md](docs/RECIPES.md). |
| Recipe page | Name, picture, calories, protein, carbs, fat, serving size, meal category, prep/cook/wait times, ingredients with a servings scaler, numbered steps with timers, storage, benefits, tips, mistakes, macro chart, rating form. |
| Cook mode | Full-screen walkthrough: one step at a time, progress bar, countdown timers with a sound, swipe and keyboard navigation, screen kept awake, "log this meal" at the end. |
| Meal plans | The 7-day high-protein week (trainer-confirmed eggs and 250 g chicken) and the trainer's original one-page plan. Day tabs, daily totals, weekly chart, swap any dish and save your own version, weekly shopping list. |
| Tracking | One-tap meal check-off against the plan, custom foods, water (+250/+500 ml), body weight, calorie and macro rings, weekly bars, 30-day heat map, streaks, weekly goals, CSV download. |
| Accounts | Register, log in, forgot/reset password (email via Resend), profile, daily targets, favourites, saved plans. |
| Admin | Analytics (page views, visitors, returning rate, top recipes, searches, zero-result searches, popular plans, devices, referrers; daily, weekly and monthly), user management, recipe/ingredient/meal-plan editors, site content, feedback and contact inboxes, activity log, CSV and Excel export. |
| Search | Ctrl/Cmd + K anywhere; filters by meal type, calorie range, protein, carbs, fat and ingredients. |
| SEO | Prerendered recipe, category and plan pages with schema.org Recipe and ItemList markup, Open Graph tags, canonical URLs, sitemap.xml, robots.txt. |
| Analytics | Google Analytics 4 (optional) plus first-party events stored in the Analytics sheet. |
| Design | Light and dark themes, mobile-first layout with bottom tab bar, animated counters, rings, charts, card and page transitions, scroll reveals; respects reduced-motion settings. |

**Nutrition values are estimates.** The trainer's document lists foods and portions but no calories, macros or recipe quantities. Quantities were set to standard home-cooking amounts that fit the plan's portions, and nutrition was estimated per serving from Indian (IFCT 2017) and USDA food-composition data. Every recipe page says so. Edit any number in Admin > Recipes.

**Pictures.** Every recipe and ingredient has a built-in illustration. To use real photos, add `public/images/recipes/<recipe-id>.jpg` (or `.webp`/`.png`) and `public/images/ingredients/<ingredient-id>.jpg`, then build. The photo replaces the drawing automatically. Recipe ids are listed in [docs/RECIPES.md](docs/RECIPES.md).

## Deploy from your browser (no installs)

You only need accounts on GitHub, Vercel and Google. Full click-by-click guide: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

1. **GitHub:** create an empty repository, click **uploading an existing file**, drag in everything inside the `platefit` folder, **Commit changes**.
2. **Vercel:** **Add New > Project**, import the repository, add `ADMIN_PASSWORD`, **Deploy**. The site goes live in preview mode with sample data.
3. **Google Sheet:** create a blank sheet at [sheets.new](https://sheets.new) and copy its address.
4. **Service account:** in Google Cloud, create a project, enable the **Google Sheets API**, create a service account and download its **JSON key**. Share the sheet with the service account email as **Editor**.
5. **Connect:** in Vercel add `GOOGLE_SHEET_ID` (the sheet address) and `GOOGLE_SERVICE_ACCOUNT_JSON` (the whole key file pasted in), then **Redeploy**. The app creates all 10 tabs on its first request.
6. **Load recipes:** sign in at `/login` as `admin`, open **Admin > Content**, click **Set up sheet and load recipes**.

`/api/v1/health` shows `"mode":"google"` when everything is connected. If something is wrong, it and the site's banner say what to fix.

**Preview mode.** When the site cannot reach a configured API (before Google Sheets is connected, or when the files are opened as a static page), the same API runs inside the browser with sample data stored in localStorage, and a banner says so. Once the sheet is connected it never activates.

## Running it on a computer (optional, for developers)

Requirements: Node.js 18.17 or newer.

```bash
cp .env.example .env
npm run dev                 # http://localhost:3000, in-memory data unless Sheets variables are set
```

| Command | What it does |
|---|---|
| `npm run dev` | Local server for `public/` and the API |
| `npm run build` | Builds `dist/` with prerendered SEO pages, sitemap and photo manifest (Vercel runs this) |
| `npm run preview` | Build, then serve `dist/` like Vercel |
| `npm run setup:sheets` | Same as the admin button: creates tabs and loads recipes |
| `npm run hash-password -- "new-password"` | Prints a hash for `ADMIN_PASSWORD_HASH` |
| `npm test` | API, Vercel runtime and Google Sheets driver tests |

## Environment variables

Set these in Vercel > project > **Settings > Environment Variables**, then redeploy.

| Name | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | Yes | Password for the `admin` account (the brief's demo value is `admin@123`; use your own) |
| `GOOGLE_SHEET_ID` | Yes | The sheet's address or just its id |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes | The whole downloaded service-account key file, pasted as one value |
| `ADMIN_USERNAME` | No | Defaults to `admin` |
| `ADMIN_PASSWORD_HASH` | No | Use instead of `ADMIN_PASSWORD` to keep the plain password out of Vercel (`npm run hash-password`) |
| `SITE_URL` | No | Public address for canonical tags, sitemap and reset emails; defaults to the Vercel address |
| `JWT_SECRET` | No | 32+ random characters for signing sessions; if missing, derived from the Google key |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` | No | Alternative to the JSON variable |
| `GA_MEASUREMENT_ID` | No | Google Analytics 4 id (`G-XXXXXXX`) |
| `GOOGLE_SITE_VERIFICATION` | No | Search Console HTML-tag verification code |
| `RESEND_API_KEY` + `MAIL_FROM` | No | Sends password-reset emails. Without it, admins reset passwords in Admin > Users |

## Google Sheets layout

The app creates these tabs with a header row the first time it connects (the admin button and `npm run setup:sheets` do the same). Columns are matched by header name, so you can add your own columns to the right.

| Tab | Holds |
|---|---|
| Users | Accounts, profile, targets, favourites and saved plans (JSON), password hashes |
| Recipes | Every recipe; list fields such as ingredients and steps are JSON |
| Ingredients | Ingredient library with Tamil names and illustration colours |
| Meal Plans | Plans with their days as JSON |
| Feedback | Recipe ratings and comments |
| User Activity | Audit log of logins, edits, deletes, exports |
| Analytics | Page views, recipe views, searches, plan views and more |
| Contact Form Submissions | Messages from the contact form |
| Meal Logs | Each member's meals, water and weight |
| Content | Editable site text (headline, announcement, trainer note) |

Every write is validated on the server, timestamped (`createdAt`, `updatedAt`) and recorded in User Activity. Cells are written as plain text, so text that starts with `=` is never run as a formula, and exports neutralise formula characters for Excel.

## Project structure

```
platefit/
├── api/
│   ├── router.js              Vercel function: every /api/v1/* request lands here
│   └── _lib/
│       ├── runtime.js         Picks the data store, sets cookies, CSRF check
│       ├── google-sheets.js   Google Sheets REST driver (service-account JWT)
│       └── node-crypto.js     scrypt password hashing, HS256 session tokens
├── public/                    The website (served as-is in dev, copied to dist/ on build)
│   ├── index.html
│   ├── css/                   tokens.css (themes), app.css (shell, components), pages.css, motion.css
│   ├── images/                Optional photos: recipes/<id>.jpg, ingredients/<id>.jpg
│   └── js/
│       ├── app.js             Boot, shell, navigation, global search, theme
│       ├── core/              api client, router, state, analytics, SEO, nutrition maths, browser demo backend
│       ├── data/              recipes/*.js, ingredients.js, plans.js, seed.js (all plan content)
│       ├── shared/            Code used by both server and browser: API rules, sheet schema, analytics report
│       ├── ui/                icons, illustrations, charts, components
│       └── pages/             home, category, recipe (+ cook mode), dashboard, plans, plan, favourites, profile, auth, admin
├── scripts/                   build.js, setup-sheets.js, hash-password.js, env.js
├── tests/                     API and Sheets driver tests (node --test)
├── docs/                      DEPLOYMENT.md, MAINTENANCE.md, API.md, RECIPES.md
├── server.js                  Local dev server
├── vercel.json                Build, rewrites, security headers
└── .env.example
```

The API rules live in `public/js/shared/api-core.js`. The Vercel function, the local server and the browser preview all run that same file, with storage (Google Sheets, memory or localStorage) and crypto plugged in. That keeps validation and permissions identical everywhere.

## Security

- Passwords hashed with scrypt; sessions in an HttpOnly, SameSite cookie (Secure on HTTPS); 7-day expiry.
- Admin credentials only from environment variables; a hash option keeps the plain password out of Vercel.
- CSRF protection: state-changing requests must carry the `X-Requested-With: PlateFit` header, which other sites cannot send without CORS.
- Rate limits on login, registration, password reset, feedback, contact and analytics.
- Content-Security-Policy and other security headers in `vercel.json`.
- Password hashes and reset tokens never leave the server, including in exports.

## More documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): browser-only setup of GitHub, Vercel, Google Sheets, GA4, Search Console, email, custom domain
- [docs/MAINTENANCE.md](docs/MAINTENANCE.md): editing content, adding photos, backups, rotating secrets, troubleshooting
- [docs/API.md](docs/API.md): every endpoint
- [docs/RECIPES.md](docs/RECIPES.md): every recipe and its id, with the line from the plan it comes from

## Disclaimer

Nutrition values are estimates and the plan is general guidance, not medical advice. Agree targets with your trainer or a registered dietitian.
