# ASKONAUTS — Remote Telemetry Setup

ASKONAUTS is designed so parents do not download, email, or upload any telemetry files.
The game saves anonymous playtest telemetry automatically through a Vercel server-side endpoint into Supabase.

## Parent experience

1. Open one playtest URL.
2. Choose the child's age band.
3. Check the parent/guardian consent box.
4. Tap **START PLAYTEST**.
5. Hand the device to the child and say only: **“See what you can figure out.”**
6. When the child stops, tap **Parent** (bottom-right) → **Finish test**.
7. Answer four tap-only questions, or choose **FINISH WITHOUT QUESTIONS**.
8. Done. No files, email, account, or technical steps.

Telemetry is also saved during play, so useful data is retained even when the Finish Test screen is skipped.

---

# One-time owner setup

## 1. Create a Supabase project

Create a Supabase project dedicated to ASKONAUTS playtesting if practical.

Suggested project name:

`askonauts-playtest`

## 2. Create the table

Open Supabase **SQL Editor** and run the entire file:

`supabase/playtest_schema.sql`

This creates `public.playtest_sessions` with Row Level Security enabled and no public read/write policies.

## 3. Copy the server-side Supabase credentials

You need:

- Project URL
- a server-side **secret/service-role** key

Never put the secret/service-role key into a `VITE_...` variable or browser code.

## 4. Add Vercel environment variables

In the ASKONAUTS Vercel project, add these Production environment variables:

`SUPABASE_URL`

`SUPABASE_SECRET_KEY`

`PLAYTEST_ADMIN_KEY`

For `PLAYTEST_ADMIN_KEY`, create a long random password that only you know.

If your Supabase project exposes the legacy service-role key rather than a secret key, you may instead set:

`SUPABASE_SERVICE_ROLE_KEY`

The server supports either variable name.

## 5. Redeploy P0.5.2

Deploy the P0.5.2 ZIP through Vercel Drop, then verify the production URL.

The game page is:

`https://YOUR-PROJECT.vercel.app/`

The private results dashboard is:

`https://YOUR-PROJECT.vercel.app/admin.html`

## 6. Test automatic collection

1. Open the production game URL.
2. Choose an age band and consent.
3. Play for 20–30 seconds.
4. Tap **PARENT** → **FINISH TEST**.
5. Complete the four parent questions.
6. Open `/admin.html` and enter `PLAYTEST_ADMIN_KEY`.
7. Confirm the session appears.

---

# Useful test links

The game accepts optional query-string labels that parents never need to type.

PlaytestCloud cohort:

`/?source=playtestcloud`

A specific non-identifying tester code:

`/?source=playtestcloud&tester=PC-001`

Local recruitment:

`/?source=local&tester=LOCAL-001`

These labels are for research organization only. Do not put a child's name in `tester`.

---

# What is collected

- anonymous random session ID
- age band: 6–7, 8–9, or 10–11
- coarse device viewport/touch capability
- time to first interaction
- Quip/light drags
- light toggles
- big/small shadow discoveries
- GIANT QUIP discovery
- interaction counts
- active gameplay timing
- whether the child continued experimenting after the core discovery
- four optional parent observations

The ASKONAUTS app does **not intentionally collect** the child's name, exact birthday, email, photo, voice, or precise location.

Note: normal infrastructure providers such as Vercel/Supabase may process ordinary request metadata as part of operating their services. Review your production privacy/COPPA requirements before a public launch; this build is an early research prototype.
