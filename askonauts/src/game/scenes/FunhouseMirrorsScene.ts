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
const WORLD_ID = 'funhouse-mirrors';

type MirrorMode = 'flat' | 'tall' | 'wide' | 'wavy';
type MirrorMissionVariant = 'direct' | 'riddle' | 'science_clue';
type ReplayData = { replayFocus?: string; replayKind?: string; replayPrompt?: string; startMission?: 'mirror-mission' };

type MirrorSpec = {
  title: string;
  subtitle: string;
  discoveryId: string;
  scaleX: number;
  scaleY: number;
  frameColor: number;
};

const MIRRORS: Record<MirrorMode, MirrorSpec> = {
  flat: {
    title: 'FLAT',
    subtitle: 'SAME SHAPE',
    discoveryId: 'flat_same_shape',
    scaleX: 1,
    scaleY: 1,
    frameColor: 0x60a5fa
  },
  tall: {
    title: 'TALL',
    subtitle: 'STRETCHED',
    discoveryId: 'vertical_curve_stretches',
    scaleX: 0.76,
    scaleY: 1.42,
    frameColor: 0xa78bfa
  },
  wide: {
    title: 'WIDE',
    subtitle: 'SQUASHED',
    discoveryId: 'horizontal_curve_squashes',
    scaleX: 1.42,
    scaleY: 0.76,
    frameColor: 0xf59e0b
  },
  wavy: {
    title: 'WAVY',
    subtitle: 'MIXED CURVES',
    discoveryId: 'mixed_curve_warps',
    scaleX: 1.16,
    scaleY: 1.08,
    frameColor: 0x34d399
  }
};

export class FunhouseMirrorsScene extends Phaser.Scene {
  private progressStore!: PlayerProgressStore;
  private voice!: VoiceDirector;
  private audio!: AudioManager;
  private viewer!: Phaser.GameObjects.Image;
  private reflection!: Phaser.GameObjects.Image;
  private quip!: Phaser.GameObjects.Image;
  private selectedMirrorGlow!: Phaser.GameObjects.Graphics;
  private mirrorGlass!: Phaser.GameObjects.Rectangle;
  private mirrorFrame!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private mirrorLabel!: Phaser.GameObjects.Text;
  private clueTracker?: Phaser.GameObjects.Container;
  private completionOverlay?: Phaser.GameObjects.Container;
  private replayFocus?: string;
  private requestedMission?: 'mirror-mission';
  private wavyTween?: Phaser.Tweens.Tween;
  private missionContainer?: Phaser.GameObjects.Container;
  private missionText?: Phaser.GameObjects.Text;
  private missionProgressText?: Phaser.GameObjects.Text;
  private missionButton?: Phaser.GameObjects.Rectangle;
  private missionButtonText?: Phaser.GameObjects.Text;
  private missionActive = false;
  private missionIndex = 0;
  private missionScore = 0;
  private missionMistakeSpokenForStep = -1;
  private missionOrder: MirrorMode[] = ['flat', 'tall', 'wide', 'wavy'];
  private missionVariant: MirrorMissionVariant = 'direct';
  private missionHintDelay = 1;
  private missionRecipeLabel = 'PREDICTION';
  private missionWrongAttempts = 0;
  private surpriseSequence: MirrorMode[] = [];
  private lastSurpriseChoiceAt = 0;
  private mirrorMayhemCooldown = false;

  constructor() {
    super('FunhouseMirrorsScene');
  }

  preload(): void {
    if (!this.textures.exists('funhouse-gallery-p64e')) this.load.image('funhouse-gallery-p64e', 'assets/worlds/funhouse-gallery-p64e.webp');
    if (!this.textures.exists('funhouse-veya')) this.load.image('funhouse-veya', 'assets/characters/clubhouse/veya-clubhouse-p51-hf1.webp');
    if (!this.textures.exists('funhouse-quip')) this.load.image('funhouse-quip', 'assets/characters/quip/quip-clubhouse-p60a.webp');
    if (!this.textures.exists('funhouse-room')) this.load.image('funhouse-room', 'assets/environment/light-lab-production-p12a.webp');
  }

  init(data: ReplayData): void {
    this.replayFocus = data?.replayFocus;
    this.requestedMission = data?.startMission;
  }

  create(): void {
    this.progressStore = new PlayerProgressStore();
    this.progressStore.setLastWorld(WORLD_ID);
    this.audio = new AudioManager(this);
    this.voice = this.audio.voice;
    this.cameras.main.setBackgroundColor('#07111f');

    this.drawRoom();
    this.createHeader();
    this.createExperiment();
    this.createControls();
    this.refreshTracker();
    this.applyMirrorMode('flat', true);

    if (this.requestedMission === 'mirror-mission') {
      this.time.delayedCall(500, () => this.startMirrorMission());
    } else {
      this.time.delayedCall(650, () => {
        this.voice.speak(
          'funhouse.welcome',
          'Funhouse mirrors are curved in different ways. Try each mirror and watch what happens to the same face.',
          { priority: 25, exclusive: true, speaker: 'veya' }
        );
      });
    }

    if (this.replayFocus) {
      this.time.delayedCall(1000, () => this.showMessage(`TRY IT AGAIN: ${this.pretty(this.replayFocus!)}`, '#c4b5fd'));
    }
  }

  private drawRoom(): void {
    // P6.4E: the Funhouse is a real place first, UI second.
    const room = this.add.image(W / 2, H / 2 + 34, 'funhouse-room').setDisplaySize(W, H - 68).setDepth(-12);
    room.setTint(0xc9a8ff);

    const wash = this.add.graphics().setDepth(-11);
    wash.fillStyle(0x1b0b32, 0.46).fillRect(0, 86, W, H - 86);
    wash.fillStyle(0x5b157f, 0.16).fillRoundedRect(18, 104, W - 36, H - 126, 30);
    wash.lineStyle(3, 0xd6ad54, 0.72).strokeRoundedRect(18, 104, W - 36, H - 126, 30);

    // Decorative mirror gallery concept art; all operational copy remains live Phaser UI.
    const gallery = this.add.image(670, 394, 'funhouse-gallery-p64e').setDepth(-5);
    gallery.setDisplaySize(770, 424).setAlpha(0.92);

    // Mask the concept image's baked clue strip so live clue cards own this region.
    this.add.rectangle(670, 190, 790, 82, 0x120d29, 0.86).setDepth(-3)
      .setStrokeStyle(1, 0x7c3aed, 0.34);

    // Polished stage floor / experimentation ring.
    const stage = this.add.graphics().setDepth(-2);
    stage.fillStyle(0x071b35, 0.78).fillEllipse(660, 622, 780, 122);
    stage.lineStyle(3, 0x60a5fa, 0.36).strokeEllipse(660, 622, 780, 122);
    stage.lineStyle(2, 0xd6ad54, 0.32).strokeEllipse(660, 620, 690, 88);
  }

  private createHeader(): void {
    const identity = this.progressStore.getIdentity();
    this.add.rectangle(W / 2, 43, W - 18, 72, 0x06162f, 0.98)
      .setStrokeStyle(2, 0xd6ad54, 0.82).setDepth(19);
    this.add.text(38, 18, '✦ ASKONAUTS', {
      fontFamily: 'Arial, sans-serif', fontSize: '28px', fontStyle: 'bold', color: '#ffe384',
      stroke: '#253b67', strokeThickness: 4
    }).setDepth(20);
    this.add.text(40, 55, `FUNHOUSE MIRRORS  •  ${BUILD_ID}  •  ${identity.name}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#67e8f9'
    }).setDepth(20);

    this.add.rectangle(745, 42, 160, 48, 0x091a31, 0.94).setStrokeStyle(2, 0xd6ad54, 0.8).setDepth(20);
    this.add.text(745, 35, 'MASTER ASKONAUT', { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(21);
    this.add.text(745, 53, 'MIRRORS & PERSPECTIVE', { fontFamily: 'Arial, sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#67e8f9' }).setOrigin(0.5).setDepth(21);

    new GlobalGameUI(this, this.progressStore, this.audio, {
      renderButtons: true, compact: true, startX: 1000, y: 42, showClubhouse: true
    });
  }

  private createExperiment(): void {
    // Guide strip: runtime text so legibility, localization, and narration remain flexible.
    this.add.rectangle(650, 116, 680, 54, 0x07162c, 0.95)
      .setStrokeStyle(2, 0x67e8f9, 0.78).setDepth(11);
    const portrait = this.add.image(340, 116, 'funhouse-veya').setScale(0.078).setDepth(12);
    this.add.text(382, 101, 'VEYA', { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#f472d0' }).setDepth(12);
    this.add.text(382, 118, 'Same face. Different curves. Watch what the mirror changes.', {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#ffffff'
    }).setDepth(12);
    this.add.text(382, 132, 'Choose each mirror, compare the reflection, then explain the pattern.', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#dbeafe',
      stroke: '#07162c', strokeThickness: 2
    }).setDepth(12);
    void portrait;

    // Canonical Veya + Quip observe the gallery rather than placeholder faces.
    this.viewer = this.add.image(155, 505, 'funhouse-veya').setScale(0.32).setDepth(9);
    this.viewer.setData('baseScale', 0.32);
    this.add.text(155, 583, 'VEYA', { fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#fbcfe8' }).setOrigin(0.5).setDepth(10);
    this.quip = this.add.image(250, 520, 'funhouse-quip').setScale(0.082).setDepth(9);
    this.add.text(250, 583, 'QUIP', { fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ddd6fe' }).setOrigin(0.5).setDepth(10);

    // Live preview panel: the gallery shows examples; this is the selected mirror's actual state.
    this.add.rectangle(1120, 394, 248, 370, 0x07162c, 0.93)
      .setStrokeStyle(3, 0xd6ad54, 0.92).setDepth(4);
    this.add.text(1120, 222, 'MIRROR PREVIEW', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#ffe384'
    }).setOrigin(0.5).setDepth(10);

    this.mirrorFrame = this.add.graphics().setDepth(8);
    this.mirrorGlass = this.add.rectangle(1120, 382, 172, 212, 0x9cccf4, 0.34)
      .setStrokeStyle(3, 0xdbeafe, 0.68).setDepth(7);
    this.reflection = this.add.image(1120, 384, 'funhouse-veya').setScale(0.50).setDepth(9);
    this.reflection.setData('baseScale', 0.50);
    this.mirrorLabel = this.add.text(1120, 500, 'FLAT MIRROR', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#dbeafe',
      backgroundColor: '#0b1728', padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(16);

    this.statusText = this.add.text(1120, 548, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#e2e8f0', align: 'center',
      wordWrap: { width: 218 }, lineSpacing: 3
    }).setOrigin(0.5).setDepth(10);
    this.progressText = this.add.text(1120, 634, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffe384',
      align: 'center', wordWrap: { width: 220 }
    }).setOrigin(0.5).setDepth(10);

    this.add.text(660, 678, 'QUESTION: Why do funhouse mirrors stretch and squash us?', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#111827', strokeThickness: 4
    }).setOrigin(0.5).setDepth(10);

    this.createMirrorMissionPanel();
  }

  private createControls(): void {
    this.add.rectangle(145, 310, 235, 270, 0x07162c, 0.90).setStrokeStyle(2, 0xd6ad54, 0.78).setDepth(11);
    this.add.text(145, 196, 'CHOOSE A MIRROR', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#67e8f9'
    }).setOrigin(0.5).setDepth(12);

    const buttons: Array<{ mode: MirrorMode; y: number }> = [
      { mode: 'flat', y: 235 }, { mode: 'tall', y: 295 }, { mode: 'wide', y: 355 }, { mode: 'wavy', y: 415 }
    ];

    buttons.forEach(({ mode, y }) => {
      const spec = MIRRORS[mode];
      const box = this.add.rectangle(145, y, 188, 48, 0x183454, 0.98)
        .setStrokeStyle(2, spec.frameColor, 0.95).setDepth(12)
        .setInteractive({ useHandCursor: true });
      this.add.text(82, y - 7, spec.title, {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffffff'
      }).setDepth(13);
      this.add.text(82, y + 10, spec.subtitle, {
        fontFamily: 'Arial, sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#cbd5e1'
      }).setDepth(13);
      this.add.circle(217, y, 6, spec.frameColor, 1).setDepth(13);
      box.on('pointerdown', () => { this.applyMirrorMode(mode, false); this.evaluateMissionChoice(mode); });
      box.on('pointerover', () => box.setFillStyle(0x254d78, 1));
      box.on('pointerout', () => box.setFillStyle(0x183454, 0.98));
    });

    // Make the gallery mirrors themselves discoverable/clickable.
    const galleryHits: Array<{ mode: MirrorMode; x: number }> = [
      { mode: 'flat', x: 405 }, { mode: 'tall', x: 575 }, { mode: 'wide', x: 760 }, { mode: 'wavy', x: 945 }
    ];
    galleryHits.forEach(({ mode, x }) => {
      const hit = this.add.zone(x, 402, 145, 300).setDepth(6).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => { this.applyMirrorMode(mode, false); this.evaluateMissionChoice(mode); });
    });

    this.selectedMirrorGlow = this.add.graphics().setDepth(7);
  }

  private applyMirrorMode(mode: MirrorMode, initial: boolean): void {
    const spec = MIRRORS[mode];
    const base = Number(this.reflection.getData('baseScale') ?? 0.50);

    this.wavyTween?.stop();
    this.wavyTween = undefined;
    this.tweens.killTweensOf(this.reflection);
    this.reflection.setAngle(0).setScale(base);

    if (mode === 'wavy') {
      this.reflection.setScale(base * 1.08, base * 1.02);
      this.wavyTween = this.tweens.add({
        targets: this.reflection,
        scaleX: { from: base * 0.98, to: base * 1.24 },
        scaleY: { from: base * 0.90, to: base * 1.14 },
        angle: { from: -2.2, to: 2.2 }, duration: 720, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    } else {
      this.tweens.add({
        targets: this.reflection, scaleX: base * spec.scaleX, scaleY: base * spec.scaleY,
        duration: initial ? 0 : 220, ease: 'Sine.easeOut'
      });
    }

    this.drawMirrorFrame(mode, spec.frameColor);
    this.highlightGalleryMirror(mode, spec.frameColor);

    const mirrorLabels: Record<MirrorMode, string> = {
      flat: 'FLAT MIRROR', tall: 'TALL CURVE', wide: 'WIDE CURVE', wavy: 'MIXED-CURVE MIRROR'
    };
    this.mirrorLabel.setText(mirrorLabels[mode]);

    const descriptions: Record<MirrorMode, string> = {
      flat: 'A flat mirror keeps height and width close to the same proportions.',
      tall: 'Vertical curvature redirects the image so it looks taller and narrower.',
      wide: 'Horizontal curvature redirects the image so it looks wider and shorter.',
      wavy: 'Mixed curves redirect different regions differently, warping the reflection.'
    };
    this.statusText.setText(descriptions[mode]);

    if (!initial) {
      const added = this.progressStore.recordWorldDiscovery(WORLD_ID, spec.discoveryId, 1);
      if (added) {
        this.showMessage(`${spec.title} MIRROR CLUE  •  +1 CURIOSITY SPARK`, '#86efac');
        this.refreshTracker();
      }
      this.checkMirrorTourSecret();
      this.registerMirrorMayhemStep(mode);
    }

    this.updateProgress();
    this.updateMissionAvailability();
    this.checkCompletion();
  }

  private highlightGalleryMirror(mode: MirrorMode, color: number): void {
    const centers: Record<MirrorMode, number> = { flat: 405, tall: 575, wide: 760, wavy: 945 };
    const x = centers[mode];
    this.selectedMirrorGlow.clear();
    this.selectedMirrorGlow.lineStyle(5, color, 0.95).strokeRoundedRect(x - 72, 252, 144, 302, 18);
    this.selectedMirrorGlow.lineStyle(2, 0xffffff, 0.28).strokeRoundedRect(x - 78, 246, 156, 314, 22);
  }

  private registerMirrorMayhemStep(mode: MirrorMode): void {
    if (this.missionActive || this.mirrorMayhemCooldown) return;
    const now = this.time.now;
    if (now - this.lastSurpriseChoiceAt > 1800) this.surpriseSequence = [];
    this.lastSurpriseChoiceAt = now;
    this.surpriseSequence.push(mode);
    if (this.surpriseSequence.length > 4) this.surpriseSequence.shift();

    const target: MirrorMode[] = ['tall', 'wide', 'wavy', 'flat'];
    const matched = this.surpriseSequence.length === target.length && target.every((value, index) => value === this.surpriseSequence[index]);
    if (matched) {
      this.surpriseSequence = [];
      this.playMirrorMayhemSurprise();
    }
  }

  private playMirrorMayhemSurprise(): void {
    this.mirrorMayhemCooldown = true;
    const base = Number(this.reflection.getData('baseScale') ?? 0.50);
    this.tweens.killTweensOf(this.reflection);
    this.tweens.add({
      targets: this.reflection, angle: { from: -7, to: 7 },
      scaleX: { from: base * 0.92, to: base * 1.18 }, scaleY: { from: base * 1.12, to: base * 0.88 },
      duration: 180, yoyo: true, repeat: 4, ease: 'Sine.InOut',
      onComplete: () => { this.reflection.setAngle(0).setScale(base); this.applyMirrorMode('flat', true); }
    });
    this.reactSprite(this.quip, 0.082, 950);
    this.showMessage('SECRET SURPRISE: MIRROR MAYHEM!', '#ffe384');
    this.voice.speak('funhouse.surprise.mayhem', 'You found mirror mayhem! My face needs a vacation.', { priority: 20, speaker: 'quip' });
    this.time.delayedCall(4500, () => { this.mirrorMayhemCooldown = false; });
  }

  private drawMirrorFrame(mode: MirrorMode, color: number): void {
    this.mirrorFrame.clear();
    this.mirrorFrame.lineStyle(8, color, 0.92);
    this.mirrorGlass.setPosition(1120, 382);
    if (mode === 'tall') {
      this.mirrorGlass.setSize(145, 235);
      this.mirrorFrame.strokeRoundedRect(1048, 264, 144, 236, 48);
    } else if (mode === 'wide') {
      this.mirrorGlass.setSize(194, 180);
      this.mirrorFrame.strokeRoundedRect(1023, 292, 194, 180, 60);
    } else if (mode === 'wavy') {
      this.mirrorGlass.setSize(170, 214);
      this.mirrorFrame.beginPath();
      this.mirrorFrame.moveTo(1042, 276); this.mirrorFrame.lineTo(1058, 262);
      this.mirrorFrame.lineTo(1185, 270); this.mirrorFrame.lineTo(1202, 288);
      this.mirrorFrame.lineTo(1192, 486); this.mirrorFrame.lineTo(1176, 500);
      this.mirrorFrame.lineTo(1056, 494); this.mirrorFrame.lineTo(1038, 478);
      this.mirrorFrame.closePath(); this.mirrorFrame.strokePath();
    } else {
      this.mirrorGlass.setSize(172, 212);
      this.mirrorFrame.strokeRoundedRect(1034, 276, 172, 212, 18);
    }
  }

  private reactSprite(target: Phaser.GameObjects.Image, baseScale: number, duration = 650): void {
    this.tweens.killTweensOf(target);
    target.setScale(baseScale);
    this.tweens.add({ targets: target, y: target.y - 8, scaleX: baseScale * 1.06, scaleY: baseScale * 1.06,
      duration: duration / 2, yoyo: true, ease: 'Sine.InOut', onComplete: () => target.setScale(baseScale) });
  }

  private createMirrorMissionPanel(): void {
    const container = this.add.container(0, 0).setDepth(18);
    this.missionContainer = container;

    const panel = this.add.rectangle(555, 596, 430, 70, 0x0b1728, 0.94)
      .setStrokeStyle(2, 0xd6ad54, 0.85);
    const title = this.add.text(360, 576, 'MIRROR MISSION', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffe384'
    });
    this.missionText = this.add.text(360, 598, 'Discover all four mirror clues to unlock the mission.', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#dbeafe', wordWrap: { width: 320 }
    });
    this.missionProgressText = this.add.text(742, 604, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#c4b5fd'
    }).setOrigin(1, 0.5);

    this.missionButton = this.add.rectangle(590, 635, 170, 28, 0x3b2b68, 1)
      .setStrokeStyle(2, 0xa78bfa, 0.9)
      .setInteractive({ useHandCursor: true });
    this.missionButtonText = this.add.text(590, 635, 'START MISSION', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);

    this.missionButton.on('pointerdown', () => this.startMirrorMission());
    container.add([panel, title, this.missionText, this.missionProgressText, this.missionButton, this.missionButtonText]);
    container.setVisible(false);
  }

  private updateMissionAvailability(): void {
    if (!this.missionContainer) return;
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    const required = ['flat_same_shape', 'vertical_curve_stretches', 'horizontal_curve_squashes', 'mixed_curve_warps'];
    const unlocked = required.every((id) => progress.discoveries.includes(id));
    this.missionContainer.setVisible(unlocked);
  }

  private startMirrorMission(): void {
    if (!this.missionText || !this.missionProgressText || !this.missionButton || !this.missionButtonText) return;

    this.missionActive = true;
    this.missionIndex = 0;
    this.missionScore = 0;
    this.missionMistakeSpokenForStep = -1;
    this.missionWrongAttempts = 0;
    this.missionOrder = MissionVariantEngine.sample<MirrorMode>(['flat', 'tall', 'wide', 'wavy'], 3, 4);
    this.missionVariant = MissionVariantEngine.pick<MirrorMissionVariant>(['direct', 'riddle', 'science_clue']);
    this.missionHintDelay = MissionVariantEngine.pick([1, 2]);
    this.missionButton.disableInteractive().setVisible(false);
    this.missionButtonText.setVisible(false);
    const variantLabel = this.missionVariant === 'riddle' ? 'RIDDLE' : this.missionVariant === 'science_clue' ? 'SCIENCE CLUE' : 'PREDICTION';
    const lengthLabel = this.missionOrder.length === 3 ? 'QUICK 3' : 'FULL 4';
    const hintLabel = this.missionHintDelay === 2 ? 'DELAYED CLUE' : 'FAST CLUE';
    this.missionRecipeLabel = `${variantLabel} + ${lengthLabel} + ${hintLabel}`;
    this.missionText.setText(`MISSION ACTIVE — ${this.missionRecipeLabel}`);
    const spoken = this.missionVariant === 'riddle'
      ? 'Riddle mode. I will describe what the reflection does without naming the mirror. Predict before you test.'
      : this.missionVariant === 'science_clue'
        ? 'Science clue mode. Listen for how the curve changes the image, then choose the mirror.'
        : 'Predict first, then test your idea. Do not just click every mirror.';
    this.voice.speak('funhouse.mission.start', spoken, { priority: 28, exclusive: true, speaker: 'veya' });
    this.time.delayedCall(650, () => this.showCurrentMission());
  }

  private showCurrentMission(): void {
    if (!this.missionText || !this.missionProgressText) return;

    if (this.missionIndex >= this.missionOrder.length) {
      this.finishMirrorMission();
      return;
    }

    this.missionWrongAttempts = 0;
    const target = this.missionOrder[this.missionIndex];
    const directPrompts: Record<MirrorMode, string> = {
      flat: 'VEYA: Which mirror keeps the face the same shape?',
      tall: 'TEYO: Which mirror will make the face TALLER and NARROWER?',
      wide: 'QUIP: Which mirror will make the face WIDER and SHORTER?',
      wavy: 'VEYA: Which mirror will make different parts of the face WARP?'
    };
    const riddlePrompts: Record<MirrorMode, string> = {
      flat: 'VEYA: I copy your proportions without stretching. Which mirror am I?',
      tall: 'TEYO: I make a round face look long like a rocket. Which mirror am I?',
      wide: 'QUIP: I turn cheeks extra wide and squish the height. Which mirror am I?',
      wavy: 'VEYA: One part stretches while another bends differently. Which mirror am I?'
    };
    const sciencePrompts: Record<MirrorMode, string> = {
      flat: 'VEYA: Which surface keeps reflected rays organized without curved magnification?',
      tall: 'TEYO: Which curve magnifies more vertically than sideways?',
      wide: 'QUIP: Which curve magnifies more sideways than vertically?',
      wavy: 'VEYA: Which mixed curvature redirects different parts of the image differently?'
    };
    const prompts = this.missionVariant === 'riddle' ? riddlePrompts : this.missionVariant === 'science_clue' ? sciencePrompts : directPrompts;
    const prefix = this.missionVariant === 'riddle' ? 'RIDDLE' : this.missionVariant === 'science_clue' ? 'SCIENCE CLUE' : 'PREDICT';
    this.missionText.setText(`${prefix}: ${prompts[target]}`);
    this.missionProgressText.setText(`${this.missionIndex + 1} / ${this.missionOrder.length}`);
  }

  private evaluateMissionChoice(mode: MirrorMode): void {
    if (!this.missionActive || !this.missionText) return;

    const target = this.missionOrder[this.missionIndex];
    if (mode !== target) {
      this.missionWrongAttempts += 1;
      const hints: Record<MirrorMode, string> = {
        flat: 'Look for the mirror that keeps height and width nearly the SAME.',
        tall: 'Look for a face that becomes TALLER and NARROWER.',
        wide: 'Look for a face that becomes WIDER and SHORTER.',
        wavy: 'Look for a reflection where different parts WARP differently.'
      };
      const revealClue = this.missionWrongAttempts >= this.missionHintDelay;
      const feedback = revealClue
        ? `QUIP: CLUE — ${hints[target]}`
        : 'QUIP: That mirror changed the face differently. Compare the HEIGHT and WIDTH, then predict again.';
      this.missionText.setText(feedback);
      this.reactSprite(this.viewer, 0.32, 650);
      this.tweens.add({ targets: this.reflection, x: { from: this.reflection.x - 7, to: this.reflection.x + 7 }, duration: 70, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
      if (this.missionMistakeSpokenForStep !== this.missionIndex && revealClue) {
        this.missionMistakeSpokenForStep = this.missionIndex;
        this.voice.speak(`funhouse.mission.try.${this.missionIndex}`, `Here is a clue. ${hints[target]}`, { priority: 20, speaker: 'quip' });
      }
      return;
    }

    this.missionScore += 1;
    this.missionIndex += 1;
    this.missionMistakeSpokenForStep = -1;
    this.missionWrongAttempts = 0;
    this.reactSprite(this.viewer, 0.32, 700);
    this.showMessage('★ TEYO: YOU PREDICTED IT!  •  TEST CONFIRMED', '#ffe384');
    this.tweens.add({ targets: [this.mirrorGlass, this.reflection], alpha: { from: 0.72, to: 1 }, duration: 180, yoyo: true, repeat: 1 });
    this.voice.speak(`funhouse.mission.correct.${this.missionIndex}`, 'You predicted it!', { priority: 22, speaker: 'teyo' });
    this.time.delayedCall(900, () => this.showCurrentMission());
  }

  private finishMirrorMission(): void {
    new MasteryProgress().markMissionComplete('mirror-mission');
    if (!this.missionText || !this.missionProgressText || !this.missionButton || !this.missionButtonText) return;

    this.missionActive = false;
    this.missionText.setText(`VEYA: MISSION COMPLETE! You solved ${this.missionScore} mirror effects in a ${this.missionRecipeLabel.toLowerCase()} run.`);
    this.missionProgressText.setText(`${this.missionOrder.length} / ${this.missionOrder.length} ★`);
    this.missionButton.setInteractive({ useHandCursor: true }).setVisible(true).setAlpha(1);
    this.missionButtonText.setText('PLAY AGAIN').setVisible(true);
    this.reactSprite(this.viewer, 0.32, 1100);
    this.showMessage('VEYA: MIRROR MISSION COMPLETE!', '#86efac');
    this.voice.speak('funhouse.mission.complete', 'Mirror Mission complete! You predicted the effect before you tested it.', { priority: 32, exclusive: true, speaker: 'veya' });
  }

  private refreshTracker(): void {
    this.clueTracker?.destroy(true);
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    const tracker = this.add.container(0, 0).setDepth(14);
    this.clueTracker = tracker;
    const clues = [
      { id: 'flat_same_shape', label: 'FLAT', short: 'SAME SHAPE' },
      { id: 'vertical_curve_stretches', label: 'TALL', short: 'STRETCHES' },
      { id: 'horizontal_curve_squashes', label: 'WIDE', short: 'SQUASHES' },
      { id: 'mixed_curve_warps', label: 'WAVY', short: 'WARPS' }
    ];

    clues.forEach((clue, index) => {
      const complete = progress.discoveries.includes(clue.id);
      const x = 420 + index * 155;
      const y = 216;
      const card = this.add.rectangle(x, y, 132, 64, complete ? 0x24483a : 0x14192a, 0.96)
        .setStrokeStyle(2, complete ? 0x86efac : 0x475569, 0.9);
      const mark = this.add.text(x, y - 15, complete ? '✓' : '○', {
        fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: complete ? '#86efac' : '#64748b'
      }).setOrigin(0.5);
      const title = this.add.text(x, y + 2, clue.label, {
        fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: complete ? '#d1fae5' : '#94a3b8'
      }).setOrigin(0.5);
      const sub = this.add.text(x, y + 18, complete ? clue.short : 'FIND CLUE', {
        fontFamily: 'Arial, sans-serif', fontSize: '7px', fontStyle: 'bold', color: complete ? '#86efac' : '#64748b'
      }).setOrigin(0.5);
      tracker.add([card, mark, title, sub]);
    });

    const label = this.add.text(652, 176, 'MIRROR CLUES', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#c4b5fd'
    }).setOrigin(0.5);
    tracker.add(label);
  }

  private checkMirrorTourSecret(): void {
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    const required = ['flat_same_shape', 'vertical_curve_stretches', 'horizontal_curve_squashes', 'mixed_curve_warps'];
    if (!required.every((id) => progress.discoveries.includes(id))) return;
    const added = this.progressStore.recordWorldSecret(WORLD_ID, 'mirror_morph_master', 1);
    if (added) {
      this.reactSprite(this.viewer, 0.32, 950);
      this.showMessage('SECRET: MIRROR MORPH MASTER  •  +1 SPARK', '#ffe384');
    }
  }

  private updateProgress(): void {
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    const required = ['flat_same_shape', 'vertical_curve_stretches', 'horizontal_curve_squashes', 'mixed_curve_warps'];
    const count = required.filter((id) => progress.discoveries.includes(id)).length;
    this.progressText.setText(`${count} / ${required.length} MIRROR CLUES  •  ${progress.secrets.includes('mirror_morph_master') ? 'SECRET FOUND' : '1 SECRET HIDING'}`);
  }

  private checkCompletion(): void {
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    if (progress.completed) return;
    const required = ['flat_same_shape', 'vertical_curve_stretches', 'horizontal_curve_squashes', 'mixed_curve_warps'];
    if (!required.every((id) => progress.discoveries.includes(id))) return;

    this.progressStore.completeWorld(WORLD_ID);
    this.voice.speakAndWait(
      'funhouse.complete',
      'You found the pattern. Funhouse mirrors change shape because their curves redirect reflected light by different amounts in different directions.',
      { priority: 40, exclusive: true, speaker: 'veya' }
    ).then(() => this.showCompletion());
  }

  private showCompletion(): void {
    if (this.completionOverlay) return;
    const overlay = this.add.container(0, 0).setDepth(90);
    this.completionOverlay = overlay;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0.80).setInteractive();
    const panel = this.add.rectangle(W / 2, H / 2, 800, 430, 0x0b1728, 0.99).setStrokeStyle(4, 0xd6ad54, 1);
    const title = this.add.text(W / 2, 190, 'FUNHOUSE MIRRORS SOLVED!', {
      fontFamily: 'Arial, sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#ffe384'
    }).setOrigin(0.5);
    const summary = this.add.text(W / 2, 255,
      'Flat mirrors preserve proportions. Curved mirrors can magnify or compress different directions, which makes reflections look tall, wide, or wavy.', {
        fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#e2e8f0', align: 'center', wordWrap: { width: 660 }
      }).setOrigin(0.5);
    const nextLabel = this.add.text(W / 2, 330, 'QUESTION TREE UPDATED', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#c4b5fd'
    }).setOrigin(0.5);
    const nextQuestion = this.add.text(W / 2, 364, 'Curiosity keeps growing. Return to the Clubhouse to see what comes next.', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const mission = this.add.rectangle(W / 2 - 145, 448, 250, 56, 0x3b2b68, 1)
      .setStrokeStyle(2, 0xa78bfa, 1).setInteractive({ useHandCursor: true });
    const missionText = this.add.text(W / 2 - 145, 448, 'TRY MIRROR MISSION', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const clubhouse = this.add.rectangle(W / 2 + 145, 448, 250, 56, 0x243553, 1)
      .setStrokeStyle(2, 0x60a5fa, 1).setInteractive({ useHandCursor: true });
    const clubhouseText = this.add.text(W / 2 + 145, 448, 'RETURN TO CLUBHOUSE', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#e0f2fe'
    }).setOrigin(0.5);
    mission.on('pointerdown', () => {
      overlay.destroy(true);
      this.completionOverlay = undefined;
      this.startMirrorMission();
    });
    clubhouse.on('pointerdown', () => this.scene.start('ClubhouseScene'));
    overlay.add([shade, panel, title, summary, nextLabel, nextQuestion, mission, missionText, clubhouse, clubhouseText]);
  }

  private showMessage(message: string, color: string): void {
    const text = this.add.text(W / 2, 584, message, {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color,
      backgroundColor: '#091426', padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setDepth(70).setAlpha(0);
    const wordCount = message.trim().split(/\s+/).filter(Boolean).length;
    const holdMs = Phaser.Math.Clamp(2200 + wordCount * 320, 3800, 8000);
    this.tweens.add({
      targets: text, alpha: 1, y: 570, duration: 180, yoyo: true, hold: holdMs,
      onComplete: () => text.destroy()
    });
  }

  private pretty(id: string): string {
    return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
