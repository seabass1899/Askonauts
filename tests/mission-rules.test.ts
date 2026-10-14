// Mission rules that must hold in every release (P7.0). Run: npm run test:rules
import { MissionDirector } from '../src/game/missions/MissionDirector';
import { SHADOW_CHASE_MISSION } from '../src/game/missions/ShadowChaseMission';

let failures = 0;
const check = (ok: boolean, name: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures += 1;
};

const emitter = { x: 266, y: 399 };
const scaleAt = (quipX: number) => (1100 - emitter.x) / (quipX - emitter.x);
let t = 0;
const md = new MissionDirector(SHADOW_CHASE_MISSION, 0);
const observe = (quipX: number, visible = true) => {
  t += 16;
  return md.handle({ type: 'shadow_observed', visible, scale: visible ? scaleAt(quipX) : null, y: 470, atMs: t });
};
const signal = (s: Parameters<MissionDirector['handle']>[0]) => md.handle(s);

// Idle at a tiny-looking scale: nothing may be awarded without input.
for (let i = 0; i < 600; i++) observe(890);
check(md.getSnapshot().discoveries.length === 0, 'no discovery while nobody touches anything');

// Quip starts at x=720: neither huge nor tiny.
const start = scaleAt(720);
check(
  start > SHADOW_CHASE_MISSION.thresholds.smallShadowScaleMax && start < SHADOW_CHASE_MISSION.thresholds.largeShadowScaleMin,
  `starting shadow (${start.toFixed(2)}x) is neither tiny nor huge`
);

// A real move earns the tiny shadow.
signal({ type: 'object_moved', object: 'quip', atMs: (t += 16) });
for (const x of [880, 860, 850]) observe(x);
check(md.hasDiscovery('small_shadow'), 'tiny shadow counts after the child moves Quip');

// Play through to Block It.
signal({ type: 'object_moved', object: 'light', atMs: (t += 16) });
observe(700); observe(600);
signal({ type: 'light_toggled', enabled: false, atMs: (t += 16) }); observe(600, false);
signal({ type: 'light_toggled', enabled: true, atMs: (t += 16) }); observe(600);
signal({ type: 'object_moved', object: 'quip', atMs: (t += 16) }); observe(360); observe(350);
check(md.getSnapshot().stageId === 'block_it', 'reaches Block It through real moves');

// The rock sitting in the beam must not award itself.
for (let i = 0; i < 300; i++) {
  signal({ type: 'blocker_observed', blockerId: 'rock', blocking: true, shadowVisible: true, atMs: (t += 16) });
}
check(!md.hasDiscovery('blocker_shadow'), '"Two Shadows" is not awarded without moving the rock or light');
signal({ type: 'object_moved', object: 'blocker', atMs: (t += 16) });
signal({ type: 'blocker_observed', blockerId: 'rock', blocking: true, shadowVisible: true, atMs: (t += 16) });
check(md.hasDiscovery('blocker_shadow'), '"Two Shadows" counts once the child moves the rock');

// Free Experiment must not count frames.
signal({ type: 'evidence_confirmed', atMs: (t += 16) });
for (let i = 0; i < 600; i++) {
  signal({ type: 'blocker_observed', blockerId: 'rock', blocking: true, shadowVisible: true, atMs: (t += 16) });
}
check(md.getSnapshot().freeExperimentInteractions === 0, 'free-play count ignores per-frame rock observations');

console.log(failures ? `\n${failures} rule(s) broken` : '\nAll mission rules hold');
process.exit(failures ? 1 : 0);
