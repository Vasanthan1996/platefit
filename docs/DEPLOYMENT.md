# Deploy from your browser (no installs)

Everything below happens on three websites: GitHub, Vercel and Google. You do not need Node.js, Git or a terminal. Allow about 30 minutes the first time.

The order matters only a little: the site works as soon as Vercel deploys it (in preview mode, with sample data), and becomes the real app once the Google Sheet is connected.

---

## Part 1. Put the code on GitHub

1. Unzip `platefit.zip`. You get a folder called `platefit`.
2. Sign in at [github.com](https://github.com) and click **+ > New repository**.
   - Name: `platefit`
   - Choose **Private** (recommended) or Public.
   - Leave "Add a README", ".gitignore" and "license" **unticked**.
   - Click **Create repository**.
3. On the empty repository page, click the link **uploading an existing file**.
4. Open the `platefit` folder on your computer, select **everything inside it** (`api`, `docs`, `public`, `scripts`, `tests`, `package.json`, `vercel.json`, `README.md` and the rest) and drag it into the browser window.
   - Drag the **contents**, not the `platefit` folder itself, so that `package.json` sits at the top of the repository.
   - On a Mac, files starting with a dot (`.gitignore`, `.env.example`) are hidden in Finder. Press **Cmd + Shift + .** to show them. They are helpful but not required.
5. Wait until every file shows in the list, then click **Commit changes**.
6. Check the repository's main page: you should see `package.json` and `vercel.json` in the file list, next to the `api` and `public` folders.

## Part 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and **Sign up / Log in with GitHub**.
2. Click **Add New > Project**. Find `platefit` and click **Import**. If it is not listed, click **Adjust GitHub App Permissions** and allow access to the repository.
3. On the configure screen:
   - **Framework Preset:** Other
   - **Root Directory:** leave as `./` (if you uploaded the `platefit` folder itself in Part 1, set this to `platefit`)
   - Leave Build and Output settings as they are. The project's `vercel.json` sets them.
4. Open **Environment Variables** and add this one now:

   | Key | Value |
   |---|---|
   | `ADMIN_PASSWORD` | A strong password you will use to sign in as `admin` |

5. Click **Deploy**. After about a minute you get a link like `https://platefit-xxxx.vercel.app`.
6. Open it. The site works, with a yellow **Preview mode** banner that says Google Sheets is not connected yet. That is expected; Part 3 fixes it.

## Part 3. Create the Google Sheet

1. Open [sheets.new](https://sheets.new) (signed in to your Google account). Rename it **PlateFit Database**.
2. Copy the whole address from the browser bar. It looks like `https://docs.google.com/spreadsheets/d/1AbC...xyz/edit`. You will paste it in Part 5.

You do not need to create any tabs. The app creates all 10 tabs and their header rows the first time it connects.

## Part 4. Create a Google service account (the app's "robot" login)

1. Open [console.cloud.google.com](https://console.cloud.google.com/) and accept the terms if asked.
2. At the top, click the project picker > **New project**. Name it `platefit`, click **Create**, then make sure it is selected.
3. Open [the Google Sheets API page](https://console.cloud.google.com/apis/library/sheets.googleapis.com) and click **Enable**.
4. Open **APIs & Services > Credentials** ([direct link](https://console.cloud.google.com/apis/credentials)) > **Create credentials > Service account**.
   - Name: `platefit-sheets` > **Create and continue** > skip the optional steps > **Done**.
5. Click the new service account in the list. Copy its **email** (it ends in `.iam.gserviceaccount.com`).
6. Go to the **Keys** tab > **Add key > Create new key > JSON > Create**. A `.json` file downloads. Keep it private.
7. Go back to your Google Sheet > **Share** > paste the service account email > set **Editor** > untick **Notify people** > **Share**.

> If your Google Workspace blocks key creation ("Service account key creation is disabled"), use a personal Gmail account for the Cloud project and sheet, or ask your Workspace admin to allow keys for this project.

## Part 5. Connect the sheet in Vercel

1. In Vercel, open your project > **Settings > Environment Variables**.
2. Add these (tick **Production**, **Preview** and **Development** for each):

   | Key | Value |
   |---|---|
   | `GOOGLE_SHEET_ID` | The sheet address from Part 3 (the full link is fine) |
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | Open the downloaded `.json` key in Notepad or TextEdit, select **all** of it (from the first `{` to the last `}`), copy and paste it as the value |
   | `ADMIN_PASSWORD` | Already added in Part 2 |

   Optional:

   | Key | Value |
   |---|---|
   | `SITE_URL` | Your site address, e.g. `https://platefit-xxxx.vercel.app` (Vercel's address is used automatically if you skip this) |
   | `JWT_SECRET` | Any random text of 32+ characters. Without it, a session key is derived from your Google key automatically |
   | `ADMIN_USERNAME` | Defaults to `admin` |

3. Go to **Deployments**, click **⋯** on the latest one > **Redeploy**. Environment variables only apply to new deployments.
4. When it finishes, open `https://<your-site>/api/v1/health`. You should see `"ok":true` and `"mode":"google"`. Your Google Sheet now has 10 tabs.

   If it shows `"ok":false`, the `problem` text says exactly what to fix (for example, the sheet is not shared with the service account). Fix it, then redeploy.

## Part 6. First sign-in and loading the recipes

1. Open `https://<your-site>/login` and sign in with username **admin** and your `ADMIN_PASSWORD`.
2. Go to **Admin > Content** and click **Set up sheet and load recipes**. This copies all 55 recipes, 79 ingredients, both meal plans and the site text into the sheet so you can edit them from the admin panel or in Sheets.
3. Visit the home page and check the yellow banner is gone. Register a normal account to try tracking.

Every time you change a file on GitHub (Part 7), Vercel redeploys automatically.

---

## Part 7. Making changes later without a computer setup

- **Content** (recipes, quantities, plans, site text, users): use the admin panel. Changes save to the Google Sheet instantly; no redeploy needed.
- **Photos:** in GitHub open `public/images/recipes` > **Add file > Upload files**, upload `grilled-chicken.jpg` (named by recipe id, see `docs/RECIPES.md`), commit. Vercel redeploys and the photo replaces the drawing.
- **Code:** open any file on GitHub, click the ✏️ pencil, edit, **Commit changes**. Vercel redeploys.
- **Admin password:** change `ADMIN_PASSWORD` in Vercel > Settings > Environment Variables, then redeploy.

## Optional extras

### Google Analytics 4
1. [analytics.google.com](https://analytics.google.com) > **Admin > Create property** > add a **Web** data stream with your site address.
2. Copy the **Measurement ID** (`G-XXXXXXXXXX`) into a Vercel variable `GA_MEASUREMENT_ID`, then redeploy.

### Google Search Console
1. [search.google.com/search-console](https://search.google.com/search-console) > **Add property > URL prefix** > your site address.
2. Pick **HTML tag**, copy only the value inside `content="..."` into a Vercel variable `GOOGLE_SITE_VERIFICATION`, redeploy, then click **Verify**.
3. Open **Sitemaps** and submit `sitemap.xml`.

### Password-reset emails
Without email, a member who forgets their password asks you, and you set a temporary one in **Admin > Users**. To send reset links automatically, create a free [resend.com](https://resend.com) account, verify your domain, then add `RESEND_API_KEY` and `MAIL_FROM` (e.g. `PlateFit <no-reply@yourdomain.com>`) in Vercel and redeploy.

### Custom domain
Vercel > **Settings > Domains > Add**, follow the DNS steps, then set `SITE_URL` to the new address and redeploy.

## Troubleshooting

| What you see | Fix |
|---|---|
| Vercel build fails with "No package.json found" | You uploaded the `platefit` folder itself. Set **Settings > General > Root Directory** to `platefit`, or re-upload the folder's contents |
| Banner: "Google Sheets is not connected yet" | `GOOGLE_SHEET_ID` or `GOOGLE_SERVICE_ACCOUNT_JSON` is missing, or you did not redeploy after adding them |
| Banner: "Share the sheet with ... as Editor" | Share the sheet with the service account email (Part 4, step 7), or enable the Google Sheets API (Part 4, step 3) |
| Banner: "Google rejected the service account key" | Paste the whole JSON file again, including the `{` and `}` |
| Banner: "No spreadsheet matches GOOGLE_SHEET_ID" | Paste the sheet address again |
| Login says "Admin sign-in is not set up yet" | Add `ADMIN_PASSWORD` and redeploy |
| Login says "Too many attempts" | Wait 15 minutes |
| Errors in detail | Vercel > project > **Logs**, filter by `[api]` or `[sheets]` |

## Limits

- Google Sheets allows about 300 reads and 300 writes per minute. The app caches reads and batches analytics, which suits a gym, a class or a few hundred daily users.
- Vercel's free Hobby plan is for personal, non-commercial projects. For a business, use the Pro plan.
