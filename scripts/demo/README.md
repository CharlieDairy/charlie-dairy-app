# Charlie Dairy — demo version

A copy of the app that runs the same code on a **made-up farm**: invented people, customers, vendors, cattle,
a year of milk, sales, costs and cash. Nothing in it comes from the real farm.

## How it is kept apart from the real data
The demo lives in its own **`demo` schema** of the same Postgres server. `scripts/demo/run.js` takes the real
`DATABASE_URL` and adds `&schema=demo`, so the demo can never read or write the real tables. The seed script
refuses to run unless the connection is on the `demo` schema.

## Run it on this computer
- Double-click **Start Charlie DEMO.bat** (opens on http://localhost:3100). Close the normal app window first:
  both share the same project folder and cannot run at the same moment.
- Sign in with any demo login. The password for all of them is `Demo@1234`:
  `demo-admin` (everything), `demo-editor`, `demo-partner` (read-only incl. finance statements), `demo-viewer`.

## Refresh the data
`npm run demo:seed` wipes the demo schema and rebuilds the farm up to yesterday (about 1.5 minutes).

## Put it on the internet (Vercel)
1. In Vercel, add a new project from the same GitHub repository.
2. Environment variables:
   - `DATABASE_URL` = the same value as the real app **with `&schema=demo` added at the end**
   - `DEMO_MODE` = `1`
   - `AUTH_SECRET` = any new long random string (do not reuse the real one)
3. Deploy. The build runs `prisma migrate deploy`, which keeps the demo schema up to date.

With `DEMO_MODE=1` every page shows a "DEMO — made-up farm" banner and the sign-in page lists the demo logins.
