# Maintenance guide

## Everyday content changes (no code)

All of these happen in **Admin** while signed in as an admin, and save straight to the Google Sheet.

| Task | Where |
|---|---|
| Fix a quantity, step, calorie or protein value | Admin > Recipes > ✎ |
| Add a recipe | Admin > Recipes > New recipe. Ingredients are one per line: `ingredient-id | quantity | note`. Steps: `Title | instruction | minutes` |
| Hide a recipe without deleting it | Edit it and untick **Published** |
| Add or rename an ingredient, change its Tamil name or picture colours | Admin > Ingredients |
| Change the 7-day plan | Admin > Meal plans > ✎. Days are JSON; recipe ids are in `docs/RECIPES.md` |
| Change the home headline, announcement or trainer note | Admin > Content |
| Answer feedback and contact messages | Admin > Feedback / Messages; mark them reviewed or resolved |
| Make someone an admin, disable an account, set a temporary password | Admin > Users |
| Download data | Admin > Export (CSV or Excel, one sheet or all) |

You can also edit cells in the Google Sheet directly. Keep the header row unchanged, keep JSON columns valid, and give every new row a unique `id`.

The built-in recipe files in `public/js/data/` are the starting data. Once the sheet has rows, the sheet wins. To change the starting data for future installs, edit those files and run `npm run setup:sheets` on a fresh sheet.

## Adding real photos

1. Name the file after the id: `public/images/recipes/grilled-chicken.jpg`, `public/images/ingredients/guava.webp`. Ids are in `docs/RECIPES.md`.
2. Use landscape photos around 1200×900 px under 250 KB (WebP is smallest).
3. Commit and push. The build lists the photos in `images/manifest.json`, and the app shows them instead of the drawings. Delete a photo to get the drawing back.

## Backups

- Google Sheets keeps version history: **File > Version history > See version history**.
- For an offline copy, use **Admin > Export > Everything in one Excel workbook** each week, or **File > Download > Microsoft Excel** in Sheets.

## Rotating secrets

| Secret | How | Effect |
|---|---|---|
| Admin password | Change `ADMIN_PASSWORD` in Vercel → redeploy (or use `ADMIN_PASSWORD_HASH`) | Old password stops working |
| `JWT_SECRET` | Generate a new random value → update on Vercel → redeploy | Everyone is signed out once |
| Service account key | Google Cloud > service account > Keys > add new, delete old → paste into `GOOGLE_SERVICE_ACCOUNT_JSON` → redeploy | Signs everyone out once if `JWT_SECRET` is not set |

## Monitoring

- **Health:** `/api/v1/health` returns `ok` and the data mode.
- **Errors:** Vercel > project > **Logs** shows function errors (prefixed `[api]`).
- **Activity:** Admin > Activity log lists logins, failed logins, edits, deletes and exports with IP addresses.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Health says `unconfigured` | A variable is missing or `JWT_SECRET` is shorter than 32 characters. Check Vercel variables and redeploy. |
| "Google rejected the service account key" | Paste the whole JSON key file into `GOOGLE_SERVICE_ACCOUNT_JSON` again, from `{` to `}`. |
| `Google Sheets ... failed (403)` | The sheet is not shared with the service account email as Editor, or the Sheets API is not enabled. |
| `Google Sheets ... failed (404)` | Wrong `GOOGLE_SHEET_ID`. |
| `failed (429)` | Rate limit. The driver retries automatically; persistent 429s mean you have outgrown Sheets. |
| Recipes show but admin edits do not appear | The sheet has not been loaded yet: Admin > Content > **Set up sheet and load recipes**. |
| Admin login says wrong password | `ADMIN_USERNAME`/`ADMIN_PASSWORD(_HASH)` on Vercel differ from what you typed, or a redeploy is needed after changing them. |
| Site shows the yellow "Preview mode" banner after deploy | The API is unreachable or unconfigured. Open `/api/v1/health` to see why. |
| Too many attempts message | Login is limited to 10 tries per 15 minutes per IP. Wait, then try again. |

## Updating the code

From the browser: open a file on GitHub, click the pencil, edit and **Commit changes**. Vercel redeploys `main` automatically; a broken build leaves the previous version live, and **Deployments > ⋯ > Promote** rolls back.

On a computer (optional): `npm test`, then `npm run preview`, then push.

Where things live:
- API rules and validation: `public/js/shared/api-core.js`
- Sheet columns: `public/js/shared/schema.js` (add a column there, then run `npm run setup:sheets` to add the header)
- Pages: `public/js/pages/*.js`; colours and type: `public/css/tokens.css`
