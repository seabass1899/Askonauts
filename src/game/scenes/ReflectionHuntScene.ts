import Phaser from 'phaser';
import { PlayerProgressStore } from '../progress/PlayerProgressStore';
import { MasteryProgress } from '../progress/MasteryProgress';
import { VoiceDirector } from '../systems/VoiceDirector';
import { AudioManager } from '../systems/AudioManager';
import { GlobalGameUI } from '../ui/GlobalGameUI';
import { MissionVariantEngine } from '../systems/MissionVariantEngine';
import { BUILD_ID } from '../../buildInfo';

const W = 1280;
const H = 720;
const WORLD_ID = 'reflection-hunt';

type SurfaceId = 'mirror' | 'spoon' | 'rough';
type ReflectionChallengeId = 'center_bounce' | 'sky_bounce' | 'floor_bounce';

type ReflectionReplayData = {
  replayFocus?: string;
  replayKind?: string;
  replayPrompt?: string;
  startMission?: 'light-rescue';
};

export class ReflectionHuntScene extends Phaser.Scene {
  private progressStore!: PlayerProgressStore;
  private voice!: VoiceDirector;
  private audio!: AudioManager;
  private selectedSurface: SurfaceId = 'mirror';
  private mirrorNormalDeg = -15;
  private spoonConcave = true;
  private beamGraphics!: Phaser.GameObjects.Graphics;
  private surfaceContainer!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private discoveryText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private replayFocus?: string;
  private requestedMission?: 'light-rescue';
  private targetGlow!: Phaser.GameObjects.Arc;
  private targetCore!: Phaser.GameObjects.Arc;
  private targetTitleText!: Phaser.GameObjects.Text;
  private targetHintText!: Phaser.GameObjects.Text;
  private lastTargetHit = false;
  private activeChallengeId: ReflectionChallengeId = 'center_bounce';
  private targetY = 386;
  private challengeOverlay?: Phaser.GameObjects.Container;
  private completionOverlay?: Phaser.GameObjects.Container;
  private clueTracker?: Phaser.GameObjects.Container;
  private worldWasCompleteAtStart = false;
  private missionActive = false;
  private missionIndex = 0;
  private missionOrder: ReflectionChallengeId[] = ['sky_bounce', 'center_bounce', 'floor_bounce'];
  private missionChangingStart = false;
  private missionPrecision = false;
  private missionMoveGoal?: number;
  private missionRecipeLabel = 'SURPRISE RESCUE';
  private missionAttempts = 0;
  private missionNearMissShown = false;
  private missionHintShown = false;
  private lightDanceSteps = 0;
  private lastRotateDirection = 0;
  private lastRotateAt = 0;
  private lightDanceCooldown = false;

  constructor() {
    super('ReflectionHuntScene');
  }

  preload(): void {
    this.load.image('reflection-veya', '/assets/characters/clubhouse/veya-clubhouse-p51-hf1.webp');
    this.load.image('reflection-quip', '/assets/characters/quip/quip-clubhouse-p60a.webp');
  }

  init(data: ReflectionReplayData): void {
    this.replayFocus = data?.replayFocus;
    this.requestedMission = data?.startMission;
  }

  create(): void {
    this.progressStore = new PlayerProgressStore();
    this.progressStore.setLastWorld(WORLD_ID);
    this.worldWasCompleteAtStart = this.progressStore.getWorldProgress(WORLD_ID).completed;
    this.audio = new AudioManager(this);
    this.voice = this.audio.voice;

    this.cameras.main.setBackgroundColor('#07111f');
    this.drawRoom();
    this.createHeader();
    this.createGuideBanner();
    this.createExperimentStage();
    this.createDiscoveryTracker();
    this.createSurfaceSelector();
    this.createControls();
    this.createProgressPanel();
    this.renderExperiment();

    if (this.requestedMission === 'light-rescue') {
      this.time.delayedCall(500, () => this.startReflectionMission());
    } else {
      this.time.delayedCall(700, () => {
        this.voice.speak(
          'reflection.welcome',
          'Welcome to Reflection Hunt. Which surfaces can send light back in a clear direction?',
          { priority: 25, exclusive: true, speaker: 'veya' }
        );
      });
    }

    if (this.replayFocus) {
      this.time.delayedCall(1100, () => {
        this.showDiscoveryMessage(`TRY IT AGAIN: ${this.pretty(this.replayFocus!)}`, '#c4b5fd');
      });
    }

    this.checkCompletion();
  }

  private drawRoom(): void {
    const g = this.add.graphics().setDepth(0);

    // P6.4D — Crystalline Light Observatory.  Keep all operational copy in Phaser.
    g.fillStyle(0x030716, 1).fillRect(0, 0, W, H);
    g.fillStyle(0x07132b, 1).fillRect(0, 82, W, H - 82);

    // Deep observatory alcove.
    g.fillStyle(0x120d31, 1).fillRoundedRect(16, 94, 1248, 610, 34);
    g.lineStyle(5, 0xd39b3f, 0.78).strokeRoundedRect(16, 94, 1248, 610, 34);
    g.fillStyle(0x081a39, 0.98).fillRoundedRect(31, 110, 1218, 578, 30);
    g.lineStyle(2, 0x4fdcff, 0.32).strokeRoundedRect(31, 110, 1218, 578, 30);

    // Layered star/cavern backdrop.
    g.fillStyle(0x0b2148, 0.95).fillEllipse(640, 340, 940, 520);
    g.fillStyle(0x111a4a, 0.82).fillEllipse(640, 345, 760, 470);
    g.fillStyle(0x0a1737, 0.94).fillEllipse(640, 355, 590, 420);
    for (const [x,y,r,a] of [[410,176,2,0.8],[452,224,3,0.6],[522,153,2,0.9],[687,162,2,0.7],[764,208,3,0.7],[842,164,2,0.9],[900,260,2,0.7],[365,310,2,0.8],[930,355,2,0.7],[580,215,1.5,0.9]] as Array<[number,number,number,number]>) {
      g.fillStyle(0xdbeafe, a).fillCircle(x, y, r);
    }

    // Grand portal / mirror instrument frame.
    g.fillStyle(0x07162f, 1).fillEllipse(640, 404, 390, 388);
    g.lineStyle(15, 0xc9933f, 0.92).strokeEllipse(640, 404, 390, 388);
    g.lineStyle(5, 0x52e5ff, 0.84).strokeEllipse(640, 404, 352, 354);
    g.lineStyle(2, 0xc4b5fd, 0.35).strokeEllipse(640, 404, 322, 330);

    // Brass supports around the optical instrument.
    g.lineStyle(7, 0x7b4a21, 0.92).lineBetween(458, 286, 416, 548);
    g.lineBetween(822, 286, 864, 548);
    g.lineStyle(2, 0xf7c96a, 0.45).lineBetween(458, 286, 416, 548);
    g.lineBetween(822, 286, 864, 548);

    // Reflective floor / pool.
    g.fillStyle(0x061426, 1).fillRect(0, 548, W, 172);
    g.fillStyle(0x0b2a4a, 0.82).fillEllipse(640, 637, 1040, 174);
    g.lineStyle(3, 0x38bdf8, 0.26).strokeEllipse(640, 637, 1040, 174);
    g.lineStyle(2, 0xa78bfa, 0.24).strokeEllipse(640, 637, 820, 126);
    g.lineStyle(1, 0x7dd3fc, 0.16).strokeEllipse(640, 637, 610, 90);

    // Side laboratory towers.
    for (const x of [76, 1204]) {
      g.fillStyle(0x21143b, 1).fillRoundedRect(x - 30, 132, 60, 424, 18);
      g.lineStyle(3, 0xc9933f, 0.58).strokeRoundedRect(x - 30, 132, 60, 424, 18);
      g.fillStyle(0x0a1c3e, 1).fillRoundedRect(x - 20, 148, 40, 390, 12);
      g.lineStyle(2, 0x7dd3fc, 0.18).strokeRoundedRect(x - 20, 148, 40, 390, 12);
    }

    // Crystal clusters and animated bloom.
    const clusters: Array<[number, number, number, number]> = [
      [108, 522, 0x60a5fa, 1.0], [151, 546, 0xa78bfa, 0.78], [1172, 520, 0xc084fc, 1.0],
      [1128, 548, 0x22d3ee, 0.82], [335, 177, 0x818cf8, 0.62], [945, 174, 0x67e8f9, 0.62]
    ];
    clusters.forEach(([x, y, color, scale], index) => {
      const glow = this.add.circle(x, y, 38 * scale, color, 0.07).setDepth(1);
      const crystal = this.add.polygon(x, y, [0,-39,19,-8,10,36,-10,36,-19,-8], color, 0.82)
        .setScale(scale).setDepth(2).setStrokeStyle(2, 0xffffff, 0.42);
      this.tweens.add({ targets: [crystal, glow], alpha: { from: 0.66, to: 1 }, duration: 1500 + index * 120, yoyo: true, repeat: -1 });
    });

    // Hanging prism lamps.
    for (const [i, x] of [320, 640, 960].entries()) {
      g.lineStyle(2, 0xc9933f, 0.68).lineBetween(x, 82, x, 117);
      const halo = this.add.circle(x, 132, 33, 0xffd76a, 0.08).setDepth(1);
      const jewel = this.add.polygon(x, 132, [0,-19,12,-4,7,16,-7,16,-12,-4], i === 1 ? 0xffe384 : 0x7dd3fc, 0.94).setDepth(3).setStrokeStyle(2, 0xffffff, 0.5);
      this.tweens.add({ targets: halo, alpha: { from: 0.04, to: 0.16 }, scale: { from: 0.9, to: 1.18 }, duration: 1450 + i * 210, yoyo: true, repeat: -1 });
      void jewel;
    }
  }

  private createHeader(): void {
    const identity = this.progressStore.getIdentity();
    this.add.rectangle(W / 2, 41, W - 12, 74, 0x041329, 0.99)
      .setStrokeStyle(2, 0xd6ad54, 0.92).setDepth(20);

    this.add.text(34, 19, '✦ ASKONAUTS', {
      fontFamily: 'Arial, sans-serif', fontSize: '27px', fontStyle: 'bold', color: '#ffe384',
      stroke: '#123c88', strokeThickness: 4
    }).setDepth(21);
    this.add.text(38, 53, `REFLECTION LAB  •  ${BUILD_ID}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#67e8f9'
    }).setDepth(21);

    const badge = (x: number, w: number, title: string, sub: string, stroke: number) => {
      this.add.rectangle(x, 41, w, 48, 0x081a35, 0.98).setStrokeStyle(2, stroke, 0.92).setDepth(21);
      this.add.text(x, 31, title, { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(22);
      this.add.text(x, 51, sub, { fontFamily: 'Arial, sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#93c5fd' }).setOrigin(0.5).setDepth(22);
    };
    badge(610, 158, 'MASTER ASKONAUT', 'LIGHT & REFLECTION', 0xd6ad54);
    badge(785, 145, identity.name, 'MY ASKONAUT', 0xa78bfa);

    const mission = this.add.rectangle(930, 41, 112, 44, 0x5b2d73, 0.99)
      .setStrokeStyle(2, 0xf6c85f, 0.98).setInteractive({ useHandCursor: true }).setDepth(21);
    this.add.text(930, 41, 'LIGHT RESCUE', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffe384'
    }).setOrigin(0.5).setDepth(22);
    mission.on('pointerover', () => mission.setFillStyle(0x70408a, 1));
    mission.on('pointerout', () => mission.setFillStyle(0x5b2d73, 0.99));
    mission.on('pointerdown', () => this.startReflectionMission());

    new GlobalGameUI(this, this.progressStore, this.audio, {
      renderButtons: true, compact: true, startX: 1002, y: 41, showClubhouse: true
    });
  }

  private createGuideBanner(): void {
    const banner = this.add.container(640, 116).setDepth(18);
    const bg = this.add.rectangle(0, 0, 606, 56, 0x06162f, 0.97).setStrokeStyle(2, 0x7dd3fc, 0.78);
    const accent = this.add.rectangle(-298, 0, 6, 50, 0xd946ef, 0.92);
    banner.add([bg, accent]);

    if (this.textures.exists('reflection-veya')) {
      const portrait = this.add.image(-258, 2, 'reflection-veya').setDisplaySize(40, 56);
      banner.add(portrait);
    }
    const name = this.add.text(-226, -17, 'VEYA', { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#f472d0' });
    const line1 = this.add.text(-226, -1, 'Light always leaves clues.', { fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#ffffff' });
    const line2 = this.add.text(-226, 18, 'Change one thing, then watch where the reflection goes.', { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#cfe8ff' });
    banner.add([name, line1, line2]);

    // Character observers live below the beam line so they support the experiment rather than cover it.
    const observerBase = this.add.ellipse(362, 539, 190, 30, 0x07162f, 0.76)
      .setStrokeStyle(2, 0x38bdf8, 0.22).setDepth(6);
    void observerBase;
    if (this.textures.exists('reflection-veya')) {
      this.add.image(326, 482, 'reflection-veya').setDisplaySize(82, 136).setDepth(8);
      this.add.text(326, 551, 'VEYA', { fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#f9a8d4', stroke: '#06162f', strokeThickness: 4 }).setOrigin(0.5).setDepth(9);
    }
    if (this.textures.exists('reflection-quip')) {
      const quip = this.add.image(400, 490, 'reflection-quip').setDisplaySize(88, 114).setDepth(8);
      this.tweens.add({ targets: quip, y: 485, duration: 1700, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
      this.add.text(400, 551, 'QUIP', { fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#c4b5fd', stroke: '#06162f', strokeThickness: 4 }).setOrigin(0.5).setDepth(9);
    }
  }

  private createExperimentStage(): void {
    const lampX = 176;
    const lampY = 402;
    const lamp = this.add.container(lampX, lampY).setDepth(8);
    const base = this.add.rectangle(-53, 0, 76, 62, 0x142b4d, 1).setStrokeStyle(4, 0xc9933f, 1);
    const ring = this.add.circle(-8, 0, 42, 0x6b3c18, 1).setStrokeStyle(5, 0xf0bd57, 1);
    const lens = this.add.circle(0, 0, 34, 0xffdf78, 1).setStrokeStyle(5, 0xffefae, 0.95);
    const core = this.add.circle(0, 0, 21, 0xfff5c7, 0.98);
    const halo = this.add.circle(0, 0, 58, 0xffe27c, 0.08);
    lamp.add([halo, base, ring, lens, core]);
    this.tweens.add({ targets: halo, scale: { from: 0.86, to: 1.08 }, alpha: { from: 0.04, to: 0.14 }, duration: 1050, yoyo: true, repeat: -1 });
    this.add.text(lampX, lampY + 60, 'LIGHT SOURCE', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffe384', stroke: '#07111f', strokeThickness: 4
    }).setOrigin(0.5).setDepth(9);

    this.surfaceContainer = this.add.container(640, 404).setDepth(10);

    // Ornate target receptor rather than a plain wall.
    this.add.rectangle(1092, 405, 166, 300, 0x102644, 0.98).setStrokeStyle(6, 0xc9933f, 1).setDepth(5);
    this.add.rectangle(1092, 405, 146, 280, 0x0b1a34, 0.96).setStrokeStyle(2, 0x67e8f9, 0.38).setDepth(5);
    this.add.rectangle(1092, 405, 118, 244, 0xe9e2c9, 0.92).setStrokeStyle(3, 0xf7c96a, 0.7).setDepth(5);
    this.targetTitleText = this.add.text(1092, 244, 'REFLECTION TARGET', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffe384', stroke: '#07111f', strokeThickness: 4
    }).setOrigin(0.5).setDepth(9);
    this.targetHintText = this.add.text(1092, 265, 'Guide the blue reflected beam\ninto the glowing receptor.', {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#e6f3ff', align: 'center', wordWrap: { width: 170 }, stroke: '#07111f', strokeThickness: 3
    }).setOrigin(0.5).setDepth(9);
    this.targetGlow = this.add.circle(1092, this.targetY, 36, 0x60a5fa, 0.12).setDepth(7);
    this.targetCore = this.add.circle(1092, this.targetY, 15, 0x38bdf8, 0.42).setStrokeStyle(3, 0xe0f7ff, 0.9).setDepth(8);
    this.tweens.add({ targets: this.targetGlow, scale: { from: 0.86, to: 1.18 }, alpha: { from: 0.06, to: 0.22 }, duration: 1050, yoyo: true, repeat: -1 });

    this.beamGraphics = this.add.graphics().setDepth(6);
  }

  private createDiscoveryTracker(): void {
    this.refreshDiscoveryTracker();
  }

  private refreshDiscoveryTracker(): void {
    this.clueTracker?.destroy(true);

    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    const tracker = this.add.container(0, 0).setDepth(11);
    this.clueTracker = tracker;

    const clues: Array<{ id: string; label: string; short: string }> = [
      { id: 'mirror_reflects', label: 'MIRROR', short: 'SMOOTH' },
      { id: 'rough_scatter', label: 'ROUGH', short: 'SCATTERS' },
      { id: 'angle_changes_reflection', label: 'ANGLE', short: 'STEERS' },
      { id: 'curved_surface_changes_image', label: 'CURVE', short: 'CHANGES IMAGE' }
    ];

    const startX = 478;
    const gap = 132;
    const y = 198;

    clues.forEach((clue, index) => {
      const complete = progress.discoveries.includes(clue.id);
      const x = startX + index * gap;
      const fill = complete ? 0x24483a : 0x14192a;
      const stroke = complete ? 0x86efac : 0x475569;
      const titleColor = complete ? '#d1fae5' : '#94a3b8';
      const subColor = complete ? '#86efac' : '#64748b';

      const card = this.add.rectangle(x, y, 118, 62, fill, 0.96)
        .setStrokeStyle(2, stroke, complete ? 0.95 : 0.65);
      const state = this.add.text(x, y - 15, complete ? '✓' : '○', {
        fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: complete ? '#86efac' : '#64748b'
      }).setOrigin(0.5);
      const title = this.add.text(x, y + 1, clue.label, {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: titleColor
      }).setOrigin(0.5);
      const sub = this.add.text(x, y + 17, complete ? clue.short : 'FIND THIS CLUE', {
        fontFamily: 'Arial, sans-serif', fontSize: '8px', fontStyle: 'bold', color: subColor
      }).setOrigin(0.5);

      tracker.add([card, state, title, sub]);
    });

    const label = this.add.text(676, 160, 'REFLECTION CLUES', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#c4b5fd'
    }).setOrigin(0.5);
    tracker.add(label);
  }

  private createSurfaceSelector(): void {
    const panelX = 128;
    const panelY = 590;
    this.add.rectangle(panelX, panelY, 206, 190, 0x06162f, 0.97)
      .setStrokeStyle(3, 0xd6ad54, 0.92).setDepth(12);
    this.add.text(panelX, panelY - 77, 'TEST A SURFACE', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#67e8f9'
    }).setOrigin(0.5).setDepth(13);

    const options: Array<{ id: SurfaceId; label: string; sub: string; y: number; color: number }> = [
      { id: 'mirror', label: 'MIRROR', sub: 'SMOOTH', y: panelY - 32, color: 0x38bdf8 },
      { id: 'spoon', label: 'SPOON', sub: 'CURVED', y: panelY + 18, color: 0xa78bfa },
      { id: 'rough', label: 'ROUGH PANEL', sub: 'SCATTERS', y: panelY + 68, color: 0xf59e0b }
    ];
    options.forEach(({ id, label, sub, y, color }) => {
      const selected = id === this.selectedSurface;
      const box = this.add.rectangle(panelX, y, 158, 42, selected ? 0x163a5f : 0x0a203e, 0.99)
        .setStrokeStyle(2, selected ? color : 0x52627c, selected ? 1 : 0.72)
        .setInteractive({ useHandCursor: true }).setDepth(13).setName(`surface-${id}`);
      const title = this.add.text(panelX - 16, y - 5, label, { fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(14);
      const subtitle = this.add.text(panelX - 16, y + 10, sub, { fontFamily: 'Arial, sans-serif', fontSize: '7px', fontStyle: 'bold', color: '#9edfff' }).setOrigin(0.5).setDepth(14);
      const dot = this.add.circle(panelX + 58, y, 6, color, selected ? 1 : 0.45).setDepth(14);
      box.on('pointerover', () => box.setFillStyle(0x173b5b, 1));
      box.on('pointerout', () => box.setFillStyle(id === this.selectedSurface ? 0x163a5f : 0x0a203e, 0.99));
      box.on('pointerdown', () => this.selectSurface(id));
      void title; void subtitle; void dot;
    });
  }

  private createControls(): void {
    const y = 608;
    const makeButton = (x: number, label: string, fill: number, stroke: number, action: () => void) => {
      const glow = this.add.rectangle(x, y, 152, 48, stroke, 0.08).setDepth(13);
      const box = this.add.rectangle(x, y, 148, 44, fill, 0.99).setStrokeStyle(2, stroke, 0.94).setInteractive({ useHandCursor: true }).setDepth(14);
      this.add.text(x, y, label, { fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(15);
      box.on('pointerover', () => { box.setScale(1.02); glow.setAlpha(0.2); });
      box.on('pointerout', () => { box.setScale(1); glow.setAlpha(0.08); });
      box.on('pointerdown', () => { this.tweens.add({ targets: box, scale: 0.97, duration: 70, yoyo: true }); action(); });
    };
    makeButton(445, '↺  ROTATE LEFT', 0x0b3158, 0x60a5fa, () => this.rotateMirror(-5));
    makeButton(605, 'ROTATE RIGHT  ↻', 0x0b3158, 0x60a5fa, () => this.rotateMirror(5));
    makeButton(765, 'FLIP SPOON', 0x45236d, 0xc084fc, () => this.flipSpoon());
  }

  private createProgressPanel(): void {
    this.add.rectangle(1005, 608, 270, 84, 0x06162f, 0.97).setStrokeStyle(3, 0xd6ad54, 0.9).setDepth(13);
    this.progressText = this.add.text(1005, 591, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffe384', align: 'center'
    }).setOrigin(0.5).setDepth(14);
    this.statusText = this.add.text(1005, 618, 'Try changing one thing at a time.', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#dbeafe', align: 'center', wordWrap: { width: 232 }, stroke: '#06162f', strokeThickness: 2
    }).setOrigin(0.5).setDepth(14);
    this.discoveryText = this.add.text(640, 680, 'QUESTION: Why can we see ourselves in some things?', {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#f4e8ff', align: 'center', stroke: '#06162f', strokeThickness: 5
    }).setOrigin(0.5).setDepth(14);
    this.updateProgressText();
  }

  private selectSurface(id: SurfaceId): void {
    this.selectedSurface = id;
    for (const surface of ['mirror', 'spoon', 'rough'] as SurfaceId[]) {
      const box = this.children.getByName(`surface-${surface}`) as Phaser.GameObjects.Rectangle | null;
      box?.setStrokeStyle(2, surface === id ? 0xa78bfa : 0x475569, 0.9);
    }

    if (id === 'mirror') {
      const discovered = this.recordDiscovery('mirror_reflects', 'MIRROR BRIGHT', 'A smooth mirror sends light back in a clear direction.');
      if (discovered) {
        this.voice.speak('reflection.mirror', 'The mirror makes a clear reflection. Smooth surfaces keep the reflected light organized.', { priority: 18, speaker: 'veya' });
      }
    } else if (id === 'rough') {
      const discovered = this.recordDiscovery('rough_scatter', 'ROUGH SCATTER', 'The rough panel scatters the reflected light instead of making a clear image.');
      if (discovered) {
        this.voice.speak('reflection.rough', 'That rough surface still reflects some light, but it scatters it in many directions.', { priority: 18, speaker: 'veya' });
      }
    } else {
      const discovered = this.recordDiscovery('curved_surface_changes_image', 'CURVED REFLECTION', 'The spoon is shiny, but its curved surface changes the image.');
      if (discovered) {
        this.voice.speak('reflection.spoon', 'The spoon reflects too, but its curved surface changes what the image looks like.', { priority: 18, speaker: 'veya' });
      }
    }
    this.renderExperiment();
    this.checkCompletion();
  }

  private rotateMirror(delta: number): void {
    if (this.selectedSurface !== 'mirror') {
      this.statusText.setText('Select the MIRROR first, then rotate it.');
      this.pulseStatus();
      return;
    }
    if (this.missionActive) this.missionAttempts += 1;
    this.mirrorNormalDeg = Phaser.Math.Clamp(this.mirrorNormalDeg + delta, -65, 45);
    const discovered = this.recordDiscovery('angle_changes_reflection', 'ANGLE MATTERS', 'Turning the mirror changes where the reflected beam goes.');
    if (discovered) {
      this.voice.speak('reflection.angle', 'The mirror turned, and the reflected light moved. The angle matters.', { priority: 18, speaker: 'veya' });
    }
    this.renderExperiment();
    this.checkCompletion();
    this.registerLightDanceStep(delta);
  }

  private registerLightDanceStep(delta: number): void {
    if (this.missionActive || this.lightDanceCooldown) return;
    const now = this.time.now;
    const direction = Math.sign(delta);

    if (now - this.lastRotateAt > 1400 || direction === this.lastRotateDirection) {
      this.lightDanceSteps = 1;
    } else {
      this.lightDanceSteps += 1;
    }

    this.lastRotateAt = now;
    this.lastRotateDirection = direction;

    if (this.lightDanceSteps >= 4) {
      this.lightDanceSteps = 0;
      this.playLightDanceSurprise();
    }
  }

  private playLightDanceSurprise(): void {
    this.lightDanceCooldown = true;
    const sparkles: Phaser.GameObjects.Arc[] = [];
    const points = [[710,330],[770,350],[835,315],[900,365],[955,330],[1010,380]];
    points.forEach(([x, y], i) => {
      const sparkle = this.add.circle(x, y, 5 + (i % 2), i % 2 === 0 ? 0x8bd3ff : 0xffe384, 0.95).setDepth(45);
      sparkle.setScale(0.2);
      sparkles.push(sparkle);
      this.tweens.add({
        targets: sparkle,
        scale: 2.1,
        alpha: 0,
        delay: i * 70,
        duration: 650,
        ease: 'Cubic.Out',
        onComplete: () => sparkle.destroy()
      });
    });
    void sparkles;
    this.showDiscoveryMessage('SECRET SURPRISE: LIGHT DANCE!', '#ffe384');
    this.statusText?.setText('You made the reflected beam dance by changing the mirror back and forth.');
    this.voice.speak('reflection.surprise.light-dance', 'Whoa! You made the light dance!', { priority: 19, speaker: 'quip' });
    this.time.delayedCall(4200, () => { this.lightDanceCooldown = false; });
  }

  private flipSpoon(): void {
    if (this.selectedSurface !== 'spoon') {
      this.statusText.setText('Select the SPOON first, then flip it.');
      this.pulseStatus();
      return;
    }
    this.spoonConcave = !this.spoonConcave;
    this.renderExperiment();
    this.statusText.setText(this.spoonConcave
      ? 'Concave side: the reflected image can behave very differently with distance.'
      : 'Convex side: the reflected image stays upright and looks smaller.');
    this.voice.speak(
      'reflection.spoon.flip',
      this.spoonConcave
        ? 'Now the spoon curves inward. That gives us another question for later.'
        : 'Now the spoon curves outward. The image changes again.',
      { priority: 15, speaker: 'teyo' }
    );
  }

  private renderExperiment(): void {
    this.surfaceContainer.removeAll(true);
    this.beamGraphics.clear();

    const lamp = new Phaser.Math.Vector2(176, 402);
    const surface = new Phaser.Math.Vector2(640, 404);

    // Incoming beam. For the spoon, drawSpoonRays draws its own incoming rays.
    if (this.selectedSurface !== 'spoon') {
      const endX = this.selectedSurface === 'rough' ? surface.x - 23 : surface.x;
      this.beamGraphics.lineStyle(14, 0xffe27c, 0.12).lineBetween(lamp.x, lamp.y, endX, surface.y);
      this.beamGraphics.lineStyle(4, 0xffe27c, 0.9).lineBetween(lamp.x, lamp.y, endX, surface.y);
    }

    if (this.selectedSurface === 'mirror') {
      const mirror = this.add.rectangle(0, 0, 18, 170, 0xdbeafe, 1)
        .setStrokeStyle(4, 0x7dd3fc, 1)
        .setAngle(this.mirrorNormalDeg + 90);
      const glow = this.add.rectangle(0, 0, 30, 185, 0x60a5fa, 0.10).setAngle(this.mirrorNormalDeg + 90);
      this.surfaceContainer.add([glow, mirror]);
      this.drawReflectedRay(lamp, surface);
      this.statusText?.setText(`Mirror angle: ${this.mirrorNormalDeg}° — rotate it and watch the reflected beam.`);
    } else if (this.selectedSurface === 'rough') {
      const rough = this.add.rectangle(0, 0, 46, 170, 0x736558, 1).setStrokeStyle(4, 0xb7a38c, 0.9);
      this.surfaceContainer.add(rough);
      // P7.0: scattered light leaves the FRONT of the panel, back toward the
      // lamp's side, in many directions. P6.5 drew it continuing out the back
      // of the panel, as if light passed through it.
      const face = surface.x - 23;
      for (let i = -3; i <= 3; i++) {
        const angle = Phaser.Math.DegToRad(180 + i * 19);
        const startY = surface.y + i * 9;
        const ex = face + Math.cos(angle) * 230;
        const ey = startY + Math.sin(angle) * 230;
        this.beamGraphics.lineStyle(3, 0xffe9a8, 0.22).lineBetween(face, startY, ex, ey);
      }
      this.targetCore.setFillStyle(0x64748b, 0.25);
      this.lastTargetHit = false;
      this.statusText?.setText('The rough panel scatters light in many directions.');
    } else {
      const bowlColor = this.spoonConcave ? 0xd6d9e0 : 0xbac7d6;
      const spoon = this.add.ellipse(0, -20, 86, 126, bowlColor, 1).setStrokeStyle(5, 0xf8fafc, 0.85);
      const inner = this.add.ellipse(0, -20, 60, 96, this.spoonConcave ? 0x68758a : 0xe2e8f0, 0.9);
      const handle = this.add.rectangle(0, 80, 18, 115, 0xcbd5e1, 1).setStrokeStyle(3, 0xf8fafc, 0.8);
      const label = this.add.text(0, 154, this.spoonConcave ? 'CONCAVE' : 'CONVEX', {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#c4b5fd'
      }).setOrigin(0.5);
      this.surfaceContainer.add([spoon, inner, handle, label]);

      // P7.0: reflected rays come back off the bowl toward the lamp's side,
      // traced with the mirror equation (1/f = 1/d_object + 1/d_image).
      // Concave: they meet at a real image point in front of the spoon, then
      // cross. Convex: they spread apart as if from a point behind the spoon.
      // P6.5 drew them continuing to the right, through the spoon, and its
      // "converging" rays actually spread.
      this.drawSpoonRays(lamp, surface);
      this.targetCore.setFillStyle(0xa78bfa, 0.32);
      this.lastTargetHit = false;
      this.statusText?.setText(this.spoonConcave
        ? 'Curved inward: reflected rays meet at a point, then cross.'
        : 'Curved outward: reflected rays spread apart.');
    }
  }

  private drawSpoonRays(lamp: Phaser.Math.Vector2, surface: Phaser.Math.Vector2): void {
    const bowl = { x: surface.x, y: surface.y - 20, rx: 43, ry: 63 };
    const focal = this.spoonConcave ? 110 : -110;
    const objectDistance = bowl.x - lamp.x;
    const imageDistance = 1 / (1 / focal - 1 / objectDistance);
    const magnification = -imageDistance / objectDistance;
    // Positive imageDistance = real image in front (lamp side); negative = virtual, behind.
    const image = {
      x: bowl.x - imageDistance,
      y: bowl.y + (lamp.y - bowl.y) * magnification
    };

    for (const dy of [-42, -16, 16, 42]) {
      const hitY = bowl.y + dy;
      const hitX = bowl.x - bowl.rx * Math.sqrt(Math.max(0, 1 - (dy / bowl.ry) ** 2));
      // Incoming ray from the lamp to the bowl.
      this.beamGraphics.lineStyle(2, 0xffe27c, 0.55).lineBetween(lamp.x, lamp.y, hitX, hitY);
      // Reflected ray.
      const dir = this.spoonConcave
        ? new Phaser.Math.Vector2(image.x - hitX, image.y - hitY)
        : new Phaser.Math.Vector2(hitX - image.x, hitY - image.y);
      dir.normalize();
      const length = this.spoonConcave
        ? Math.hypot(image.x - hitX, image.y - hitY) + 110
        : 230;
      this.beamGraphics
        .lineStyle(3, 0xd8b4fe, 0.6)
        .lineBetween(hitX, hitY, hitX + dir.x * length, hitY + dir.y * length);
    }

    if (this.spoonConcave) {
      // Mark where the rays meet.
      this.beamGraphics.fillStyle(0xf5d0fe, 0.9).fillCircle(image.x, image.y, 5);
    }
  }

  private drawReflectedRay(lamp: Phaser.Math.Vector2, surface: Phaser.Math.Vector2): void {
    const incoming = surface.clone().subtract(lamp).normalize();
    const normalAngle = Phaser.Math.DegToRad(this.mirrorNormalDeg);
    const normal = new Phaser.Math.Vector2(Math.cos(normalAngle), Math.sin(normalAngle)).normalize();
    const dot = incoming.dot(normal);
    const reflected = incoming.clone().subtract(normal.clone().scale(2 * dot)).normalize();

    // Make the ray travel toward the target wall. Mirror normal can mathematically
    // reflect leftward at extreme angles; flip only the presentation direction so
    // children always see the outgoing branch in the experiment area.
    if (reflected.x < 0) reflected.scale(-1);

    const wallX = 1092;
    const distance = (wallX - surface.x) / Math.max(0.15, reflected.x);
    const hitY = surface.y + reflected.y * distance;
    const clampedY = Phaser.Math.Clamp(hitY, 200, 530);

    this.beamGraphics.lineStyle(14, 0x8bd3ff, 0.10).lineBetween(surface.x, surface.y, wallX, clampedY);
    this.beamGraphics.lineStyle(4, 0x8bd3ff, 0.92).lineBetween(surface.x, surface.y, wallX, clampedY);

    const targetDistance = Math.abs(clampedY - this.targetY);
    const hitTolerance = this.missionActive && this.missionPrecision && this.missionAttempts < 4 ? 30 : 38;
    const hit = targetDistance < hitTolerance;
    this.targetGlow.setPosition(1092, this.targetY);
    this.targetCore.setPosition(1092, this.targetY).setFillStyle(hit ? 0xffe27c : 0x38bdf8, hit ? 0.95 : 0.4);

    if (this.missionActive && !hit) {
      if (targetDistance < 86 && !this.missionNearMissShown) {
        this.missionNearMissShown = true;
        this.showDiscoveryMessage('TEYO: SO CLOSE!  •  MAKE ONE TINY ADJUSTMENT', '#8bd3ff');
        this.voice.speak(`reflection.mission.near.${this.missionIndex}`, 'So close. Make one tiny adjustment and watch where the blue beam moves.', { priority: 18, speaker: 'teyo' });
        this.tweens.add({ targets: [this.targetGlow, this.targetCore], scale: 1.24, duration: 140, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
      } else if (this.missionAttempts >= 4 && !this.missionHintShown) {
        this.missionHintShown = true;
        this.showDiscoveryMessage('TEYO HINT: USE SMALL TURNS — WATCH WHICH WAY THE BLUE BEAM MOVES', '#c4b5fd');
        this.voice.speak(`reflection.mission.hint.${this.missionIndex}`, 'Use smaller turns. Watch which way the blue beam moves, then correct toward the target.', { priority: 17, speaker: 'teyo' });
      }
    }

    if (hit && !this.lastTargetHit) {
      if (this.missionActive) {
        this.handleReflectionMissionHit();
      } else {
        const secretId = this.challengeSecretId(this.activeChallengeId);
        const title = this.challengeTitle(this.activeChallengeId);
        const added = this.progressStore.recordWorldSecret(WORLD_ID, secretId, 1);
        if (added) {
          this.showChallengeSuccess(title);
          this.voice.speak(`reflection.challenge.${this.activeChallengeId}`, `${title}! You controlled the reflected light with the mirror angle.`, { priority: 26, exclusive: true, speaker: 'teyo' });
          this.updateProgressText();
          this.checkTripleBounce();
        }
      }
    }
    this.lastTargetHit = hit;
  }

  private showChallengeSuccess(title: string): void {
    this.showDiscoveryMessage(`✦ CHALLENGE COMPLETE: ${title}!`, '#ffe384');

    const flash = this.add.circle(1092, this.targetY, 28, 0xffe384, 0.75).setDepth(35);
    const ring = this.add.circle(1092, this.targetY, 34, 0xffffff, 0.01).setStrokeStyle(5, 0xffe384, 1).setDepth(35);
    const banner = this.add.container(W / 2, 190).setDepth(70);
    const bannerBg = this.add.rectangle(0, 0, 520, 92, 0x111d33, 0.97).setStrokeStyle(3, 0xffe384, 1);
    const bannerTitle = this.add.text(0, -15, `${title} COMPLETE!`, {
      fontFamily: 'Arial, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffe384'
    }).setOrigin(0.5);
    const bannerSub = this.add.text(0, 20, '+1 CURIOSITY SPARK', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#c4b5fd'
    }).setOrigin(0.5);
    banner.add([bannerBg, bannerTitle, bannerSub]);
    banner.setScale(0.86).setAlpha(0);

    this.tweens.add({ targets: [flash, ring], scale: 2.2, alpha: 0, duration: 620, ease: 'Cubic.Out', onComplete: () => { flash.destroy(); ring.destroy(); } });
    this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 240, ease: 'Back.Out' });
    this.time.delayedCall(3000, () => {
      if (!banner.active) return;
      this.tweens.add({ targets: banner, y: 165, alpha: 0, duration: 260, onComplete: () => banner.destroy(true) });
    });
  }

  private recordDiscovery(id: string, title: string, message: string): boolean {
    const added = this.progressStore.recordWorldDiscovery(WORLD_ID, id, 1);
    if (!added) {
      this.statusText?.setText(message);
      return false;
    }
    this.showDiscoveryMessage(`DISCOVERY: ${title}`, '#8bd3ff');
    this.statusText?.setText(message);
    this.updateProgressText();
    this.refreshDiscoveryTracker();
    return true;
  }

  private showDiscoveryMessage(text: string, color: string): void {
    this.discoveryText?.setText(text).setColor(color).setScale(0.92).setAlpha(0.2);
    this.tweens.add({ targets: this.discoveryText, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
    this.time.delayedCall(5200, () => {
      if (this.discoveryText?.active) {
        this.discoveryText.setText('QUESTION: Why can we see ourselves in some things?').setColor('#f4e8ff');
      }
    });
  }

  private updateProgressText(): void {
    if (!this.progressText) return;
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    const core = ['mirror_reflects', 'rough_scatter', 'angle_changes_reflection', 'curved_surface_changes_image'];
    const found = core.filter((id) => progress.discoveries.includes(id)).length;
    const challengeIds = ['perfect_bounce', 'sky_bounce', 'floor_bounce'];
    const challengeCount = challengeIds.filter((id) => progress.secrets.includes(id)).length;
    this.progressText.setText(`${found} / ${core.length} REFLECTION CLUES  •  ${challengeCount} / 3 CHALLENGES`);
    this.refreshDiscoveryTracker();
  }

  private checkCompletion(): void {
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    const required = ['mirror_reflects', 'rough_scatter', 'angle_changes_reflection', 'curved_surface_changes_image'];
    const complete = required.every((id) => progress.discoveries.includes(id));
    if (!complete) return;

    if (progress.completed) {
      if (this.worldWasCompleteAtStart) {
        this.statusText?.setText('Reflection Hunt complete. The Upside-Down Spoon question is waiting in the Clubhouse.');
      }
      return;
    }

    this.progressStore.completeWorld(WORLD_ID);
    this.showDiscoveryMessage('REFLECTION LAB COMPLETE!', '#ffe384');
    this.voice.speakAndWait(
      'reflection.complete',
      'You found the pattern. Smooth surfaces can reflect light clearly, rough surfaces scatter it, and changing the surface changes the reflection.',
      { priority: 40, exclusive: true, speaker: 'veya' }
    ).then(() => this.showWorldCompletion());
  }

  private showWorldCompletion(): void {
    if (this.completionOverlay) return;
    const overlay = this.add.container(0, 0).setDepth(90);
    this.completionOverlay = overlay;

    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0.76).setInteractive();
    const panel = this.add.rectangle(W / 2, H / 2, 760, 430, 0x0b1728, 0.99).setStrokeStyle(4, 0xd6ad54, 1);
    const title = this.add.text(W / 2, 190, 'REFLECTION LAB COMPLETE!', {
      fontFamily: 'Arial, sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#ffe384'
    }).setOrigin(0.5);
    const summary = this.add.text(W / 2, 245, 'You discovered how smooth, rough, angled, and curved surfaces change reflected light.', {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#e2e8f0', align: 'center', wordWrap: { width: 620 }
    }).setOrigin(0.5);
    const questionLabel = this.add.text(W / 2, 302, 'NEW QUESTION DETECTED', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#c4b5fd'
    }).setOrigin(0.5);
    const question = this.add.text(W / 2, 340, 'Why does a spoon flip your reflection?', {
      fontFamily: 'Arial, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#ffffff', align: 'center'
    }).setOrigin(0.5);

    const challenges = this.add.rectangle(500, 445, 210, 54, 0x3b256b, 0.98)
      .setStrokeStyle(2, 0xa78bfa, 1).setInteractive({ useHandCursor: true });
    const challengesText = this.add.text(500, 445, 'TRY CHALLENGES', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#f5f3ff'
    }).setOrigin(0.5);
    challenges.on('pointerdown', () => {
      this.closeWorldCompletion();
      this.openChallengeLab();
    });

    const clubhouse = this.add.rectangle(780, 445, 230, 54, 0x0f2b52, 0.98)
      .setStrokeStyle(2, 0x60a5fa, 1).setInteractive({ useHandCursor: true });
    const clubhouseText = this.add.text(780, 445, 'RETURN TO CLUBHOUSE', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#e0f2fe'
    }).setOrigin(0.5);
    clubhouse.on('pointerdown', () => this.scene.start('ClubhouseScene'));

    const hint = this.add.text(W / 2, 505, 'The Reflection Lab stays open whenever you want to experiment again.', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#94a3b8'
    }).setOrigin(0.5);

    overlay.add([shade, panel, title, summary, questionLabel, question, challenges, challengesText, clubhouse, clubhouseText, hint]);
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 300, ease: 'Sine.Out' });
  }

  private closeWorldCompletion(): void {
    this.completionOverlay?.destroy(true);
    this.completionOverlay = undefined;
  }

  private startReflectionMission(): void {
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    if (!progress.completed) {
      this.statusText.setText('Solve the Reflection Lab mystery first, then LIGHT RESCUE unlocks.');
      this.pulseStatus();
      return;
    }
    this.challengeOverlay?.destroy(true);
    this.challengeOverlay = undefined;
    this.missionActive = true;
    this.missionIndex = 0;
    this.missionOrder = MissionVariantEngine.sample<ReflectionChallengeId>(['sky_bounce', 'center_bounce', 'floor_bounce'], 2, 3);
    this.missionChangingStart = MissionVariantEngine.chance(0.68);
    this.missionPrecision = MissionVariantEngine.chance(0.46);
    this.missionMoveGoal = MissionVariantEngine.pick<number | undefined>([undefined, 3, 4]);
    if (!this.missionChangingStart && !this.missionPrecision && this.missionMoveGoal === undefined) this.missionChangingStart = true;
    const recipeParts = [
      this.missionPrecision ? 'PRECISION' : undefined,
      this.missionChangingStart ? 'SHIFTING' : undefined,
      this.missionMoveGoal ? `${this.missionMoveGoal}-TURN` : undefined,
      this.missionOrder.length === 2 ? 'DOUBLE' : 'TRIPLE'
    ].filter((part): part is string => Boolean(part));
    this.missionRecipeLabel = recipeParts.join(' + ');
    this.selectedSurface = 'mirror';
    for (const surface of ['mirror', 'spoon', 'rough'] as SurfaceId[]) {
      const box = this.children.getByName(`surface-${surface}`) as Phaser.GameObjects.Rectangle | null;
      box?.setStrokeStyle(2, surface === 'mirror' ? 0xa78bfa : 0x475569, 0.9);
    }
    this.mirrorNormalDeg = -15;
    this.lastTargetHit = false;
    this.statusText.setText(`VEYA: ${this.missionRecipeLabel}. This rescue combines a new target order, starting setup, and optional turn challenge.`);
    this.showCurrentReflectionMissionStep();
    const spoken = `Dynamic Light Rescue. This run is ${this.missionRecipeLabel.toLowerCase()}. Watch the beam, predict, then adjust.`;
    this.voice.speak('reflection.mission.start', spoken, { priority: 28, exclusive: true, speaker: 'veya' });
  }

  private showCurrentReflectionMissionStep(): void {
    if (!this.missionActive) return;
    if (this.missionIndex >= this.missionOrder.length) {
      this.finishReflectionMission();
      return;
    }
    const id = this.missionOrder[this.missionIndex];
    this.activeChallengeId = id;
    this.targetY = id === 'sky_bounce' ? 300 : id === 'floor_bounce' ? 465 : 382;
    if (this.missionChangingStart || this.missionPrecision) {
      this.mirrorNormalDeg = Phaser.Utils.Array.GetRandom([-25, -15, -5, 5, 15, 25]);
    }
    this.lastTargetHit = false;
    this.missionAttempts = 0;
    this.missionNearMissShown = false;
    this.missionHintShown = false;
    this.targetGlow.setPosition(1092, this.targetY);
    this.targetCore.setPosition(1092, this.targetY);
    const targetName = id === 'sky_bounce' ? 'TOP' : id === 'floor_bounce' ? 'BOTTOM' : 'MIDDLE';
    const total = this.missionOrder.length;
    this.targetTitleText.setText(`LIGHT RESCUE  •  ${this.missionRecipeLabel}  •  ${this.missionIndex + 1}/${total}  •  ${targetName}`);
    const moveGoalCopy = this.missionMoveGoal ? ` Bonus: can you solve it in ${this.missionMoveGoal} turns?` : '';
    this.targetHintText.setText(this.missionPrecision
      ? `Use small turns. The target begins tighter, then relaxes if you need more tries.${moveGoalCopy}`
      : `Rotate the mirror and steer the BLUE reflected beam into the glowing target.${moveGoalCopy}`);
    this.discoveryText.setText(`TEYO: MISSION ${this.missionIndex + 1}/${total} — HIT THE ${targetName} TARGET`).setColor('#ffe384');
    this.statusText.setText(`LIGHT RESCUE: use reflection angle to reach the ${targetName.toLowerCase()} target.`);
    this.renderExperiment();
  }

  private handleReflectionMissionHit(): void {
    if (!this.missionActive) return;
    const id = this.missionOrder[this.missionIndex];
    const targetName = id === 'sky_bounce' ? 'TOP' : id === 'floor_bounce' ? 'BOTTOM' : 'MIDDLE';
    const bonus = this.missionMoveGoal && this.missionAttempts <= this.missionMoveGoal ? `  •  ★ ${this.missionMoveGoal}-TURN BONUS!` : '';
    this.showDiscoveryMessage(`QUIP: ★ ${targetName} TARGET RESCUED!${bonus}`, '#ffe384');
    this.voice.speak(`reflection.mission.${this.missionIndex}`, `Bullseye! ${targetName} target rescued.`, { priority: 24, exclusive: true, speaker: 'quip' });
    this.missionIndex += 1;
    this.lastTargetHit = true;
    this.time.delayedCall(750, () => this.showCurrentReflectionMissionStep());
  }

  private finishReflectionMission(): void {
    new MasteryProgress().markMissionComplete('light-rescue');
    this.missionActive = false;
    this.targetTitleText.setText('REFLECTION TARGET');
    this.targetHintText.setText('Steer the blue reflected beam into the glowing circle.');
    this.discoveryText.setText('★ LIGHT RESCUE COMPLETE!').setColor('#86efac');
    this.statusText.setText('VEYA: You predicted it, tested it, and steered the light on purpose. That is how an Askonaut solves a mystery.');
    this.voice.speak('reflection.mission.complete', 'Light Rescue complete! You predicted, tested, and steered the reflected light through every target.', { priority: 32, exclusive: true, speaker: 'veya' });
    this.showMissionCelebration('LIGHT RESCUE COMPLETE!', 'VEYA: You controlled the reflected beam on purpose.');
  }

  private showMissionCelebration(title: string, subtitle: string): void {
    const banner = this.add.container(W / 2, 170).setDepth(95);
    const glow = this.add.rectangle(0, 0, 620, 112, 0x111d33, 0.98).setStrokeStyle(4, 0xffe384, 1);
    const heading = this.add.text(0, -18, `★ ${title}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffe384'
    }).setOrigin(0.5);
    const copy = this.add.text(0, 20, subtitle, {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#dbeafe'
    }).setOrigin(0.5);
    banner.add([glow, heading, copy]);
    banner.setScale(0.86).setAlpha(0);
    this.tweens.add({ targets: banner, alpha: 1, scale: 1, duration: 240, ease: 'Back.Out' });
    this.time.delayedCall(3800, () => this.tweens.add({ targets: banner, alpha: 0, y: 150, duration: 320, onComplete: () => banner.destroy(true) }));
  }

  private openChallengeLab(): void {
    if (this.challengeOverlay) return;
    const overlay = this.add.container(0, 0).setDepth(80);
    this.challengeOverlay = overlay;

    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0.78).setInteractive();
    const panel = this.add.rectangle(W / 2, H / 2, 820, 500, 0x0b1728, 0.99).setStrokeStyle(4, 0xd6ad54, 1);
    const title = this.add.text(W / 2, 130, 'REFLECTION CHALLENGE LAB', {
      fontFamily: 'Arial, sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#ffe384'
    }).setOrigin(0.5);
    const subtitle = this.add.text(W / 2, 168, 'Light hits the mirror and bounces toward the target wall. Rotate the mirror to steer the blue reflected beam into each glowing target.', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#cbd5e1', align: 'center', wordWrap: { width: 700 }
    }).setOrigin(0.5);

    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    const challenges: Array<{ id: ReflectionChallengeId; title: string; y: number; description: string }> = [
      { id: 'center_bounce', title: 'CENTER BOUNCE', y: 382, description: 'Rotate the mirror until the blue reflected beam hits the MIDDLE glowing target.' },
      { id: 'sky_bounce', title: 'SKY BOUNCE', y: 300, description: 'Rotate the mirror until the blue reflected beam hits the TOP glowing target.' },
      { id: 'floor_bounce', title: 'FLOOR BOUNCE', y: 465, description: 'Rotate the mirror until the blue reflected beam hits the BOTTOM glowing target.' }
    ];

    const items: Phaser.GameObjects.GameObject[] = [shade, panel, title, subtitle];
    challenges.forEach((challenge, index) => {
      const secretId = this.challengeSecretId(challenge.id);
      const complete = progress.secrets.includes(secretId);
      const x = 385 + index * 255;
      const card = this.add.rectangle(x, 330, 215, 210, complete ? 0x234637 : 0x0d2240, 0.98)
        .setStrokeStyle(3, complete ? 0x86efac : 0xa78bfa, 0.95)
        .setInteractive({ useHandCursor: true });
      const state = this.add.text(x, 272, complete ? '✓ COMPLETE' : 'CHALLENGE', {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: complete ? '#bbf7d0' : '#c4b5fd'
      }).setOrigin(0.5);
      const cardTitle = this.add.text(x, 318, challenge.title, {
        fontFamily: 'Arial, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#ffffff', align: 'center'
      }).setOrigin(0.5);
      const description = this.add.text(x, 360, challenge.description, {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#cbd5e1', align: 'center', wordWrap: { width: 170 }
      }).setOrigin(0.5);
      const action = this.add.text(x, 410, complete ? 'TRY AGAIN' : 'START', {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffe384'
      }).setOrigin(0.5);
      card.on('pointerdown', () => this.startChallenge(challenge.id, challenge.y));
      items.push(card, state, cardTitle, description, action);
    });

    const close = this.add.rectangle(W / 2, 548, 180, 48, 0x162238, 1)
      .setStrokeStyle(2, 0x64748b, 0.9).setInteractive({ useHandCursor: true });
    const closeText = this.add.text(W / 2, 548, 'BACK TO LAB', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#e2e8f0'
    }).setOrigin(0.5);
    close.on('pointerdown', () => this.closeChallengeLab());
    items.push(close, closeText);
    overlay.add(items);
  }

  private closeChallengeLab(): void {
    this.challengeOverlay?.destroy(true);
    this.challengeOverlay = undefined;
  }

  private startChallenge(id: ReflectionChallengeId, targetY: number): void {
    this.activeChallengeId = id;
    this.targetY = targetY;
    this.mirrorNormalDeg = -15;
    this.lastTargetHit = false;
    this.selectedSurface = 'mirror';
    for (const surface of ['mirror', 'spoon', 'rough'] as SurfaceId[]) {
      const box = this.children.getByName(`surface-${surface}`) as Phaser.GameObjects.Rectangle | null;
      box?.setStrokeStyle(2, surface === 'mirror' ? 0xa78bfa : 0x475569, 0.9);
    }
    this.targetGlow.setPosition(1092, targetY);
    this.targetCore.setPosition(1092, targetY);
    const targetName = id === 'sky_bounce' ? 'TOP TARGET' : id === 'floor_bounce' ? 'BOTTOM TARGET' : 'MIDDLE TARGET';
    this.targetTitleText.setText(`${this.challengeTitle(id)} • ${targetName}`);
    this.targetHintText.setText('Use ROTATE to steer the BLUE reflected beam into the glowing circle.');
    this.closeChallengeLab();
    this.statusText.setText(`${this.challengeTitle(id)}: light hits the mirror and bounces away. Rotate the mirror until the BLUE reflected beam crosses the ${targetName.toLowerCase()}.`);
    this.showDiscoveryMessage(`CHALLENGE: ${this.challengeTitle(id)} — HIT THE ${targetName}`, '#c4b5fd');
    this.renderExperiment();
  }

  private challengeSecretId(id: ReflectionChallengeId): string {
    if (id === 'sky_bounce') return 'sky_bounce';
    if (id === 'floor_bounce') return 'floor_bounce';
    return 'perfect_bounce';
  }

  private challengeTitle(id: ReflectionChallengeId): string {
    if (id === 'sky_bounce') return 'SKY BOUNCE';
    if (id === 'floor_bounce') return 'FLOOR BOUNCE';
    return 'CENTER BOUNCE';
  }

  private checkTripleBounce(): void {
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    const all = ['perfect_bounce', 'sky_bounce', 'floor_bounce'].every((id) => progress.secrets.includes(id));
    if (!all) return;
    const added = this.progressStore.recordWorldSecret(WORLD_ID, 'triple_bounce', 1);
    if (added) {
      this.time.delayedCall(700, () => {
        this.showDiscoveryMessage('✦ REFLECTION MASTER: TRIPLE BOUNCE!', '#ffe384');
        this.voice.speak('reflection.secret.triple-bounce', 'Triple bounce! You mastered three different reflection angles. Reflection master!' , { priority: 30, exclusive: true, speaker: 'teyo' });
        this.updateProgressText();
      });
    }
  }

  private pulseStatus(): void {
    this.tweens.add({ targets: this.statusText, scale: { from: 1, to: 1.06 }, duration: 160, yoyo: true, repeat: 1 });
  }

  private pretty(id: string): string {
    return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
