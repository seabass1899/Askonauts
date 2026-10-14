# ASKONAUTS P1.0 — Shadow Chase Interaction Map

Target session: **8–10 minutes** for a first-time child player.

The interaction map is intentionally discovery-first. We do not lock the child into a rigid tutorial sequence; these are narrative beats layered over a persistent sandbox.

| Beat | Target time | Player experience | System evidence | Character / world response | Fail-safe cue |
|---|---:|---|---|---|---|
| 0. Mystery | 0:00–0:30 | Quip notices the shadow is following him. Child is invited to touch the room. | `first_interaction` | Question Compass flickers awake. | Pulse Quip after 12s. |
| 1. Shadow Follows | 0:30–1:30 | Child moves Quip and watches the shadow move/change. | `quip_moved` + `shadow_changed_after_quip` | Veya notices the relationship; Compass stores first evidence spark. | Pulse Quip, then wall. |
| 2. Light Matters | 1:30–2:30 | Child moves the lamp and sees the shadow change again. | `light_moved` + `shadow_changed_after_light` | Teyo frames the lamp as something worth testing. | Pulse lamp, then wall. |
| 3. Lights Out | 2:30–3:15 | Child switches light off; shadow disappears; switches it back on. | `shadow_disappears_without_light` + `shadow_returns_with_light` | Quip reacts dramatically to losing/finding his shadow. | Pulse switch. |
| 4. Size Hunt | 3:15–4:45 | Challenge: make Quip’s shadow huge, then tiny. No multiple-choice answer. | `large_shadow` + `small_shadow` | Each extreme earns a visible discovery response; Giant Quip can remain a secret. | Pulse Quip, later lamp. |
| 5. Block It | 4:45–6:00 | A physical object becomes available. Child drags it into the beam and creates another shadow. | `blocker_shadow` | Veya/Teyo connect blocking light with shadow formation. | Pulse blocker object. |
| 6. Evidence Lock | 6:00–6:45 | Question Compass gathers the discoveries into one visual idea: light travels, objects block it, shadows form behind them. | `evidence_confirmed` | Compass lights another segment. | Pulse Compass. |
| 7. Free Experiment | 6:45–8:15 | Room fully opens. Child can recombine Quip, lamp, switch and blocker. | 5+ interactions after evidence OR optional secret discovery | Bonus Curiosity Sparks; Quip comedy moments. | One character nudge only after prolonged inactivity. |
| 8. Question Gate | 8:15–9:00+ | A new gate opens with a reflected glint hinting at the next mystery. Child chooses to enter. | `question_gate_entered` | Transition toward Reflection Hunt. | Pulse gate after 15s. |

## What is not allowed in this mission

- hearts or lives
- penalties for wrong hypotheses
- forced text-heavy instructions
- repeated multiple-choice quizzes
- a glowing arrow that continuously tells the child exactly where to drag
- blocking free experimentation because a discovery occurred “too early”

## New object for P1: blocker tray

Start with one clearly opaque object, preferably the familiar rock from the ASKONAUTS episode. Later variants can introduce transparent/translucent materials, but P1 should first prove the simple relationship cleanly.

The blocker must be draggable with the same touch-target reliability standard established for Quip and the lamp in P0.5.2b.

## Evidence Lock content

The final evidence sequence should communicate, primarily visually:

**LIGHT → BLOCKED BY OBJECT → DARK REGION BEHIND OBJECT**

Child-facing language should remain short. The game should show the causal relationship rather than lecture it.

## Definition of success for the next child test

A session is promising if most children can:

- initiate interaction without adult coaching;
- complete at least four of the five physical discovery beats;
- remain engaged beyond the first core discovery;
- reach Evidence Lock;
- choose to continue into free experiment or the Question Gate;
- express curiosity about what comes next.

The strongest signal is not whether a child can repeat the science sentence. It is whether the child starts deliberately manipulating variables to see what changes.
