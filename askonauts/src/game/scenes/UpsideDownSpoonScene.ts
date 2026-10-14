import Phaser from 'phaser';
import { PlayerProgressStore } from '../progress/PlayerProgressStore';
import { MasteryProgress } from '../progress/MasteryProgress';
import { VoiceDirector } from '../systems/VoiceDirector';
import { AudioManager } from '../systems/AudioManager';
import { GlobalGameUI } from '../ui/GlobalGameUI';
import { MissionVariantEngine } from '../systems/MissionVariantEngine';
import { ViewerFace, type ViewerExpression } from '../components/ViewerFace';
import { BUILD_ID } from '../../buildInfo';

const W = 1280;
const H = 720;
const WORLD_ID = 'upside-down-spoon';

type SpoonSide = 'concave' | 'convex';
type ReplayData = { replayFocus?: string; replayKind?: string; replayPrompt?: string; startMission?: 'spoon-sprint' };

type DistanceBand = 'near' | 'middle' | 'far';
type SpoonChallengeId = 'flip_it' | 'make_it_huge' | 'shrink_it';
type SpoonPromptMode = 'direct' | 'riddle';

export class UpsideDownSpoonScene extends Phaser.Scene {
  private progressStore!: PlayerProgressStore;
  private voice!: VoiceDirector;
  private audio!: AudioManager;
  private side: SpoonSide = 'concave';
  private distance = 360;
  private spoon!: Phaser.GameObjects.Container;
  private spoonInner?: Phaser.GameObjects.Ellipse;
  private spoonHighlight?: Phaser.GameObjects.Arc;
  private subject!: ViewerFace;
  private reflection!: Phaser.GameObjects.Container;
  private reflectionFace!: ViewerFace;
  private distanceText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private clueTracker?: Phaser.GameObjects.Container;
  private completionOverlay?: Phaser.GameObjects.Container;
  private challengeOverlay?: Phaser.GameObjects.Container;
  private distanceGuide?: Phaser.GameObjects.Graphics;
  private challengeText?: Phaser.GameObjects.Text;
  private activeChallenge?: SpoonChallengeId;
  private challengeArmed = false;
  private replayFocus?: string;
  private requestedMission?: 'spoon-sprint';
  private lastBand: DistanceBand = 'middle';
  private isSpoonFlipping = false;
  private isViewerMoving = false;
  private lastReflectionInverted = false;
  private missionActive = false;
  private missionIndex = 0;
  private missionOrder: SpoonChallengeId[] = ['flip_it', 'make_it_huge', 'shrink_it'];
  private missionMixedStarts = false;
  private missionMoveGoal?: number;
  private missionPromptMode: SpoonPromptMode = 'direct';
  private missionRecipeLabel = 'SURPRISE SPRINT';
  private missionAttempts = 0;
  private missionHintShown = false;
  private playfulFlipCount = 0;
  private lastPlayfulFlipAt = 0;
  private spoonSurpriseCooldown = false;

  constructor() {
    super('UpsideDownSpoonScene');
  }

  init(data: ReplayData): void {
    this.replayFocus = data?.replayFocus;
    this.requestedMission = data?.startMission;
  }

  preload(): void {
    this.load.image('spoonLabP64A', 'assets/worlds/spoon-lab-p64a-hf2.webp');
  }

  create(): void {
    this.progressStore = new PlayerProgressStore();
    this.progressStore.setLastWorld(WORLD_ID);
    this.audio = new AudioManager(this);
    this.voice = this.audio.voice;
    this.cameras.main.setBackgroundColor('#07111f');

    this.drawRoom();
    this.createGuideCopyOverlay();
    this.createHeader();
    this.createStage();
    this.createControls();
    this.createTracker();
    this.updateExperiment(true);

    if (this.requestedMission === 'spoon-sprint') {
      this.time.delayedCall(500, () => this.startSpoonMission());
    } else {
      this.time.delayedCall(700, () => {
        this.voice.speak(
          'spoon.welcome',
          'A spoon is shiny, but it is also curved. Flip it and move closer or farther to see what the curve does to your reflection.',
          { priority: 25, exclusive: true, speaker: 'veya' }
        );
      });
    }

    if (this.replayFocus) {
      this.time.delayedCall(1100, () => this.showMessage(`TRY IT AGAIN: ${this.pretty(this.replayFocus!)}`, '#c4b5fd'));
    }
  }

  private drawRoom(): void {
    const bg = this.add.image(W / 2, H / 2, 'spoonLabP64A').setDisplaySize(W, H).setDepth(0);
    void bg;

    // Slight darkening below the command bar keeps live experiment graphics readable
    // without rebuilding the flat prototype room over the illustrated environment.
    this.add.rectangle(W / 2, 410, W, 620, 0x020617, 0.10).setDepth(1);
  }

  private createGuideCopyOverlay(): void {
    // P6.4B-HF1: keep Veya's portrait/name and ornate frame from the artwork,
    // but replace the small baked body copy with crisp runtime text.
    const panel = this.add.rectangle(676, 148, 330, 52, 0x07172d, 0.95)
      .setDepth(4);
    panel.setStrokeStyle(0);

    const headline = this.add.text(518, 126, `Let's see the world from a new angle!`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#07172d',
      strokeThickness: 2
    }).setDepth(5);

    const instruction = this.add.text(518, 151, 'Move the spoon and watch what changes.', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#c8f3ff',
      stroke: '#07172d',
      strokeThickness: 2
    }).setDepth(5);

    void headline;
    void instruction;
  }

  private createHeader(): void {
    // P6.4B: one shared application shell owns the semantics behind the painted
    // JOURNAL / TREE / SETTINGS / AUDIO / CLUBHOUSE navigation. Legacy Sprint
    // and Challenge hotspots are intentionally removed from this header.
    this.add.text(188, 72, `LIVE • ${BUILD_ID}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', fontStyle: 'bold', color: '#8bd3ff'
    }).setDepth(202);

    new GlobalGameUI(this, this.progressStore, this.audio);

  }

  private createStage(): void {
    // Live experiment layer only. The illustrated environment owns titles and decorative chrome.

    // Viewer / distance rail.
    const rail = this.add.graphics().setDepth(8);
    rail.lineStyle(3, 0x8bd3ff, 0.40).lineBetween(415, 548, 555, 548);
    rail.fillStyle(0xdbeafe, 0.72).fillCircle(430, 548, 4);
    rail.fillCircle(485, 548, 4);
    rail.fillCircle(540, 548, 4);
    this.distanceGuide = this.add.graphics().setDepth(9);

    this.subject = new ViewerFace(this, 470, 500, { scale: 0.52, showShoulders: true }).setDepth(12);
    this.tweens.add({ targets: this.subject, y: '+=3', duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Large live spoon centered over the illustrated pedestal.
    this.spoon = this.add.container(650, 360).setDepth(16);
    const spoonShadow = this.add.ellipse(8, 144, 108, 24, 0x020617, 0.34);
    const handle = this.add.rectangle(0, 118, 30, 204, 0xcbd5e1, 1).setStrokeStyle(4, 0xf8fafc, 0.98);
    const handleInset = this.add.rectangle(-5, 115, 6, 176, 0xffffff, 0.34);
    const neck = this.add.rectangle(0, 42, 38, 44, 0xdce5ef, 1).setStrokeStyle(2, 0xffffff, 0.65);
    const bowl = this.add.ellipse(0, -38, 176, 226, 0xcbd5e1, 1).setStrokeStyle(8, 0xf8fafc, 1);
    const inner = this.add.ellipse(0, -38, 138, 184, 0x718096, 0.98).setStrokeStyle(2, 0xaec5d9, 0.85);
    this.spoonInner = inner;
    const innerShade = this.add.ellipse(12, -27, 96, 144, 0x4d5b70, 0.22);
    const innerGlow = this.add.ellipse(-12, -48, 96, 132, 0xdbeafe, 0.07);
    const rimLight = this.add.arc(0, -38, 81, 205, 332, false, 0xffffff, 0).setStrokeStyle(3, 0xffffff, 0.42);
    const highlight = this.add.arc(-28, -76, 40, 205, 300, false, 0xffffff, 0).setStrokeStyle(7, 0xffffff, 0.76);
    this.spoonHighlight = highlight;
    this.spoon.add([spoonShadow, handle, handleInset, neck, bowl, inner, innerShade, innerGlow, rimLight, highlight]);
    this.applySpoonSideVisual();

    this.reflection = this.add.container(650, 346).setDepth(19);
    this.reflectionFace = new ViewerFace(this, 0, 0, { scale: 0.72, showShoulders: false, reflection: true });
    this.reflection.removeAll(false);
    this.reflection.add(this.reflectionFace);

    this.distanceText = this.add.text(485, 568, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#8bd3ff'
    }).setOrigin(0.5).setDepth(20);

    // P6.4B dynamic-UI cleanup: cover the baked discovery body copy before
    // drawing live status. The ornate frame/header remain part of the artwork.
    this.add.rectangle(1082, 625, 286, 126, 0x06152a, 0.96)
      .setStrokeStyle(1, 0x245078, 0.45).setDepth(21);

    // Dynamic discovery copy sits in the illustrated lower-right discovery zone.
    this.statusText = this.add.text(1082, 604, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#ffffff', align: 'center',
      wordWrap: { width: 265 }
    }).setOrigin(0.5).setDepth(22).setPadding(8, 5, 8, 5);

    this.progressText = this.add.text(1082, 662, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffe384'
    }).setOrigin(0.5).setDepth(22);

    this.challengeText = this.add.text(650, 180, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#f5d0fe', align: 'center',
      wordWrap: { width: 420 }
    }).setOrigin(0.5).setDepth(24).setBackgroundColor('rgba(6,21,42,0.78)').setPadding(8, 6, 8, 6);
  }

  private createControls(): void {
    // P6.4A-HF8: hotspot geometry is calibrated to the actual illustrated button
    // bounds in spoon-lab-p64a-hf2.png (1280x720). Feedback is inset slightly
    // from the painted neon rim so hover/press states read as part of the button
    // instead of as a second floating rectangle.

    // Bottom illustrated controls.
    this.makeHotspot(486, 681, 144, 38, () => {
      this.animateDistanceTo(Math.max(120, this.distance - 60));
    }, 0x60a5fa, 7, 2);
    this.makeHotspot(641, 681, 144, 38, () => {
      this.animateDistanceTo(Math.min(480, this.distance + 60));
    }, 0x60a5fa, 7, 2);
    this.makeHotspot(798, 681, 150, 38, () => {
      this.toggleSpoonSide();
    }, 0xa78bfa, 7, 2);

    // Left illustrated activity cards. These were previously centered too far
    // left and the first card was also too high. The corrected bounds include
    // the icon/text/chevron body without spilling into the gold panel frame.
    this.makeHotspot(176, 221, 276, 78, () => this.showUpsideDownPreset(), 0xa78bfa, 18, 4);
    this.makeHotspot(176, 301, 276, 74, () => this.toggleSpoonSide(), 0x60a5fa, 18, 4);
    this.makeHotspot(176, 389, 276, 74, () => this.cycleSpoonDistance(), 0x60a5fa, 18, 4);
    this.makeHotspot(176, 472, 276, 70, () => this.openCreativeLab(), 0x60a5fa, 18, 4);

    // Right illustrated experiment-tool cards. Increase the vertical coverage
    // to match the painted cards while keeping the glow inside their neon rims.
    this.makeHotspot(1132, 229, 236, 78, () => this.toggleSpoonSide(), 0x60a5fa, 18, 4);
    this.makeHotspot(1132, 310, 236, 74, () => this.cycleSpoonDistance(), 0xa78bfa, 18, 4);
    this.makeHotspot(1132, 391, 236, 74, () => this.runLightExperiment(), 0x4ade80, 18, 4);
    this.makeHotspot(1132, 472, 236, 74, () => this.resetExperiment(), 0xf59e0b, 18, 4);
  }

  private toggleSpoonSide(): void {
    const nextSide: SpoonSide = this.side === 'concave' ? 'convex' : 'concave';
    this.animateSpoonToSide(nextSide);
  }

  private showUpsideDownPreset(): void {
    const finish = () => {
      this.animateDistanceTo(420);
      this.showMessage('UPSIDE-DOWN SPOON: concave + farther away flips the reflection.', '#c4b5fd');
    };
    if (this.side !== 'concave') {
      this.animateSpoonToSide('concave');
      this.time.delayedCall(560, finish);
    } else {
      finish();
    }
  }

  private cycleSpoonDistance(): void {
    const band = this.getDistanceBand();
    const next = band === 'far' ? 240 : band === 'middle' ? 120 : 420;
    this.animateDistanceTo(next);
    this.showMessage(`SPOON SIZE TEST: ${this.pretty(this.getDistanceBand())} → compare what changes.`, '#8bd3ff');
  }

  private openCreativeLab(): void {
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    if (!progress.completed) {
      this.showMessage('CREATIVE LAB unlocks after you solve the Spoon Lab mystery.', '#c4b5fd');
      return;
    }
    this.showChallengeLab();
  }

  private runLightExperiment(): void {
    this.playSpoonShimmer();
    this.reflectionFace.playReaction('surprised', 900);
    this.showMessage('LIGHT TEST: the shine changes, but the spoon curve still controls the reflection.', '#86efac');
    this.voice.speak('spoon.light.test', 'Changing the light changes the shine. The curve of the spoon is what changes the reflection.', { priority: 16, speaker: 'veya' });
  }

  private resetExperiment(): void {
    this.side = 'concave';
    this.applySpoonSideVisual();
    this.distance = 360;
    this.subject.setPosition(this.viewerXForDistance(this.distance), 500);
    this.spoon.setAngle(0).setScale(1, 1);
    this.updateExperiment(false, false, true);
    this.showMessage('EXPERIMENT RESET', '#ffe384');
  }

  private animateSpoonToSide(nextSide: SpoonSide): void {
    if (this.isSpoonFlipping || nextSide === this.side) return;
    if (this.missionActive && this.challengeArmed) this.missionAttempts += 1;
    this.registerPlayfulFlip();
    this.isSpoonFlipping = true;

    // Physical anticipation: a tiny lean before the spoon turns edge-on.
    this.tweens.killTweensOf(this.spoon);
    this.tweens.add({
      targets: this.spoon,
      angle: nextSide === 'convex' ? 7 : -7,
      scaleX: 0.08,
      duration: 210,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.side = nextSide;
        this.applySpoonSideVisual();
        this.playSpoonShimmer();
        this.updateExperiment(false, false, true);
        this.tweens.add({
          targets: this.spoon,
          angle: 0,
          scaleX: 1,
          duration: 290,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.isSpoonFlipping = false;
          }
        });
      }
    });
  }


  private registerPlayfulFlip(): void {
    if (this.missionActive || this.spoonSurpriseCooldown) return;
    const now = this.time.now;
    this.playfulFlipCount = now - this.lastPlayfulFlipAt <= 1500 ? this.playfulFlipCount + 1 : 1;
    this.lastPlayfulFlipAt = now;

    if (this.playfulFlipCount >= 4) {
      this.playfulFlipCount = 0;
      this.playSpoonSpinSurprise();
    }
  }

  private playSpoonSpinSurprise(): void {
    this.spoonSurpriseCooldown = true;
    this.subject.playReaction('surprised', 1200);
    this.reflectionFace.playReaction('surprised', 1200);
    const stars: Phaser.GameObjects.Text[] = [];
    [[595,245],[650,218],[705,248],[720,320],[585,318]].forEach(([x,y], i) => {
      const star = this.add.text(x, y, i % 2 ? '✦' : '★', { fontSize: '18px', color: i % 2 ? '#8bd3ff' : '#ffe384' }).setDepth(50).setOrigin(0.5);
      stars.push(star);
      this.tweens.add({ targets: star, y: y - 22, angle: 120, alpha: 0, duration: 900 + i * 80, onComplete: () => star.destroy() });
    });
    void stars;
    this.showMessage('SECRET SURPRISE: DIZZY SPOON!', '#ffe384');
    this.voice.speak('spoon.surprise.dizzy', 'Okay, okay! That is enough spoon flipping for one fox.', { priority: 19, speaker: 'quip' });
    this.time.delayedCall(4500, () => { this.spoonSurpriseCooldown = false; });
  }

  private applySpoonSideVisual(): void {
    if (!this.spoonInner || !this.spoonHighlight) return;
    if (this.side === 'convex') {
      // The back of the spoon reads brighter and more bulged.
      this.spoonInner.setFillStyle(0xa9bfd3, 1).setStrokeStyle(2, 0xf1f5f9, 0.98);
      this.spoonHighlight.setPosition(23, -50).setScale(0.92, 1.08).setAlpha(0.88);
    } else {
      // The bowl reads deeper, with the highlight tucked into the concavity.
      this.spoonInner.setFillStyle(0x64748b, 1).setStrokeStyle(2, 0xb8cadb, 0.86);
      this.spoonHighlight.setPosition(-25, -63).setScale(1, 1).setAlpha(0.70);
    }
  }

  private playSpoonShimmer(): void {
    const shimmer = this.add.ellipse(650, 310, 104, 154, 0xffffff, 0)
      .setStrokeStyle(5, 0xffffff, 0.82)
      .setDepth(18)
      .setAlpha(0);
    this.tweens.add({
      targets: shimmer,
      alpha: { from: 0, to: 0.9 },
      scaleX: { from: 0.82, to: 1.08 },
      scaleY: { from: 0.82, to: 1.08 },
      duration: 120,
      yoyo: true,
      onComplete: () => shimmer.destroy()
    });
  }

  private animateDistanceTo(nextDistance: number): void {
    if (this.isViewerMoving || nextDistance === this.distance) return;
    if (this.missionActive && this.challengeArmed) this.missionAttempts += 1;
    this.isViewerMoving = true;
    this.distance = nextDistance;
    const targetX = this.viewerXForDistance(this.distance);

    this.tweens.killTweensOf(this.subject);
    this.tweens.add({
      targets: this.subject,
      x: targetX,
      duration: 320,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.updateDistanceGuide(this.subject.x),
      onComplete: () => {
        this.isViewerMoving = false;
        this.updateExperiment(false, false, true);
      }
    });
  }

  private updateDistanceGuide(subjectX: number): void {
    this.distanceGuide?.clear();
    this.distanceGuide?.lineStyle(2, 0x8bd3ff, 0.28).lineBetween(subjectX + 30, 500, 585, 500);
    this.distanceGuide?.fillStyle(0x8bd3ff, 0.48).fillTriangle(585, 500, 575, 495, 575, 505);
  }

  private viewerXForDistance(distance: number): number {
    // Preserve the science state while keeping the live viewer inside the experiment zone.
    return Phaser.Math.Linear(535, 420, Phaser.Math.Clamp((distance - 120) / 360, 0, 1));
  }


  private makeHotspot(
    x: number, y: number, width: number, height: number, action: () => void,
    accent = 0x60a5fa, radius = 10, feedbackInset = 3
  ): void {
    // Draw in local coordinates around the hotspot center. This is important:
    // scaling a Graphics object that contains world-space coordinates scales it
    // around (0,0), which makes the press highlight visibly jump off the button.
    const feedback = this.add.graphics().setPosition(x, y).setDepth(79);
    let hovered = false;
    let pressed = false;

    const fw = Math.max(2, width - feedbackInset * 2);
    const fh = Math.max(2, height - feedbackInset * 2);
    const fr = Math.max(2, radius - Math.min(feedbackInset, radius - 2));

    const drawFeedback = (fillAlpha: number, strokeAlpha: number, strokeWidth: number, strokeColor = accent): void => {
      feedback.clear();
      if (fillAlpha > 0) {
        feedback.fillStyle(accent, fillAlpha);
        feedback.fillRoundedRect(-fw / 2, -fh / 2, fw, fh, fr);
      }
      if (strokeAlpha > 0 && strokeWidth > 0) {
        feedback.lineStyle(strokeWidth, strokeColor, strokeAlpha);
        feedback.strokeRoundedRect(-fw / 2, -fh / 2, fw, fh, fr);
      }
    };

    const restoreHoverState = (): void => {
      feedback.setScale(1);
      if (hovered && !pressed) drawFeedback(0.055, 0.48, 2);
      else if (!pressed) drawFeedback(0, 0, 0);
    };

    const zone = this.add.zone(x, y, width, height)
      .setDepth(80)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      hovered = true;
      if (!pressed) drawFeedback(0.055, 0.48, 2);
    });
    zone.on('pointerout', () => {
      hovered = false;
      pressed = false;
      this.tweens.killTweensOf(feedback);
      feedback.setScale(1);
      drawFeedback(0, 0, 0);
    });
    zone.on('pointerdown', () => {
      pressed = true;
      this.tweens.killTweensOf(feedback);
      feedback.setScale(1);
      drawFeedback(0.14, 0.90, 3, 0xffffff);
      this.tweens.add({
        targets: feedback,
        scaleX: 0.988,
        scaleY: 0.965,
        duration: 65,
        yoyo: true,
        onComplete: () => feedback.setScale(1)
      });
    });
    zone.on('pointerup', () => {
      pressed = false;
      this.tweens.killTweensOf(feedback);
      feedback.setScale(1);
      drawFeedback(0.085, 0.66, 2);
      action();
      this.time.delayedCall(110, restoreHoverState);
    });
    zone.on('pointerupoutside', () => {
      pressed = false;
      restoreHoverState();
    });
  }

  private createTracker(): void {
    this.refreshTracker();
  }

  private refreshTracker(): void {
    this.clueTracker?.destroy(true);
    this.clueTracker = undefined;
    // P6.4A-HF3: clue state is reported in the dedicated progress text instead of
    // four floating cards that obscured the illustrated environment.
    this.updateProgress();
  }

  private updateExperiment(initial = false, animateViewer = false, animateReflection = true): void {
    const band = this.getDistanceBand();
    const subjectX = this.viewerXForDistance(this.distance);

    if (!animateViewer && !this.isViewerMoving) {
      this.subject.setX(subjectX);
      this.updateDistanceGuide(subjectX);
    }
    this.distanceText.setText(`DISTANCE: ${band.toUpperCase()}`);

    let inverted = false;
    let scale = 1;
    let stretchX = 1;
    let stretchY = 1;
    let reflectionOffsetX = 0;
    let description = '';
    let expression: ViewerExpression = 'curious';

    if (this.side === 'convex') {
      inverted = false;
      scale = 0.58;
      stretchX = 0.88;
      stretchY = 1.05;
      reflectionOffsetX = 2;
      expression = 'happy';
      description = 'Convex side: the reflection stays upright and looks smaller.';
      if (!initial) this.recordDiscovery('convex_upright_small', 'CONVEX: UPRIGHT + SMALL');
    } else if (band === 'near') {
      inverted = false;
      scale = 1.22;
      stretchX = 1.08;
      stretchY = 0.96;
      reflectionOffsetX = -3;
      expression = 'happy';
      description = 'Concave side, very close: the reflection is upright again and looks larger.';
      if (!initial) this.recordDiscovery('concave_near_upright', 'NEAR CONCAVE: UPRIGHT AGAIN');
    } else {
      inverted = true;
      scale = band === 'far' ? 0.72 : 0.92;
      stretchX = band === 'far' ? 0.92 : 0.96;
      stretchY = band === 'far' ? 1.08 : 1.04;
      reflectionOffsetX = 2;
      expression = 'surprised';
      description = 'Concave side, farther away: the reflection flips upside down.';
      if (!initial) this.recordDiscovery('concave_far_inverted', 'FAR CONCAVE: UPSIDE DOWN');
    }

    this.reflectionFace.transitionState(inverted, scale, expression, !initial && animateReflection, stretchX, stretchY);
    if (initial || !animateReflection) {
      this.reflectionFace.setX(reflectionOffsetX);
    } else {
      this.tweens.add({
        targets: this.reflectionFace,
        x: reflectionOffsetX,
        duration: 330,
        ease: 'Sine.easeInOut'
      });
    }
    this.statusText.setText(description);

    if (!initial && inverted !== this.lastReflectionInverted) {
      this.subject.playReaction(inverted ? 'surprised' : 'happy', 650);
    }

    if (!initial && band !== this.lastBand) {
      this.recordDiscovery('distance_changes_image', 'DISTANCE CHANGES THE IMAGE');
      if (this.side === 'concave' && ((this.lastBand === 'near' && band === 'middle') || (this.lastBand === 'middle' && band === 'near'))) {
        this.recordSecret('flip_point', 'FLIP POINT FOUND!');
        this.subject.playReaction('surprised', 900);
        this.reflectionFace.playReaction('surprised', 650);
      }
    }
    this.lastBand = band;
    this.lastReflectionInverted = inverted;
    this.updateProgress();
    this.checkActiveChallenge(inverted, scale, band);
    if (this.missionActive && this.activeChallenge && this.challengeArmed) {
      this.showSpoonMissionFeedback(inverted, scale, band);
    }
    this.checkCompletion();
  }

  private getDistanceBand(): DistanceBand {
    if (this.distance <= 180) return 'near';
    if (this.distance >= 360) return 'far';
    return 'middle';
  }

  private recordDiscovery(id: string, title: string): void {
    const added = this.progressStore.recordWorldDiscovery(WORLD_ID, id, 1);
    if (!added) return;
    this.showMessage(`${title}  •  +1 CURIOSITY SPARK`, '#86efac');
    this.refreshTracker();
  }

  private recordSecret(id: string, title: string): void {
    const added = this.progressStore.recordWorldSecret(WORLD_ID, id, 1);
    if (!added) return;
    this.showMessage(`${title}  •  SECRET +1 SPARK`, '#ffe384');
  }

  private updateProgress(): void {
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    const required = ['convex_upright_small', 'concave_far_inverted', 'concave_near_upright', 'distance_changes_image'];
    const count = required.filter((id) => progress.discoveries.includes(id)).length;
    this.progressText.setText(`${count} / ${required.length} SPOON CLUES  •  ${progress.secrets.includes('flip_point') ? 'SECRET FOUND' : '1 SECRET HIDING'}`);
  }

  private startSpoonMission(): void {
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    if (!progress.completed) {
      this.showMessage('Solve the Spoon Lab mystery first, then SPOON SPRINT unlocks.', '#c4b5fd');
      return;
    }
    this.challengeOverlay?.destroy(true);
    this.challengeOverlay = undefined;
    this.missionActive = true;
    this.missionIndex = 0;
    this.missionOrder = MissionVariantEngine.sample<SpoonChallengeId>(['flip_it', 'make_it_huge', 'shrink_it'], 2, 3);
    this.missionMixedStarts = MissionVariantEngine.chance(0.78);
    this.missionMoveGoal = MissionVariantEngine.pick<number | undefined>([undefined, 2, 3]);
    this.missionPromptMode = MissionVariantEngine.pick<SpoonPromptMode>(['direct', 'riddle']);
    const recipeParts = [
      this.missionPromptMode === 'riddle' ? 'RIDDLE' : 'DIRECT',
      this.missionMixedStarts ? 'MIXED START' : 'KNOWN START',
      this.missionMoveGoal ? `${this.missionMoveGoal}-MOVE` : undefined,
      this.missionOrder.length === 2 ? 'DOUBLE' : 'TRIPLE'
    ].filter((part): part is string => Boolean(part));
    this.missionRecipeLabel = recipeParts.join(' + ');
    this.challengeText?.setText(`QUIP: ${this.missionRecipeLabel}. Same spoon science, new combination.`);
    const spoken = `Dynamic Spoon Sprint. This run is ${this.missionRecipeLabel.toLowerCase()}. Solve the reflection effects on purpose.`;
    this.voice.speak('spoon.mission.start', spoken, { priority: 28, exclusive: true, speaker: 'quip' });
    this.showCurrentSpoonMissionStep();
  }

  private showCurrentSpoonMissionStep(): void {
    if (!this.missionActive) return;
    if (this.missionIndex >= this.missionOrder.length) {
      this.finishSpoonMission();
      return;
    }

    const id = this.missionOrder[this.missionIndex];
    this.activeChallenge = id;
    this.challengeArmed = false;
    this.missionAttempts = 0;
    this.missionHintShown = false;

    if (id === 'flip_it') {
      if (this.missionMixedStarts) {
        const starts = [
          { side: 'convex' as SpoonSide, distance: 120 },
          { side: 'concave' as SpoonSide, distance: 120 },
          { side: 'convex' as SpoonSide, distance: 420 }
        ];
        const start = Phaser.Utils.Array.GetRandom(starts);
        this.side = start.side;
        this.distance = start.distance;
      } else {
        this.side = 'concave';
        this.distance = 120;
      }
      const total = this.missionOrder.length;
      const goal = this.missionMoveGoal ? `  BONUS: try it in ${this.missionMoveGoal} moves.` : '';
      const prompt = this.missionPromptMode === 'riddle'
        ? 'Make the inward-curved spoon turn the reflection on its head.'
        : 'Can you make the CONCAVE reflection turn UPSIDE DOWN?';
      this.challengeText?.setText(`TEYO • SPOON SPRINT ${this.missionIndex + 1}/${total}
${prompt}${goal}`);
    } else if (id === 'make_it_huge') {
      if (this.missionMixedStarts) {
        const starts = [
          { side: 'convex' as SpoonSide, distance: 420 },
          { side: 'concave' as SpoonSide, distance: 420 },
          { side: 'convex' as SpoonSide, distance: 240 }
        ];
        const start = Phaser.Utils.Array.GetRandom(starts);
        this.side = start.side;
        this.distance = start.distance;
      } else {
        this.side = 'concave';
        this.distance = 420;
      }
      const total = this.missionOrder.length;
      const goal = this.missionMoveGoal ? `  BONUS: try it in ${this.missionMoveGoal} moves.` : '';
      const prompt = this.missionPromptMode === 'riddle'
        ? 'Find the setup where the inward-curved spoon makes the face loom LARGE but stay upright.'
        : 'Predict what will make the CONCAVE reflection HUGE and upright.';
      this.challengeText?.setText(`VEYA • SPOON SPRINT ${this.missionIndex + 1}/${total}
${prompt}${goal}`);
    } else {
      if (this.missionMixedStarts) {
        const starts = [
          { side: 'concave' as SpoonSide, distance: 180 },
          { side: 'concave' as SpoonSide, distance: 420 },
          { side: 'convex' as SpoonSide, distance: 420 }
        ];
        const start = Phaser.Utils.Array.GetRandom(starts);
        this.side = start.side;
        this.distance = start.distance;
      } else {
        this.side = 'concave';
        this.distance = 180;
      }
      const total = this.missionOrder.length;
      const goal = this.missionMoveGoal ? `  BONUS: try it in ${this.missionMoveGoal} moves.` : '';
      const prompt = this.missionPromptMode === 'riddle'
        ? 'Find the spoon side that keeps me upright but makes me look tiny.'
        : 'Make the reflection SMALL and upright.';
      this.challengeText?.setText(`QUIP • SPOON SPRINT ${this.missionIndex + 1}/${total}
${prompt}${goal || ' Tiny Quip approves.'}`);
    }

    this.applySpoonSideVisual();
    this.updateExperiment(true);
    this.time.delayedCall(140, () => {
      this.challengeArmed = true;
      this.showMessage(`CREW MISSION ${this.missionIndex + 1}/${this.missionOrder.length}: ${this.challengeLabel(id)}  •  ${this.missionRecipeLabel}`, '#ffe384');
    });
  }

  private finishSpoonMission(): void {
    new MasteryProgress().markMissionComplete('spoon-sprint');
    this.missionActive = false;
    this.activeChallenge = undefined;
    this.challengeArmed = false;
    this.challengeText?.setText('★ SPOON SPRINT COMPLETE\nYou controlled shape, orientation, and size on purpose.');
    this.subject.playReaction('happy', 1200);
    this.reflectionFace.playReaction('happy', 1000);
    this.playSpoonShimmer();
    this.showMessage('★ SPOON SPRINT COMPLETE!', '#86efac');
    this.voice.speak('spoon.mission.complete', 'Spoon Sprint complete! Okay, that was actually impressive.', { priority: 32, exclusive: true, speaker: 'quip' });
    this.showMissionCelebration('SPOON SPRINT COMPLETE!', 'QUIP: You recreated three reflection effects on purpose.');
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

  private showChallengeLab(): void {
    this.challengeOverlay?.destroy(true);
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    const overlay = this.add.container(0, 0).setDepth(95);
    this.challengeOverlay = overlay;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0.78).setInteractive();
    const panel = this.add.rectangle(W / 2, H / 2, 940, 520, 0x0b1728, 0.99).setStrokeStyle(4, 0xd6ad54, 1);
    const title = this.add.text(W / 2, 150, 'SPOON CHALLENGE LAB', {
      fontFamily: 'Arial, sans-serif', fontSize: '28px', fontStyle: 'bold', color: '#ffe384'
    }).setOrigin(0.5);
    const subtitle = this.add.text(W / 2, 190,
      'Use the spoon side and your distance to deliberately change the reflection.', {
        fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#dbeafe', align: 'center'
      }).setOrigin(0.5);
    overlay.add([shade, panel, title, subtitle]);

    const challenges: Array<{ id: SpoonChallengeId; title: string; prompt: string; secret: string }> = [
      { id: 'flip_it', title: 'FLIP IT', prompt: 'Start upright, then make the concave reflection turn upside down.', secret: 'challenge_flip_it' },
      { id: 'make_it_huge', title: 'MAKE IT HUGE', prompt: 'Use the concave side and get close enough to make the reflection large.', secret: 'challenge_make_it_huge' },
      { id: 'shrink_it', title: 'SHRINK IT', prompt: 'Use the convex side to make the reflection small and upright.', secret: 'challenge_shrink_it' }
    ];

    challenges.forEach((challenge, index) => {
      const done = progress.secrets.includes(challenge.secret);
      const x = 360 + index * 280;
      const card = this.add.rectangle(x, 340, 235, 230, done ? 0x214c3a : 0x172238, 1)
        .setStrokeStyle(3, done ? 0x86efac : 0xa78bfa, 1)
        .setInteractive({ useHandCursor: true });
      const state = this.add.text(x, 270, done ? '✓ COMPLETE' : 'CHALLENGE', {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: done ? '#86efac' : '#c4b5fd'
      }).setOrigin(0.5);
      const name = this.add.text(x, 318, challenge.title, {
        fontFamily: 'Arial, sans-serif', fontSize: '19px', fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0.5);
      const prompt = this.add.text(x, 372, challenge.prompt, {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#dbeafe', align: 'center', wordWrap: { width: 195 }
      }).setOrigin(0.5);
      const action = this.add.text(x, 430, done ? 'TRY AGAIN' : 'START', {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffe384'
      }).setOrigin(0.5);
      card.on('pointerdown', () => this.startChallenge(challenge.id));
      overlay.add([card, state, name, prompt, action]);
    });

    const mastery = progress.secrets.includes('spoon_master');
    const masteryText = this.add.text(W / 2, 495,
      mastery ? '★ SPOON MASTER UNLOCKED' : 'Complete all three challenges to unlock the SPOON MASTER secret.', {
        fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: mastery ? '#ffe384' : '#94a3b8'
      }).setOrigin(0.5);
    const back = this.add.rectangle(W / 2, 560, 200, 48, 0x162238, 1)
      .setStrokeStyle(2, 0x64748b, 0.9).setInteractive({ useHandCursor: true });
    const backText = this.add.text(W / 2, 560, 'BACK TO LAB', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#e2e8f0'
    }).setOrigin(0.5);
    back.on('pointerdown', () => {
      overlay.destroy(true);
      if (this.challengeOverlay === overlay) this.challengeOverlay = undefined;
    });
    overlay.add([masteryText, back, backText]);
  }

  private startChallenge(id: SpoonChallengeId): void {
    this.challengeOverlay?.destroy(true);
    this.challengeOverlay = undefined;
    this.activeChallenge = id;
    this.challengeArmed = false;
    this.missionAttempts = 0;
    this.missionHintShown = false;

    if (id === 'flip_it') {
      this.side = 'concave';
      this.distance = 120;
      this.challengeText?.setText('CHALLENGE: FLIP IT\nMove FARTHER until the concave reflection turns upside down.');
    } else if (id === 'make_it_huge') {
      this.side = 'concave';
      this.distance = 420;
      this.challengeText?.setText('CHALLENGE: MAKE IT HUGE\nMove CLOSER until the concave reflection is upright and large.');
    } else {
      this.side = 'concave';
      this.distance = 180;
      this.challengeText?.setText('CHALLENGE: SHRINK IT\nFlip to the CONVEX side to make the reflection small and upright.');
    }

    this.updateExperiment(true);
    this.time.delayedCall(120, () => {
      this.challengeArmed = true;
      this.showMessage(`CHALLENGE STARTED: ${this.challengeLabel(id)}`, '#c4b5fd');
    });
  }

  private checkActiveChallenge(inverted: boolean, scale: number, band: DistanceBand): void {
    if (!this.activeChallenge || !this.challengeArmed) return;
    let success = false;
    let secretId = '';

    if (this.activeChallenge === 'flip_it') {
      success = this.side === 'concave' && inverted && band !== 'near';
      secretId = 'challenge_flip_it';
    } else if (this.activeChallenge === 'make_it_huge') {
      success = this.side === 'concave' && !inverted && band === 'near' && scale >= 1.15;
      secretId = 'challenge_make_it_huge';
    } else if (this.activeChallenge === 'shrink_it') {
      success = this.side === 'convex' && !inverted && scale <= 0.65;
      secretId = 'challenge_shrink_it';
    }

    if (!success) return;
    const completedId = this.activeChallenge;
    this.activeChallenge = undefined;
    this.challengeArmed = false;

    if (this.missionActive) {
      this.subject.playReaction('happy', 700);
      this.reflectionFace.playReaction('happy', 650);
      const bonus = this.missionMoveGoal && this.missionAttempts <= this.missionMoveGoal ? `  •  ★ ${this.missionMoveGoal}-MOVE BONUS!` : '';
      this.showMessage(`★ ${this.challengeLabel(completedId)}  •  MISSION ${this.missionIndex + 1}/${this.missionOrder.length}${bonus}`, '#ffe384');
      this.missionIndex += 1;
      this.time.delayedCall(850, () => this.showCurrentSpoonMissionStep());
      return;
    }

    this.challengeText?.setText('');
    const added = this.progressStore.recordWorldSecret(WORLD_ID, secretId, 1);
    this.subject.playReaction('happy', 700);
    this.reflectionFace.playReaction('happy', 650);
    this.showMessage(`${this.challengeLabel(completedId)} COMPLETE${added ? '  •  +1 CURIOSITY SPARK' : ''}`, '#86efac');
    this.checkSpoonMastery();
    this.time.delayedCall(1350, () => this.showChallengeLab());
  }

  private showSpoonMissionFeedback(inverted: boolean, scale: number, band: DistanceBand): void {
    if (!this.activeChallenge || this.missionAttempts < 2 || this.missionHintShown) return;
    this.missionHintShown = true;

    let hint = 'Look at the reflection, then change just one thing.';
    if (this.activeChallenge === 'flip_it') {
      hint = this.side !== 'concave'
        ? 'TEYO HINT: Use the CONCAVE side first.'
        : band === 'near'
          ? 'TEYO HINT: Keep it CONCAVE and move FARTHER until the face flips.'
          : inverted
            ? 'TEYO: You are almost there — watch the orientation.'
            : 'TEYO HINT: Keep it CONCAVE and change the distance.';
    } else if (this.activeChallenge === 'make_it_huge') {
      hint = this.side !== 'concave'
        ? 'VEYA HINT: Use the CONCAVE side, then move very close.'
        : band !== 'near' || scale < 1.15
          ? 'VEYA HINT: Move CLOSER. The near concave reflection grows large and upright.'
          : 'VEYA: Compare size and orientation together.';
    } else if (this.activeChallenge === 'shrink_it') {
      hint = this.side !== 'convex'
        ? 'QUIP HINT: Flip to the CONVEX side. Tiny Quip lives there.'
        : 'QUIP: You found the right side — look for the smallest upright reflection.';
    }

    this.subject.playReaction('surprised', 650);
    this.showMessage(`NOT YET  •  ${hint}`, '#8bd3ff');
    const speaker = hint.startsWith('TEYO') ? 'teyo' : hint.startsWith('VEYA') ? 'veya' : 'quip';
    this.voice.speak(`spoon.mission.hint.${this.missionIndex}`, hint.replace(/^(TEYO|VEYA|QUIP) HINT: /, '').replace(/^(TEYO|VEYA|QUIP): /, ''), { priority: 18, speaker });
  }

  private checkSpoonMastery(): void {
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    const required = ['challenge_flip_it', 'challenge_make_it_huge', 'challenge_shrink_it'];
    if (!required.every((id) => progress.secrets.includes(id))) return;
    const added = this.progressStore.recordWorldSecret(WORLD_ID, 'spoon_master', 1);
    if (added) {
      this.time.delayedCall(450, () => {
        this.subject.playReaction('happy', 1100);
        this.reflectionFace.playReaction('happy', 900);
        this.playSpoonShimmer();
        this.showMessage('★ SPOON MASTER!  •  SECRET +1 SPARK', '#ffe384');
      });
    }
  }

  private challengeLabel(id: SpoonChallengeId): string {
    if (id === 'flip_it') return 'FLIP IT';
    if (id === 'make_it_huge') return 'MAKE IT HUGE';
    return 'SHRINK IT';
  }

  private checkCompletion(): void {
    const progress = this.progressStore.getWorldProgress(WORLD_ID);
    if (progress.completed) return;
    const required = ['convex_upright_small', 'concave_far_inverted', 'concave_near_upright', 'distance_changes_image'];
    if (!required.every((id) => progress.discoveries.includes(id))) return;

    this.progressStore.completeWorld(WORLD_ID);
    this.voice.speakAndWait(
      'spoon.complete',
      'You found it. A spoon can flip your reflection because its curved surface changes how reflected light spreads and crosses before reaching your eyes.',
      { priority: 40, exclusive: true, speaker: 'veya' }
    ).then(() => this.showCompletion());
  }

  private showCompletion(): void {
    if (this.completionOverlay) return;
    const overlay = this.add.container(0, 0).setDepth(90);
    this.completionOverlay = overlay;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0.8).setInteractive();
    const panel = this.add.rectangle(W / 2, H / 2, 780, 430, 0x0b1728, 0.99).setStrokeStyle(4, 0xd6ad54, 1);
    const title = this.add.text(W / 2, 190, 'UPSIDE-DOWN SPOON SOLVED!', {
      fontFamily: 'Arial, sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#ffe384'
    }).setOrigin(0.5);
    const summary = this.add.text(W / 2, 248,
      'Convex curves keep the image upright and smaller. Concave curves can flip the image when you are farther away, then turn it upright again when you move very close.', {
        fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#e2e8f0', align: 'center', wordWrap: { width: 650 }
      }).setOrigin(0.5);
    const nextLabel = this.add.text(W / 2, 322, 'NEW QUESTION DETECTED', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#c4b5fd'
    }).setOrigin(0.5);
    const nextQuestion = this.add.text(W / 2, 356, 'Why do funhouse mirrors stretch and squash us?', {
      fontFamily: 'Arial, sans-serif', fontSize: '21px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const clubhouse = this.add.rectangle(W / 2, 445, 250, 56, 0x243553, 1)
      .setStrokeStyle(2, 0x60a5fa, 1).setInteractive({ useHandCursor: true });
    const clubhouseText = this.add.text(W / 2, 445, 'RETURN TO CLUBHOUSE', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#e0f2fe'
    }).setOrigin(0.5);
    clubhouse.on('pointerdown', () => this.scene.start('ClubhouseScene'));
    overlay.add([shade, panel, title, summary, nextLabel, nextQuestion, clubhouse, clubhouseText]);
  }

  private showMessage(message: string, color: string): void {
    const text = this.add.text(W / 2, 275, message, {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color,
      backgroundColor: '#091426', padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setDepth(70).setAlpha(0);
    const wordCount = message.trim().split(/\s+/).filter(Boolean).length;
    const holdMs = Phaser.Math.Clamp(2200 + wordCount * 320, 3800, 8000);
    this.tweens.add({
      targets: text, alpha: 1, y: 260, duration: 180, yoyo: true, hold: holdMs,
      onComplete: () => text.destroy()
    });
  }

  private pretty(id: string): string {
    return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
