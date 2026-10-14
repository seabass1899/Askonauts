// ASKONAUTS automated play-through (P7.0).
//
// Run against a built game before every release:
//   npm run build && npm run preview          (serves on http://localhost:4173)
//   npm run smoke                              (or: node tests/smoke.mjs <url>)
//
// Needs Playwright with Chromium on the machine running it:
//   npm i -D playwright && npx playwright install chromium
// Optional env: PLAYWRIGHT_MODULE (path to playwright's index.mjs),
//               CHROMIUM_PATH (a Chromium executable).
//
// It FAILS the release if:
//   - any page error appears in any world
//   - a Shadow Chase discovery is awarded while nobody touches anything
//   - the rock appears inside the light beam, or "Two Shadows" fires on its own
//   - storage is written more than a few times per second during play
//   - telemetry is missing the build name or a visited world
// Screenshots of every world land in tests/output/ for a quick visual check.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'output');
const URL_BASE = (process.argv[2] || process.env.SMOKE_URL || 'http://localhost:4173').replace(/\/$/, '');
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const results = [];
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const wait = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

// Skip the name/badge screen so the test reaches the worlds.
await page.addInitScript(() => {
  if (localStorage.getItem('askonauts.player-progress.v1')) return;
  localStorage.setItem('askonauts.player-progress.v1', JSON.stringify({
    schemaVersion: 2, askonautName: 'SMOKE', avatarId: 'star', accentId: 'violet', identityComplete: true,
    ageBand: '8-9', worldProgress: {}, unlockedWorldIds: ['shadow-chase'], lastWorldId: null, updatedAt: new Date().toISOString()
  }));
});

await page.goto(`${URL_BASE}/?smoke=1&source=smoke&tester=AUTO`);
await page.click('[data-age-band="8-9"]');
await page.check('#parent-consent');
await page.click('#start-playtest');
await page.waitForFunction(() => window.__askonauts?.game?.scene?.getScenes(true).length > 0, null, { timeout: 30000 });
await wait(3000);

const activeScene = () => page.evaluate(() => window.__askonauts.game.scene.getScenes(true).map((s) => s.scene.key)[0]);
const startScene = async (key) => {
  await page.evaluate((k) => window.__askonauts.game.scene.getScenes(true)[0].scene.start(k), key);
  await page.waitForFunction((k) => window.__askonauts.game.scene.getScenes(true).some((s) => s.scene.key === k), key, { timeout: 30000 });
  await wait(4000);
};
const tapCanvas = async (x, y) => {
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720);
};
const shadow = (fn, arg) => page.evaluate(
  ([body, a]) => {
    const sc = window.__askonauts.game.scene.getScene('ShadowBoxScene');
    return new Function('sc', 'arg', body)(sc, a);
  },
  [fn, arg]
);
const countWrites = (ms) => page.evaluate((duration) => new Promise((resolve) => {
  const original = Storage.prototype.setItem;
  const counts = {};
  Storage.prototype.setItem = function (key, value) {
    counts[key] = (counts[key] || 0) + 1;
    return original.call(this, key, value);
  };
  setTimeout(() => { Storage.prototype.setItem = original; resolve(counts); }, duration);
}), ms);

// 1. Clubhouse loads
check('Clubhouse opens', (await activeScene()) === 'ClubhouseScene', await activeScene());
await tapCanvas(640, 700);
await shot('01-clubhouse');

// 2. Shadow Chase: nothing is awarded while nobody touches anything
await startScene('ShadowBoxScene');
await wait(8000);
const idle = await shadow('return sc.missionDirector.getSnapshot()');
check('Shadow Chase: no discovery without input (8 s idle)', idle.discoveries.length === 0, `discoveries: ${idle.discoveries.join(', ') || 'none'}`);
await shot('02-shadow-start');

// 3. The rock appears out of the light and does not award itself
await shadow(`
  const md = sc.missionDirector;
  ['first_interaction','quip_moved','shadow_changed_after_quip','light_moved','shadow_changed_after_light',
   'shadow_disappears_without_light','shadow_returns_with_light','large_shadow','small_shadow']
    .forEach((d) => md.discoveries.add(d));
  sc.handleMissionSignal({ type: 'tick', atMs: sc.missionElapsedMs() });
`);
await wait(5000);
const rock = await shadow('return { stage: sc.missionDirector.getSnapshot().stageId, inBeam: sc.isBlockerInBeam(), x: Math.round(sc.blocker.x), y: Math.round(sc.blocker.y) }');
check('Shadow Chase: rock appears outside the light beam', !rock.inBeam, `rock at ${rock.x},${rock.y}`);
check('Shadow Chase: "Two Shadows" is not awarded on its own', rock.stage === 'block_it', `stage: ${rock.stage}`);
await shot('03-shadow-block-it');

// 4. Storage writes stay low, even in Free Experiment with the rock on screen
await shadow(`
  sc.blocker.setPosition(560, 400); sc.blockerDragZone.setPosition(560, 400);
  sc.handleMissionSignal({ type: 'object_moved', object: 'blocker', atMs: sc.missionElapsedMs() });
`);
await wait(2500);
await shadow(`sc.handleMissionSignal({ type: 'evidence_confirmed', atMs: sc.missionElapsedMs() });`);
await wait(4000);
const stageNow = await shadow('return sc.missionDirector.getSnapshot().stageId');
const writes = await countWrites(5000);
const perSecond = Object.fromEntries(Object.entries(writes).map(([k, v]) => [k, +(v / 5).toFixed(1)]));
const worst = Math.max(0, ...Object.values(perSecond));
check('Shadow Chase: reached Free Experiment for the storage check', stageNow === 'free_experiment', stageNow);
check('Storage writes under 2 per second per key', worst < 2, JSON.stringify(perSecond));
const freePlay = await shadow('return sc.missionDirector.getSnapshot().freeExperimentInteractions');
check('Free-play count does not count frames', freePlay < 5, `count after idle: ${freePlay}`);
await shot('04-shadow-free-experiment');

// 5. Every other world opens without errors
for (const [key, file] of [['ReflectionHuntScene', '05-reflection'], ['UpsideDownSpoonScene', '06-spoon'], ['FunhouseMirrorsScene', '07-funhouse']]) {
  await startScene(key);
  await tapCanvas(640, 700);
  check(`${key} opens`, (await activeScene()) === key);
  await shot(file);
}

// Reflection Lab: rough panel and both spoon sides, for a visual check of the rays
await startScene('ReflectionHuntScene');
await page.evaluate(() => { const sc = window.__askonauts.game.scene.getScene('ReflectionHuntScene'); sc.selectedSurface = 'rough'; sc.renderExperiment(); });
await wait(1500); await shot('08-reflection-rough');
await page.evaluate(() => { const sc = window.__askonauts.game.scene.getScene('ReflectionHuntScene'); sc.selectedSurface = 'spoon'; sc.spoonConcave = true; sc.renderExperiment(); });
await wait(1500); await shot('09-reflection-concave');
await page.evaluate(() => { const sc = window.__askonauts.game.scene.getScene('ReflectionHuntScene'); sc.spoonConcave = false; sc.renderExperiment(); });
await wait(1500); await shot('10-reflection-convex');

// 6. Telemetry is one session covering every world, labelled with the real build
await page.evaluate(() => window.__askonauts.playtest.telemetry.flush());
const summary = await page.evaluate(() => window.__askonauts.playtest.telemetry.getSummary());
const buildId = summary.build;
check('Telemetry build is a real build name', /^P\d[\w.-]*$/.test(buildId) && buildId !== 'P2.1', buildId);
for (const world of ['clubhouse', 'shadow-chase', 'reflection-hunt', 'upside-down-spoon', 'funhouse-mirrors']) {
  check(`Telemetry recorded world: ${world}`, Boolean(summary.worlds[world]));
}
check('Active play is not longer than the session', summary.activeGameplayMs <= summary.durationMs, `${summary.activeGameplayMs} <= ${summary.durationMs}`);
check('Telemetry payload fits the server limits', JSON.stringify(summary.events).length < 50000 && JSON.stringify(summary).length < 70000, `${JSON.stringify(summary).length} chars`);

// 7. Parent panel is reachable in any world
await page.click('.parent-button');
const panelOpen = await page.isVisible('.parent-overlay:not([hidden])');
check('Parent panel opens (Funhouse/Reflection world)', panelOpen);
await shot('11-parent-panel');
await page.click('.parent-action.primary');

check('No page errors in any world', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${OUT}`);
process.exit(failed.length ? 1 : 0);
