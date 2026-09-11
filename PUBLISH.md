# Publish Hone yourself

This is the source for Hone, a quant arithmetic trainer. Copying the repo to GitHub does **not** copy your scores. Scores live in a browser until you sign in; signed-in scores live in the database of whichever host is running the app.

## Run it locally

You need Node 22+.

```bash
npm install
npm run dev
```

Open the URL the script prints (typically port 8080).

## Put it on GitHub

1. Create an empty GitHub repository.
2. In this folder:

```bash
git init
git add .
git commit -m "Hone arithmetic trainer"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

## Publish on Vercel (your own URL, not grok.me)

1. Import the GitHub repo at [vercel.com](https://vercel.com).
2. Framework: Vite / other. Build command: `npm run build`. Output: leave Vercel to detect Nitro/Vercel output.
3. Add a Postgres database (Neon is the usual free option) and set `DATABASE_URL`.
4. Set:

   - `BETTER_AUTH_SECRET` — a long random string
   - `BETTER_AUTH_URL` — your public origin, e.g. `https://your-app.vercel.app`
   - `VITE_AUTH_ENABLED` — omit it, or anything other than `"false"`

5. Deploy. Vercel gives you `your-app.vercel.app`. Add a custom domain in the Vercel project if you want.

Google / X sign-in on your own host needs your own OAuth apps (or the Grok auth broker credentials if you have them). Username + password still works against your Postgres with no extra setup.

## Drop the Grok preview chrome

The live Grok preview injects a “Created with Grok / Remix” pill. That is platform chrome, not the trainer. On your copy you can:

- Remove `grokPwaPlugin()` from `vite.config.ts`
- Ignore `public/__grok/` and `scripts/grok-pwa-*`

Do not hide that pill inside the Grok preview itself — it is a project setting there, not a CSS trick.

## What actually saves

| Where | What it keeps |
| --- | --- |
| This browser | Name, intro, rounds, heatmap — until the browser wipes site data |
| Signed-in account | The same data, on any device that signs into the same deploy |

GitHub is only the code.
