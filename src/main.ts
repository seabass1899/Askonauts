import Phaser from 'phaser';
import './style.css';
import { ClubhouseScene } from './game/scenes/ClubhouseScene';
import { ShadowBoxScene } from './game/scenes/ShadowBoxScene';
import { ReflectionHuntScene } from './game/scenes/ReflectionHuntScene';
import { UpsideDownSpoonScene } from './game/scenes/UpsideDownSpoonScene';
import { FunhouseMirrorsScene } from './game/scenes/FunhouseMirrorsScene';
import { collectParentSetup } from './playtest/ParentStart';
import { setPlaytestContext } from './playtest/PlaytestContext';
import { getPlaytestSession, SCENE_WORLD_IDS } from './playtest/PlaytestSession';
import { installParentPanel } from './playtest/ParentPanel';

const context = await collectParentSetup();
setPlaytestContext(context);

// P7.0: one playtest session for the whole visit, and a parent panel that is
// available in every world.
const playtest = getPlaytestSession();
installParentPanel(playtest);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280,
  height: 720,
  backgroundColor: '#111827',
  scene: [ClubhouseScene, ShadowBoxScene, ReflectionHuntScene, UpsideDownSpoonScene, FunhouseMirrorsScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true
  },
  input: {
    activePointers: 1,
    touch: { capture: true }
  }
};

const game = new Phaser.Game(config);

game.events.once(Phaser.Core.Events.READY, () => {
  // Record which world the child is in, for every scene.
  for (const scene of game.scene.scenes) {
    const worldId = SCENE_WORLD_IDS[scene.scene.key] ?? scene.scene.key;
    scene.events.on(Phaser.Scenes.Events.CREATE, () => playtest.telemetry.noteWorldEntered(worldId));
  }
  // Count taps in every world; this also drives the active-play clock.
  game.canvas.addEventListener('pointerdown', () => playtest.telemetry.noteTap(), { capture: true, passive: true });
});

// Automated play-through hook (tests/smoke.mjs). Only present with ?smoke=1.
if (new URLSearchParams(window.location.search).has('smoke')) {
  (window as unknown as { __askonauts: unknown }).__askonauts = { game, playtest };
}

const preventBrowserGesture = (event: Event) => event.preventDefault();
document.addEventListener('contextmenu', preventBrowserGesture, { passive: false });
document.addEventListener('gesturestart', preventBrowserGesture, { passive: false });
document.addEventListener('gesturechange', preventBrowserGesture, { passive: false });
document.addEventListener('gestureend', preventBrowserGesture, { passive: false });

window.addEventListener('orientationchange', () => {
  window.setTimeout(() => game.scale.refresh(), 120);
});
window.addEventListener('resize', () => game.scale.refresh());
