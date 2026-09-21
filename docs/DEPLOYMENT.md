# Deployment — Charlie Dairy App

Goal: get this app reachable over the internet so people at other locations can log
in and do data entry, while keeping the real farm data safe.

Chosen path: **Vercel** (hosting) + **hosted Postgres** (Neon or Vercel's own
Postgres storage, both Neon-backed). SQLite (the current local database) cannot be
used on Vercel — its filesystem is read-only/ephemeral in production, and a single
file can't safely handle multiple people writing from different locations at once.

I can't create the Vercel or GitHub account for you (account creation is something
I'm not able to do on your behalf) — the steps below are exactly what to click. Come
back to me at any checkpoint marked **⏸ stop here** and I'll take it from there.

## 0. Prerequisites

- A GitHub account (free) — Vercel deploys from a git repo
- A Vercel account (free tier is enough to start) — sign up at vercel.com, "Continue
  with GitHub" is easiest

## 1. Export the current data (do this now, before anything else changes)

From `C:\Users\Admin\charlie-dairy-app`:

```bash
npm run db:export-for-postgres
```

This writes JSON dumps of every table to `scripts/deploy/dump/` (git-ignored — it's
real farm data, never gets committed). Keep this folder until the migration is
verified.

**⏸ stop here** if you want me to run this step for you instead — I can, since it
only touches the local SQLite file.

## 2. Push the code to GitHub

```bash
git remote add origin https://github.com/<your-username>/charlie-dairy-app.git
git push -u origin master
```

(Create the empty repo on GitHub first — no README/license, so it doesn't conflict
with what's already here.)

## 3. Create the Postgres database

Easiest: in the Vercel dashboard, open (or create) the project, go to **Storage →
Create Database → Postgres** (Neon-backed). This automatically wires
`DATABASE_URL` into the project's environment variables — you never have to
copy/paste it into Vercel yourself.

Also copy that same `DATABASE_URL` into your **local** `.env` file temporarily (for
step 5) — either from the Vercel dashboard's env var page, or `vercel env pull` if
you have the Vercel CLI installed.

**⏸ stop here and tell me the app is created** — I'll then swap
`prisma/schema.prisma` over to `postgresql` and push the schema.

## 4. Switch the schema to Postgres (I'll do this)

- `prisma/schema.prisma`: `datasource db { provider = "postgresql" ... }`
- `npx prisma db push` (or `prisma migrate dev --name init` to also get a proper
  migration history from here on — recommended, since Postgres is the permanent
  home)
- `npx prisma generate`

## 5. Import the real data

```bash
npm run db:import-to-postgres
```

Then spot-check: log into the app pointed at the new DB and compare cow count / a
recent transaction against the old SQLite version before trusting it.

## 6. Set the production secrets in Vercel

Project → Settings → Environment Variables:

- `AUTH_SECRET` — generate a fresh one, **don't reuse the local dev secret**:
  ```bash
  npx auth secret
  ```
- `DATABASE_URL` — already set by step 3 if you used Vercel Postgres

## 7. Set the build command

Project → Settings → Build & Development Settings → Build Command:

```
prisma migrate deploy && next build
```

(Applies any pending migrations automatically on every deploy, before building.)

## 8. Deploy

Push to `master` (or click **Deploy** in the Vercel dashboard). Vercel gives you a
`https://<project>.vercel.app` URL immediately — that's what people at other
locations use.

## 9. First login in production

Log in with the `admin` account and **change its password immediately** (the current
one was generated in a chat session and should be rotated once you're on the real
production database) — see `/admin` once logged in, or ask me to reset it the same
way as before, pointed at the new DB.

## Afterward

- Custom domain: Vercel → Settings → Domains (optional, free `.vercel.app` URL works
  fine to start)
- Backups: Neon/Vercel Postgres takes automatic backups on paid tiers; on the free
  tier, periodically re-run something like `export-sqlite-data.ts`'s pattern against
  Postgres (`pg_dump`, or a scheduled export script) — don't assume the free tier
  alone is your backup strategy
- Every `git push` to `master` auto-redeploys once GitHub is connected in Vercel
