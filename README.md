# Time Ledger

Attendance, overtime, and salary tracker with clock-in/clock-out, charts, and
an Excel export/import. Multi-user: each person signs up with their own
account and only ever sees their own data.

## 1. Create a Supabase project

1. Go to https://supabase.com, sign in, and create a new project (free tier is enough).
2. In the project, open **SQL Editor -> New query**, paste the contents of
   `supabase/schema.sql`, and run it. This creates the `settings` and
   `entries` tables with row-level security so users can only read/write
   their own rows.
3. Go to **Settings -> API** and copy the **Project URL** and the
   **anon public key**.
4. (Optional, for faster testing) Under **Authentication -> Providers ->
   Email**, you can turn off "Confirm email" so new sign-ups can sign in
   immediately without clicking a confirmation link. Leave it on for a
   real deployment.

## 2. Configure the app

```bash
cp .env.local.example .env.local
```

Open `.env.local` and paste in the URL and anon key from step 1.

## 3. Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, sign up with an email + password, and you're in.

## 4. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, **Add New Project** and import that repo.
3. In the project's **Settings -> Environment Variables**, add the same
   two variables from `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy. Your app is now live at a `*.vercel.app` URL (or a custom domain).

## 5. Sharing it with a friend

Once it's deployed, just send them the URL. They sign up with their own
email and password and get their own private settings and attendance log —
row-level security in Supabase keeps your data and theirs completely
separate, even though you're both using the same deployed app and database.

## How data flows

- Clocking in/out, editing settings, and adding/deleting log entries all
  write straight to Supabase (via `@supabase/supabase-js` from the browser),
  scoped to the signed-in user.
- Sign in on a second device and the same data loads — there's no
  device-local storage involved, so everything is synced automatically.
- "Export Excel" still works exactly as before: it builds an `.xlsx` file
  client-side from whatever's loaded, with an Attendance Log, Settings, and
  Monthly Summary sheet. "Import Excel" reads that format back in and
  writes it to your Supabase account.
