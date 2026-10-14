# ASKONAUTS P1.0 — Mission Architecture

## Goal

Turn the proven P0.5.2b Shadow Box sandbox into a reusable discovery-game engine without converting ASKONAUTS into a quiz app.

The architecture separates four concerns:

1. **Simulation** — light, shadow, object movement and later reflection/sound/motion systems.
2. **Observation adapter** — converts low-level Phaser events into semantic mission signals.
3. **MissionDirector** — tracks discoveries, stage progression, hints and Curiosity Sparks.
4. **Presentation** — Question Compass, character reactions, evidence cards, gate animations and audio.

The `MissionDirector` is pure TypeScript and has no Phaser dependency. That makes it reusable for future ASKONAUTS missions and testable without rendering the game.

## Design rule: discoveries survive out of order

Children should be allowed to experiment freely. If a child turns the light off before the game formally reaches the Lights Out beat, the game records that discovery. When the mission reaches that stage, it can resolve naturally instead of forcing the child to repeat something they already discovered.

This is the central design choice in P1.0.

## P1.0 state model

The mission owns a **discovery ledger**, not a scorecard of right/wrong answers.

Core discoveries:

- first interaction
- Quip moved
- shadow changed after Quip moved
- light moved
- shadow changed after light moved
- shadow disappeared with the light off
- shadow returned with the light on
- large shadow created
- small shadow created
- blocker created another shadow
- evidence confirmed
- free experimentation occurred
- Giant Quip discovered (optional)
- Question Gate entered

## Mission stages

1. Mystery
2. Shadow Follows
3. Light Matters
4. Lights Out
5. Size Hunt
6. Block It
7. Evidence Lock
8. Free Experiment
9. Question Gate
10. Complete

Stages advance from evidence, not elapsed time. Hint timers only help a stuck child; they never complete a stage automatically.

## Hint philosophy

Hints escalate in three layers:

- **environmental cue** — pulse the relevant object
- **attention cue** — pulse the relationship or destination (wall, compass, gate)
- **character nudge** — a short Veya/Teyo/Quip prompt that suggests what to investigate without stating the answer

Any meaningful interaction resets the hint clock.

## Curiosity Sparks

Curiosity Sparks reward first-time discoveries and mission progression. They are not lost for failed attempts and are not tied to correctness streaks.

P1.0 planned total: **20 Sparks** across the full Shadow Chase mission.

## Physics-to-mission adapter contract

The Phaser scene should eventually send only semantic observations such as:

- `object_moved(quip)`
- `object_moved(light)`
- `light_toggled(false)`
- `shadow_observed(visible, scale)`
- `blocker_observed(blocking, shadowVisible)`
- `evidence_confirmed`
- `question_gate_entered`

The mission engine should never know how Phaser drag zones, sprites, coordinates, masks or hit areas are implemented.

## Telemetry contract for P1

P1 telemetry should add:

- first stage reached time
- each discovery time
- stage completion time
- hint level reached per stage
- free-experiment interaction count
- Question Gate entered yes/no

This can initially live inside the existing `events` and `raw_summary` JSON fields, so the database schema does not need to change immediately.

## Architecture gate before visuals

Before building Compass animations, blockers, dialogue or the Question Gate, validate that:

- the mission engine compiles independently;
- out-of-order discoveries are retained;
- all nine stages can complete through semantic signals;
- hint escalation does not advance stages;
- Curiosity Sparks are awarded once per completed stage.
