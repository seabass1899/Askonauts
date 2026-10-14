import Phaser from 'phaser';
import { shouldReduceMotion } from '../settings/GameSettingsStore';

export type QuestionGateUiState =
  | 'hidden'
  | 'awakening'
  | 'choice'
  | 'exploring'
  | 'entering'
  | 'complete';

const GATE_X = 198;
const GATE_Y = 10;
const COMPASS_X = -92;
const COMPASS_Y = 112;
const EVIDENCE_STARTS: Array<{ x: number; y: number }> = [
  { x: -300, y: -78 },
  { x: -274, y: 4 },
  { x: -236, y: 86 }
];

/**
 * P1.2D — in-world Question Gate cinematic.
 *
 * The Gate remains presentation-only. Mission progression still belongs to
 * ShadowBoxScene/MissionDirector. This class preserves the existing semantic
 * events while replacing the large completion card with an in-world portal.
 */
export class QuestionGate extends Phaser.GameObjects.Container {
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly headline: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly compassCore: Phaser.GameObjects.Container;
  private readonly compassPulse: Phaser.GameObjects.Arc;
  private readonly evidenceTokens: Phaser.GameObjects.Container[] = [];
  private readonly portalGroup: Phaser.GameObjects.Container;
  private readonly portalGlow: Phaser.GameObjects.Arc;
  private readonly outerRing: Phaser.GameObjects.Arc;
  private readonly midRing: Phaser.GameObjects.Arc;
  private readonly energyRing: Phaser.GameObjects.Arc;
  private readonly previewGroup: Phaser.GameObjects.Container;
  private readonly portalZone: Phaser.GameObjects.Zone;
  private readonly nextTitle: Phaser.GameObjects.Text;
  private readonly nextQuestion: Phaser.GameObjects.Text;
  private readonly tapLabel: Phaser.GameObjects.Text;
  private readonly completionPanel: Phaser.GameObjects.Rectangle;
  private readonly exploreButton: Phaser.GameObjects.Rectangle;
  private readonly exploreText: Phaser.GameObjects.Text;
  private readonly playAgainButton: Phaser.GameObjects.Rectangle;
  private readonly playAgainText: Phaser.GameObjects.Text;
  private readonly backToLabButton: Phaser.GameObjects.Rectangle;
  private readonly backToLabText: Phaser.GameObjects.Text;
  private readonly marker: Phaser.GameObjects.Container;
  private readonly markerZone: Phaser.GameObjects.Zone;
  private readonly markerRing: Phaser.GameObjects.Arc;
  private readonly markerLabel: Phaser.GameObjects.Text;
  private readonly reducedMotion: boolean;

  private gateState: QuestionGateUiState = 'hidden';
  private revealedOnce = false;
  private choiceShownOnce = false;
  private enterTriggered = false;
  private completedOnce = false;
  private teaserEmitted = false;
  private labSecretsFound = 0;
  private labSecretsTotal = 3;
  private ringTween: Phaser.Tweens.Tween | null = null;
  private midRingTween: Phaser.Tweens.Tween | null = null;
  private compassTween: Phaser.Tweens.Tween | null = null;
  private markerTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 640, 360);
    this.reducedMotion = shouldReduceMotion();

    this.backdrop = scene.add
      .rectangle(0, 0, 1280, 720, 0x030712, 0.14)
      .setInteractive();

    this.headline = scene.add
      .text(0, -270, 'QUESTION GATE', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#fde68a',
        letterSpacing: 1.8
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.status = scene.add
      .text(0, -238, 'Your evidence is opening something…', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#e2e8f0'
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.compassCore = scene.add.container(COMPASS_X, COMPASS_Y);
    const compassGlow = scene.add.circle(0, 0, 66, 0x7c3aed, 0.05);
    const compassOuter = scene.add
      .circle(0, 0, 48, 0x101827, 0.96)
      .setStrokeStyle(7, 0xd6ad54, 0.95);
    const compassInner = scene.add
      .circle(0, 0, 34, 0x312e81, 0.94)
      .setStrokeStyle(3, 0xa78bfa, 0.92);
    const compassStar = scene.add
      .text(0, 0, '✦', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '38px',
        fontStyle: 'bold',
        color: '#fff1a8'
      })
      .setOrigin(0.5);
    this.compassPulse = scene.add
      .circle(0, 0, 54, 0xfde68a, 0)
      .setStrokeStyle(4, 0xfde68a, 0.72);
    this.compassCore.add([compassGlow, compassOuter, compassInner, compassStar, this.compassPulse]);
    this.compassCore.setAlpha(0).setScale(0.72);

    this.evidenceTokens.push(
      this.makeEvidenceToken(EVIDENCE_STARTS[0].x, EVIDENCE_STARTS[0].y, 'LIGHT', '✦', 0xfde68a),
      this.makeEvidenceToken(EVIDENCE_STARTS[1].x, EVIDENCE_STARTS[1].y, 'BLOCK', '◆', 0xcbd5e1),
      this.makeEvidenceToken(EVIDENCE_STARTS[2].x, EVIDENCE_STARTS[2].y, 'SHADOW', '◐', 0xa78bfa)
    );

    this.portalGroup = scene.add.container(GATE_X, GATE_Y);
    this.portalGlow = scene.add
      .circle(0, 0, 136, 0x60a5fa, 0.04)
      .setStrokeStyle(3, 0x7dd3fc, 0.18);
    this.outerRing = scene.add
      .circle(0, 0, 119, 0x0b1323, 0.18)
      .setStrokeStyle(11, 0xd6ad54, 0.96);
    this.midRing = scene.add
      .circle(0, 0, 98, 0x312e81, 0.16)
      .setStrokeStyle(5, 0xa78bfa, 0.92);
    this.energyRing = scene.add
      .circle(0, 0, 80, 0x1d4ed8, 0.12)
      .setStrokeStyle(4, 0x7dd3fc, 0.88);

    const jewelAssembly = scene.add.container(0, 0);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const radius = 119;
      const jewel = scene.add
        .circle(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          index % 2 === 0 ? 5 : 3.5,
          index % 2 === 0 ? 0xf6d365 : 0x8b5cf6,
          0.98
        )
        .setStrokeStyle(1, 0xfff7d6, 0.68);
      jewelAssembly.add(jewel);
    }

    this.previewGroup = this.makeReflectionPreview();
    this.portalZone = scene.add
      .zone(0, 0, 270, 270)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.portalGroup.add([
      this.portalGlow,
      this.previewGroup,
      this.energyRing,
      this.midRing,
      this.outerRing,
      jewelAssembly,
      this.portalZone
    ]);
    this.portalGroup.setAlpha(0).setScale(0.2);
    this.portalZone.disableInteractive();

    this.completionPanel = scene.add
      .rectangle(220, 18, 470, 390, 0x08111f, 0.90)
      .setStrokeStyle(2, 0xd6ad54, 0.72)
      .setAlpha(0);

    this.tapLabel = scene.add
      .text(GATE_X, 144, 'TAP THE GATE', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#fff7d6',
        backgroundColor: '#241545',
        padding: { left: 14, right: 14, top: 7, bottom: 7 }
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.nextTitle = scene.add
      .text(GATE_X, 192, 'REFLECTION HUNT', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '21px',
        fontStyle: 'bold',
        color: '#fde68a'
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.nextQuestion = scene.add
      .text(GATE_X, 220, 'Why can we see ourselves in some things?', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#e2e8f0',
        align: 'center',
        wordWrap: { width: 350 }
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.exploreButton = scene.add
      .rectangle(-250, 236, 190, 46, 0x172033, 0.92)
      .setStrokeStyle(2, 0x64748b, 0.84)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);
    this.exploreText = scene.add
      .text(-250, 236, 'EXPLORE MORE', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#f8fafc'
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.playAgainButton = scene.add
      .rectangle(-128, 236, 218, 52, 0x4338ca, 0.98)
      .setStrokeStyle(2, 0xc4b5fd, 1)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);
    this.playAgainText = scene.add
      .text(-128, 236, 'PLAY AGAIN', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#f8fafc'
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.backToLabButton = scene.add
      .rectangle(128, 236, 218, 52, 0x172033, 0.95)
      .setStrokeStyle(2, 0x64748b, 0.9)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);
    this.backToLabText = scene.add
      .text(128, 236, 'RETURN TO CLUBHOUSE', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#f8fafc'
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.add([
      this.backdrop,
      this.compassCore,
      ...this.evidenceTokens,
      this.portalGroup,
      this.completionPanel,
      this.headline,
      this.status,
      this.tapLabel,
      this.nextTitle,
      this.nextQuestion,
      this.exploreButton,
      this.exploreText,
      this.playAgainButton,
      this.playAgainText,
      this.backToLabButton,
      this.backToLabText
    ]);

    scene.add.existing(this);
    this.setDepth(1300).setVisible(false).setAlpha(0);
    this.backdrop.disableInteractive();
    this.exploreButton.disableInteractive();
    this.playAgainButton.disableInteractive();
    this.backToLabButton.disableInteractive();

    const markerContainer = scene.add.container(1042, 354).setDepth(1120).setVisible(false);
    this.markerRing = scene.add
      .circle(0, 0, 48, 0x111827, 0.92)
      .setStrokeStyle(5, 0xd6ad54, 0.96);
    const markerInner = scene.add
      .circle(0, 0, 34, 0x312e81, 0.92)
      .setStrokeStyle(3, 0xa78bfa, 0.9);
    const markerStar = scene.add
      .text(0, -2, '✦', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#fff1a8'
      })
      .setOrigin(0.5);
    this.markerLabel = scene.add
      .text(0, 62, 'QUESTION GATE', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fde68a'
      })
      .setOrigin(0.5);
    this.markerZone = scene.add
      .zone(0, 0, 140, 145)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    markerContainer.add([this.markerRing, markerInner, markerStar, this.markerLabel, this.markerZone]);
    this.marker = markerContainer;
    this.markerZone.disableInteractive();

    this.portalZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.beginEntering();
    });

    this.exploreButton.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      if (this.gateState !== 'choice') return;
      this.emit('explore-more');
      this.hideForExploration();
    });

    this.playAgainButton.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      if (this.gateState !== 'complete') return;

      const remaining = Math.max(0, this.labSecretsTotal - this.labSecretsFound);
      if (remaining > 0) {
        this.emit('explore-more');
        this.hideForExploration();
        return;
      }

      this.emit('play-again');
    });

    this.backToLabButton.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      if (this.gateState !== 'complete') return;
      this.emit('return-clubhouse');
    });

    this.markerZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      if (this.gateState !== 'exploring') return;
      this.emit('gate-reopened');
      if (this.completedOnce) {
        this.showCompletion(true);
      } else {
        this.showChoice(false);
      }
    });
  }

  public awaken(): void {
    if (this.revealedOnce || this.gateState !== 'hidden') return;
    this.revealedOnce = true;
    this.gateState = 'awakening';
    this.emit('gate-revealed');
    this.hideMarker();
    this.resetForAwakening();

    this.backdrop.setInteractive();
    this.setVisible(true).setAlpha(0);

    if (this.reducedMotion) {
      this.setAlpha(1);
      this.headline.setAlpha(1);
      this.status.setAlpha(1);
      this.compassCore.setAlpha(1).setScale(1);
      this.portalGroup.setAlpha(1).setScale(1);
      this.previewGroup.setAlpha(1);
      this.scene.time.delayedCall(180, () => this.showChoice(false));
      return;
    }

    this.scene.tweens.add({ targets: this, alpha: 1, duration: 240, ease: 'Sine.Out' });
    this.scene.tweens.add({
      targets: [this.headline, this.status],
      alpha: 1,
      y: '+=6',
      duration: 320,
      ease: 'Sine.Out'
    });
    this.scene.tweens.add({
      targets: this.compassCore,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 460,
      ease: 'Back.Out'
    });

    this.evidenceTokens.forEach((token, index) => {
      this.scene.tweens.add({
        targets: token,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        delay: 180 + index * 120,
        duration: 260,
        ease: 'Back.Out'
      });
      this.scene.tweens.add({
        targets: token,
        x: COMPASS_X,
        y: COMPASS_Y,
        alpha: 0.06,
        scaleX: 0.28,
        scaleY: 0.28,
        delay: 520 + index * 150,
        duration: 520,
        ease: 'Cubic.In'
      });
    });

    this.scene.time.delayedCall(1120, () => this.pulseCompass());
    this.scene.time.delayedCall(1260, () => this.sendEnergyToGate());
    this.scene.time.delayedCall(1440, () => this.assemblePortal());
    this.scene.time.delayedCall(2380, () => {
      if (this.gateState === 'awakening') this.showChoice(false);
    });
  }

  public showChoice(reopen = true): void {
    if (this.gateState === 'entering') return;
    if (this.completedOnce) {
      if (reopen) this.emit('gate-reopened');
      this.showCompletion(true);
      return;
    }
    if (reopen) this.emit('gate-reopened');

    this.gateState = 'choice';
    this.hideMarker();
    this.setVisible(true).setAlpha(1);
    this.backdrop.setInteractive().setAlpha(0.14);
    this.completionPanel.setAlpha(0);
    this.headline.setText('QUESTION GATE').setAlpha(1).setPosition(0, -264);
    this.status.setText('A new mystery is waiting.').setAlpha(1).setPosition(0, -232);
    this.compassCore.setAlpha(0.86).setScale(1);
    this.portalGroup.setPosition(GATE_X, GATE_Y).setScale(1).setAlpha(1);
    this.previewGroup.setAlpha(1);
    this.portalZone.setInteractive({ useHandCursor: true });
    this.nextTitle.setText('REFLECTION HUNT').setPosition(GATE_X, 192).setAlpha(1);
    this.nextQuestion
      .setText('Why can we see ourselves in some things?')
      .setPosition(GATE_X, 220)
      .setAlpha(1);
    this.tapLabel.setPosition(GATE_X, 144).setAlpha(1);
    this.exploreButton.setPosition(-250, 236).setAlpha(1).setInteractive({ useHandCursor: true });
    this.exploreText.setPosition(-250, 236).setAlpha(1);
    this.hideCompletionControls();
    this.startRingMotion();
    this.startCompassMotion();

    if (!this.choiceShownOnce) {
      this.choiceShownOnce = true;
      this.emit('choice-shown');
    }
  }


  public setLabSecretsProgress(found: number, total = 3): void {
    this.labSecretsTotal = Math.max(1, Math.round(total));
    this.labSecretsFound = Phaser.Math.Clamp(Math.round(found), 0, this.labSecretsTotal);

    if (this.gateState === 'complete') {
      this.applyCompletionProgressCopy();
    }
  }

  public getState(): QuestionGateUiState {
    return this.gateState;
  }

  private resetForAwakening(): void {
    this.stopRingMotion();
    this.stopCompassMotion();
    this.enterTriggered = false;
    this.headline.setPosition(0, -276).setAlpha(0).setText('QUESTION GATE');
    this.status
      .setPosition(0, -244)
      .setAlpha(0)
      .setText('LIGHT  •  BLOCK  •  SHADOW');
    this.compassCore.setPosition(COMPASS_X, COMPASS_Y).setAlpha(0).setScale(0.72);
    this.compassPulse.setScale(1).setAlpha(0.7);

    this.evidenceTokens.forEach((token, index) => {
      const start = EVIDENCE_STARTS[index];
      token.setPosition(start.x, start.y).setAlpha(0).setScale(0.78).setAngle(0);
    });

    this.portalGroup.setPosition(GATE_X, GATE_Y).setAlpha(0).setScale(0.2).setAngle(0);
    this.portalGlow.setAlpha(0.04).setScale(0.8);
    this.previewGroup.setAlpha(0);
    this.outerRing.setAngle(0);
    this.midRing.setAngle(0);
    this.energyRing.setAngle(0);
    this.portalZone.disableInteractive();

    this.tapLabel.setAlpha(0);
    this.completionPanel.setAlpha(0);
    this.nextTitle.setAlpha(0);
    this.nextQuestion.setAlpha(0);
    this.exploreButton.disableInteractive().setAlpha(0);
    this.exploreText.setAlpha(0);
    this.hideCompletionControls();
  }

  private pulseCompass(): void {
    this.scene.tweens.add({
      targets: this.compassPulse,
      scaleX: 1.75,
      scaleY: 1.75,
      alpha: 0,
      duration: this.reducedMotion ? 80 : 520,
      ease: 'Cubic.Out',
      onComplete: () => this.compassPulse.setScale(1).setAlpha(0.7)
    });
  }

  private sendEnergyToGate(): void {
    const startX = 640 + COMPASS_X;
    const startY = 360 + COMPASS_Y;
    const endX = 640 + GATE_X;
    const endY = 360 + GATE_Y;

    const beam = this.scene.add.graphics().setDepth(1295).setBlendMode(Phaser.BlendModes.ADD);
    beam.lineStyle(8, 0x7dd3fc, 0.12);
    beam.lineBetween(startX, startY, endX, endY);
    beam.lineStyle(3, 0xfde68a, 0.78);
    beam.lineBetween(startX, startY, endX, endY);

    this.scene.tweens.add({
      targets: beam,
      alpha: 0,
      duration: this.reducedMotion ? 100 : 620,
      ease: 'Sine.Out',
      onComplete: () => beam.destroy()
    });

    const count = this.reducedMotion ? 2 : 7;
    for (let index = 0; index < count; index += 1) {
      const spark = this.scene.add
        .circle(startX, startY, index % 2 ? 4 : 6, index % 2 ? 0x7dd3fc : 0xfde68a, 0.96)
        .setDepth(1297)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: spark,
        x: endX,
        y: endY,
        scaleX: 0.35,
        scaleY: 0.35,
        delay: index * 54,
        duration: this.reducedMotion ? 70 : 480 + index * 18,
        ease: 'Sine.InOut',
        onComplete: () => spark.destroy()
      });
    }
  }

  private assemblePortal(): void {
    this.portalGroup.setVisible(true);
    this.scene.tweens.add({
      targets: this.portalGroup,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: this.reducedMotion ? 100 : 720,
      ease: 'Back.Out'
    });
    this.scene.tweens.add({
      targets: this.portalGlow,
      alpha: 0.2,
      scaleX: 1.24,
      scaleY: 1.24,
      duration: this.reducedMotion ? 100 : 560,
      yoyo: true,
      ease: 'Sine.InOut'
    });
    this.scene.tweens.add({
      targets: this.previewGroup,
      alpha: 1,
      delay: this.reducedMotion ? 0 : 280,
      duration: this.reducedMotion ? 80 : 440,
      ease: 'Sine.Out'
    });
    this.startRingMotion();
    this.startCompassMotion();
  }

  private beginEntering(): void {
    if (this.enterTriggered || this.gateState !== 'choice') return;
    this.enterTriggered = true;
    this.gateState = 'entering';
    this.portalZone.disableInteractive();
    this.exploreButton.disableInteractive();
    this.stopRingMotion();
    this.stopCompassMotion();
    this.emit('enter-gate');

    this.tapLabel.setText('GATE OPENING…');
    this.status.setText('Hold on to your curiosity.');
    this.scene.tweens.add({
      targets: [this.nextTitle, this.nextQuestion, this.exploreButton, this.exploreText],
      alpha: 0,
      duration: 180,
      ease: 'Sine.In'
    });
    this.scene.tweens.add({
      targets: this.backdrop,
      alpha: 0.52,
      duration: 380,
      ease: 'Sine.Out'
    });

    if (!this.reducedMotion) {
      const camera = this.scene.cameras.main;
      camera.zoomTo(1.055, 420, 'Sine.easeOut');
      camera.pan(640 + GATE_X * 0.32, 360 + GATE_Y * 0.18, 420, 'Sine.easeOut');
    }

    this.scene.tweens.add({
      targets: this.portalGroup,
      x: 0,
      y: -54,
      scaleX: 1.24,
      scaleY: 1.24,
      duration: this.reducedMotion ? 120 : 840,
      ease: 'Cubic.InOut'
    });
    this.scene.tweens.add({
      targets: this.outerRing,
      angle: this.outerRing.angle + 720,
      duration: this.reducedMotion ? 120 : 900,
      ease: 'Cubic.InOut'
    });
    this.scene.tweens.add({
      targets: this.midRing,
      angle: this.midRing.angle - 620,
      duration: this.reducedMotion ? 120 : 900,
      ease: 'Cubic.InOut'
    });
    this.scene.tweens.add({
      targets: this.energyRing,
      scaleX: 1.18,
      scaleY: 1.18,
      alpha: 0.36,
      duration: this.reducedMotion ? 100 : 360,
      yoyo: true,
      repeat: this.reducedMotion ? 0 : 1,
      ease: 'Sine.InOut'
    });

    const flash = this.scene.add
      .circle(640 + GATE_X, 360 + GATE_Y, 120, 0xf8fafc, 0.08)
      .setStrokeStyle(8, 0x7dd3fc, 0.72)
      .setDepth(1310)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: flash,
      scaleX: 2.7,
      scaleY: 2.7,
      alpha: 0,
      duration: this.reducedMotion ? 120 : 760,
      ease: 'Cubic.Out',
      onComplete: () => flash.destroy()
    });

    this.scene.time.delayedCall(this.reducedMotion ? 180 : 1050, () => this.showCompletion(false));
  }

  private showCompletion(reopened: boolean): void {
    this.completedOnce = true;
    this.gateState = 'complete';
    this.hideMarker();
    this.setVisible(true).setAlpha(1);

    // P1.3C-HF1: completion becomes a deliberate two-zone composition.
    // The lab remains visible as context, but no longer competes with the Gate.
    this.backdrop.setInteractive().setAlpha(0.76);
    this.portalZone.disableInteractive();
    this.exploreButton.disableInteractive().setAlpha(0);
    this.exploreText.setAlpha(0);
    this.tapLabel.setAlpha(0);

    // The Compass/evidence sequence has done its job. Keeping it on-screen was
    // creating a second visual centre beneath the completed portal.
    this.compassCore.setAlpha(0);
    this.evidenceTokens.forEach((token) => token.setAlpha(0));

    // Left: the opened Gate remains the hero visual.
    this.portalGroup.setPosition(-215, -18).setScale(0.96).setAlpha(1);
    this.previewGroup.setAlpha(1);

    // Right: one quiet information card contains all completion copy/actions.
    this.completionPanel
      .setPosition(225, 24)
      .setSize(470, 390)
      .setAlpha(1);

    this.headline
      .setPosition(225, -132)
      .setText('SHADOW CHASE COMPLETE')
      .setAlpha(1);
    this.status
      .setPosition(225, -96)
      .setAlpha(0.92);

    this.nextTitle
      .setPosition(225, -18)
      .setText('NEXT MYSTERY • REFLECTION HUNT')
      .setAlpha(1);
    this.nextQuestion
      .setPosition(225, 28)
      .setText('Why can we see ourselves in some things?\nComing soon')
      .setAlpha(1);

    this.playAgainButton
      .setPosition(108, 142)
      .setSize(210, 52)
      .setAlpha(1)
      .setInteractive({ useHandCursor: true });
    this.playAgainText.setPosition(108, 142).setAlpha(1);
    this.backToLabButton
      .setPosition(342, 142)
      .setSize(210, 52)
      .setAlpha(1)
      .setInteractive({ useHandCursor: true });
    this.backToLabText.setPosition(342, 142).setAlpha(1).setFontSize(13);

    this.applyCompletionProgressCopy();
    this.startRingMotion();

    const camera = this.scene.cameras.main;
    if (!this.reducedMotion) {
      camera.zoomTo(1, 300, 'Sine.easeInOut');
      camera.pan(640, 360, 300, 'Sine.easeInOut');
    }

    if (!reopened && !this.teaserEmitted) {
      this.teaserEmitted = true;
      this.emit('teaser-shown');
    }
  }


  private applyCompletionProgressCopy(): void {
    const remaining = Math.max(0, this.labSecretsTotal - this.labSecretsFound);
    this.status.setText(
      `${this.labSecretsFound} OF ${this.labSecretsTotal} LIGHT LAB SECRETS FOUND`
    );
    this.playAgainText.setText(
      remaining > 0 ? (remaining === 1 ? 'FIND LAST SECRET' : 'FIND MORE SECRETS') : 'PLAY AGAIN'
    );
  }

  private hideForExploration(): void {
    this.portalZone.disableInteractive();
    this.exploreButton.disableInteractive();
    this.playAgainButton.disableInteractive();
    this.backToLabButton.disableInteractive();
    this.backdrop.disableInteractive();
    this.stopRingMotion();
    this.stopCompassMotion();
    this.gateState = 'exploring';

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 260,
      ease: 'Sine.In',
      onComplete: () => {
        this.setVisible(false);
        this.showMarker();
      }
    });
  }

  private hideCompletionControls(): void {
    this.playAgainButton.disableInteractive().setAlpha(0);
    this.playAgainText.setAlpha(0);
    this.backToLabButton.disableInteractive().setAlpha(0);
    this.backToLabText.setAlpha(0);
  }

  private showMarker(): void {
    this.markerLabel.setText(this.completedOnce ? 'REFLECTION HUNT' : 'QUESTION GATE');
    this.marker.setVisible(true).setAlpha(0).setScale(0.78);
    this.markerZone.setInteractive({ useHandCursor: true });
    this.scene.tweens.add({
      targets: this.marker,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 260,
      ease: 'Back.Out'
    });
    this.markerTween?.stop();
    this.markerTween = this.scene.tweens.add({
      targets: this.markerRing,
      scaleX: 1.12,
      scaleY: 1.12,
      alpha: { from: 0.96, to: 0.48 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  private hideMarker(): void {
    this.markerTween?.stop();
    this.markerTween = null;
    this.markerZone.disableInteractive();
    this.marker.setVisible(false);
    this.markerRing.setScale(1).setAlpha(1);
  }

  private startRingMotion(): void {
    this.stopRingMotion();
    this.ringTween = this.scene.tweens.add({
      targets: this.outerRing,
      angle: this.outerRing.angle + 360,
      duration: 8800,
      repeat: -1,
      ease: 'Linear'
    });
    this.midRingTween = this.scene.tweens.add({
      targets: this.midRing,
      angle: this.midRing.angle - 360,
      duration: 6500,
      repeat: -1,
      ease: 'Linear'
    });
  }

  private stopRingMotion(): void {
    this.ringTween?.stop();
    this.midRingTween?.stop();
    this.ringTween = null;
    this.midRingTween = null;
    this.scene.tweens.killTweensOf(this.outerRing);
    this.scene.tweens.killTweensOf(this.midRing);
  }

  private startCompassMotion(): void {
    this.stopCompassMotion();
    this.compassTween = this.scene.tweens.add({
      targets: this.compassCore,
      scaleX: 1.055,
      scaleY: 1.055,
      duration: 980,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  private stopCompassMotion(): void {
    this.compassTween?.stop();
    this.compassTween = null;
    this.scene.tweens.killTweensOf(this.compassCore);
  }

  private makeEvidenceToken(
    x: number,
    y: number,
    label: string,
    glyph: string,
    accent: number
  ): Phaser.GameObjects.Container {
    const token = this.scene.add.container(x, y);
    const glow = this.scene.add.circle(0, 0, 35, accent, 0.05);
    const plate = this.scene.add
      .rectangle(0, 0, 112, 52, 0x111827, 0.92)
      .setStrokeStyle(2, accent, 0.82);
    const icon = this.scene.add
      .text(-36, 0, glyph, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: `#${accent.toString(16).padStart(6, '0')}`
      })
      .setOrigin(0.5);
    const text = this.scene.add
      .text(12, 0, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#f8fafc'
      })
      .setOrigin(0.5);
    token.add([glow, plate, icon, text]);
    return token;
  }

  private makeReflectionPreview(): Phaser.GameObjects.Container {
    const preview = this.scene.add.container(0, 0);
    const glass = this.scene.add
      .circle(0, 0, 70, 0x081326, 0.98)
      .setStrokeStyle(2, 0x7dd3fc, 0.28);
    const mirrorLeft = this.scene.add
      .rectangle(-36, 0, 42, 112, 0x93c5fd, 0.12)
      .setStrokeStyle(1.5, 0xdbeafe, 0.38)
      .setAngle(-5);
    const mirrorRight = this.scene.add
      .rectangle(34, -4, 46, 116, 0xc4b5fd, 0.11)
      .setStrokeStyle(1.5, 0xf5f3ff, 0.36)
      .setAngle(6);

    const spoonBowl = this.scene.add
      .ellipse(-20, -16, 54, 29, 0xe2e8f0, 0.72)
      .setStrokeStyle(2, 0xffffff, 0.54)
      .setAngle(-22);
    const spoonHandle = this.scene.add
      .rectangle(-1, 24, 11, 70, 0xcbd5e1, 0.70)
      .setStrokeStyle(1, 0xffffff, 0.38)
      .setAngle(-22);
    const spoonGlint = this.scene.add
      .text(-34, -29, '✦', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff'
      })
      .setOrigin(0.5);

    const reflectedQuip = this.scene.add
      .image(30, 15, 'quip-idle')
      .setDisplaySize(64, 64)
      .setFlipX(true)
      .setTint(0x9fd8ff)
      .setAlpha(0.32);
    const reflectionLine = this.scene.add
      .rectangle(0, 58, 112, 2, 0x7dd3fc, 0.28)
      .setAngle(-4);

    preview.add([
      glass,
      mirrorLeft,
      mirrorRight,
      spoonHandle,
      spoonBowl,
      spoonGlint,
      reflectedQuip,
      reflectionLine
    ]);
    preview.setAlpha(0);

    if (!this.reducedMotion) {
      this.scene.tweens.add({
        targets: spoonGlint,
        alpha: { from: 0.3, to: 1 },
        scaleX: { from: 0.7, to: 1.25 },
        scaleY: { from: 0.7, to: 1.25 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
    }

    return preview;
  }
}
