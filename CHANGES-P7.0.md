# ASKONAUTS P7.0 — Release 1: fix what's broken

Baseline: P6.5. No new features. Every challenge now needs the child, the
playtest data is trustworthy, and the game downloads about 85% less.
Release 1 item 5 (new Clubhouse and Spoon Lab art without painted-in numbers)
is not in this build.

## 1. "Tiny shadow" no longer completes itself
- Quip starts at x=720 (opening shadow about 1.84x), not x=800 (1.56x).
- Tiny threshold is now 1.45x (was 1.6x, which the old start already met).
- Size discoveries only count after the child has moved Quip or the lamp.

## 2. "Two Shadows" no longer completes itself
- The rock appears at the first spot that is clear of the light beam and of
  Quip, instead of always at (830, 310) inside the beam.
- The rock's shadow only counts after the child moves the rock, moves the
  lamp, or toggles the light while the rock is on screen.

## 3. No more storage writes every frame
- The rock check no longer adds to the free-play count every frame. The
  dashboard's free-play number is real again (P2.1 to P6.5 showed 255 to 1,427).
- Saved progress is only rewritten when something changes (was 1-2 times
  per frame).
- Telemetry saves at most once per second; uploads at most every 5 seconds.
  (Before, uploads were starved: a timer reset on every save meant nothing
  was sent while play continued.)

## 4. Reflection Lab shows the science correctly
- Rough panel: scattered light leaves the front of the panel, back toward the
  lamp, in many directions (was drawn going out the back).
- Spoon: rays reflect back toward the lamp, traced with the mirror equation.
  Concave rays meet at a point, then cross; convex rays spread apart.

## 6. Playtest data you can trust
- One build name in `src/buildInfo.ts` drives the on-screen markers and
  telemetry. Sessions are now labelled P7.0 (P3 to P6.5 all said "P2.1").
- One telemetry session for the whole visit, shared by every world. Before,
  Shadow Chase started a new session each time it was entered and the other
  worlds recorded nothing.
- Every world now records: entered, taps, active time, discoveries, secrets,
  completion. The dashboard gains Worlds and Found columns and four CSV
  columns (tap_count, worlds_visited, worlds_completed, world_discoveries).
- Active play time stops counting after 60 s without input and when the tab
  is hidden (sessions showed up to 784 "active" minutes).
- Sessions nobody touched are no longer sent (9 empty rows in the export).
- The session log is capped (first 100 + latest 400 events) so long sessions
  stay under the server's 50,000-character limit; before, they would have been
  rejected and lost.
- Uploads the server rejects as invalid (400/413) are dropped instead of being
  retried on every page load forever.
- **Parent button in every world**, bottom-right corner, as a simple panel
  over the game: status, Resume, Finish Test (same four questions), New Test.
  Keyboard shortcut P still works. The old in-canvas panel (Shadow Chase only)
  is removed.

## 7. Privacy wording matches the game
- Parent screen: "Your child can pick a nickname for their in-game badge. It
  stays on this device and is never sent to us."
- Name box: placeholder "Nickname" and the note "Pick a fun nickname. It stays
  on this device." Names were never sent; this makes the promise accurate.

## 8. One label at a time
- New `AnnouncementLane`: reward banners, discovery labels, streak labels and
  "NEXT •" plates take turns, at least 1.2 s each; labels more than 3 s stale
  are dropped. The "NEXT •" plate moved off Quip's speech bubble. The duplicate
  "SECRET DISCOVERED" banner was removed.

## 9. Images: 17.1 MB to 2.5 MB
- All images converted to WebP at their original pixel sizes (so nothing on
  screen moves or changes size).
- 16 unused images deleted; 7 unused image loads removed.

## 10. Automated checks before every release
- `npm run test:rules`: mission rules (no award without input, rock rules,
  free-play counting). 7 checks.
- `npm run smoke`: plays the built game in a browser across all five scenes.
  Fails on page errors, self-completing stages, rock in the beam, storage
  storms, missing telemetry or an oversized session. 20 checks, plus
  screenshots in `tests/output/`.
- Verified: both pass on this build. With three of the old bugs put back in,
  the smoke test fails on exactly those three.

## Also tidied
- 286 old release-note files are archived in
  `docs/history/release-notes-P0-to-P6.5.zip`.
- No Supabase schema change. `api/telemetry.js` already accepts P7.0.
