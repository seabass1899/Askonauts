# ASKONAUTS

A children's science discovery game (ages 6–11). Kids answer real "why?"
questions by experimenting in small worlds: Shadow Chase, Reflection Lab,
Spoon Lab and Funhouse Mirrors, joined by the Clubhouse.

Current build: **P7.0** (see `CHANGES-P7.0.md`). The build name lives in one
place: `src/buildInfo.ts`. Change it there for each release.

## Deploying (Vercel)

Vercel runs `npm run build` (type-check + Vite build) and serves `dist/`.
The `api/` folder holds the two serverless functions: `telemetry` (saves
playtest sessions to Supabase) and `results` (the `/admin.html` dashboard).
Environment variables and the one-time Supabase setup are in
`SETUP-TELEMETRY.md`.

## Before every release

1. `npm run test:rules`: mission rules (no awards without input, etc.).
2. `npm run build && npm run preview`, then in a second terminal
   `npm run smoke`: plays every world in a browser and fails the release on
   page errors, self-completing stages, storage storms or missing telemetry.
   Needs Playwright once: `npm i -D playwright && npx playwright install chromium`.

## Playtests

Parents follow `TESTER-INSTRUCTIONS.md`. The **Parent** button (bottom-right,
every world) pauses play and offers Finish Test. Optional URL labels:
`?source=school-a&tester=T01`.

## Project map

- `src/game/scenes/`: one file per world, plus the Clubhouse
- `src/game/missions/`: Shadow Chase mission rules (no Phaser; unit-tested)
- `src/playtest/`: parent setup, the shared session, the Parent panel, upload queue
- `src/game/systems/PlaytestTelemetry.ts`: what a session records
- `tests/`: mission-rules test and the automated play-through
- `docs/`: design docs; `docs/history/` holds the P0 to P6.5 release notes
