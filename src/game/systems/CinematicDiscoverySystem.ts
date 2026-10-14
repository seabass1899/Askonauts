import Phaser from 'phaser';
import { shouldReduceMotion } from '../settings/GameSettingsStore';
import type { DiscoveryId, MissionStageId } from '../missions/types';
import type { DiscoveryFxContext } from './DiscoveryFxSystem';
import { announcementLane } from './AnnouncementLane';

export type CompassAnchor = { x: number; y: number };

type FocusSpec = {
  x: number;
  y: number;
  color: number;
  sparkColor: number;
};

const NEXT_STAGE_COPY: Partial<Record<MissionStageId, string>> = {
  shadow_follows: 'FOLLOW THE SHADOW',
  light_matters: 'MOVE THE LIGHT',
  lights_out: 'TEST THE DARK',
  size_hunt: 'CHANGE ITS SIZE',
  block_it: 'MAKE ANOTHER SHADOW',
  evidence_lock: 'LOCK THE EVIDENCE',
  free_experiment: 'FREE EXPERIMENT',
  question_gate: 'A NEW QUESTION…'
};

/**
 * P1.2C — cinematic discovery presentation.
 *
 * Presentation only: this system never changes mission state, optics, drag
 * geometry, unlock rules, or telemetry. It gives important discoveries a
 * short camera/focus beat, sends evidence into the in-world Compass, and
 * smooths the handoff between challenge stages.
 */
export class CinematicDiscoverySystem {
  private readonly reducedMotion: boolean;
  private busyUntil = -1;

  constructor(private readonly scene: Phaser.Scene) {
    this.reducedMotion = shouldReduceMotion();
  }

  public playDiscovery(
    discovery: DiscoveryId,
    context: DiscoveryFxContext,
    compass: CompassAnchor,
    onCaptured?: () => void
  ): boolean {
    const now = this.scene.time.now;
    if (now < this.busyUntil) return false;

    const focus = this.focusFor(discovery, context);
    if (!focus) return false;

    this.busyUntil = now + (this.reducedMotion ? 120 : 860);
    this.playFocusBeat(focus.x, focus.y, focus.color);
    this.captureEvidence(focus.x, focus.y, compass.x, compass.y, focus.sparkColor, onCaptured);
    return true;
  }

  public playStageTransition(
    completedStage: MissionStageId,
    nextStage: MissionStageId,
    focusX: number,
    focusY: number
  ): boolean {
    if (nextStage === 'complete') return false;

    const delay = this.reducedMotion ? 20 : 420;
    this.scene.time.delayedCall(delay, () => {
      this.roomSweep();
      this.showNextBeat(nextStage, focusX, focusY);
    });

    // Returning true tells the caller that it is worth delaying the next HUD
    // reveal briefly, even if the actual discovery focus is already playing.
    return completedStage !== 'question_gate';
  }

  private focusFor(discovery: DiscoveryId, context: DiscoveryFxContext): FocusSpec | null {
    switch (discovery) {
      case 'shadow_changed_after_quip':
        return {
          x: context.wallX - 70,
          y: Phaser.Math.Clamp(context.quipY, 190, 470),
          color: 0x9f7aea,
          sparkColor: 0xc4b5fd
        };
      case 'shadow_changed_after_light':
        return {
          x: context.wallX - 92,
          y: context.wallCenterY,
          color: 0xfacc15,
          sparkColor: 0xfde68a
        };
      case 'shadow_disappears_without_light':
        return { x: 640, y: 330, color: 0x60a5fa, sparkColor: 0x93c5fd };
      case 'shadow_returns_with_light':
        return {
          x: context.wallX - 85,
          y: context.wallCenterY,
          color: 0xfacc15,
          sparkColor: 0xfde68a
        };
      case 'large_shadow':
        return {
          x: context.wallX - 80,
          y: context.wallCenterY,
          color: 0xf59e0b,
          sparkColor: 0xfde68a
        };
      case 'small_shadow':
        return {
          x: context.wallX - 80,
          y: context.wallCenterY,
          color: 0x60a5fa,
          sparkColor: 0x93c5fd
        };
      case 'blocker_shadow':
        return {
          x: context.blockerX,
          y: context.blockerY,
          color: 0xf59e0b,
          sparkColor: 0xfde68a
        };
      case 'evidence_confirmed':
        return { x: 807, y: 190, color: 0xfacc15, sparkColor: 0xfde68a };
      case 'free_experimented':
        return { x: context.quipX, y: context.quipY - 30, color: 0x8b5cf6, sparkColor: 0xc4b5fd };
      case 'question_gate_entered':
        return { x: 640, y: 330, color: 0xfacc15, sparkColor: 0xfde68a };
      default:
        return null;
    }
  }

  private playFocusBeat(x: number, y: number, color: number): void {
    const veil = this.scene.add
      .rectangle(640, 360, 1280, 720, 0x070a18, 0.12)
      .setDepth(1135)
      .setAlpha(0);

    const glow = this.scene.add
      .ellipse(x, y, 280, 220, color, 0.035)
      .setStrokeStyle(4, color, 0.62)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(1137)
      .setAlpha(0)
      .setScale(0.72);

    const inner = this.scene.add
      .ellipse(x, y, 182, 142, 0xffffff, 0.012)
      .setStrokeStyle(2, 0xffffff, 0.42)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(1138)
      .setAlpha(0)
      .setScale(0.78);

    if (this.reducedMotion) {
      veil.setAlpha(0.08);
      glow.setAlpha(0.42).setScale(1);
      inner.setAlpha(0.35).setScale(1);
      this.scene.time.delayedCall(100, () => {
        veil.destroy();
        glow.destroy();
        inner.destroy();
      });
      return;
    }

    this.scene.tweens.add({ targets: veil, alpha: 0.18, duration: 120, yoyo: true, hold: 330 });
    this.scene.tweens.add({
      targets: [glow, inner],
      alpha: { from: 0, to: 0.88 },
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: 'Back.Out',
      yoyo: true,
      hold: 300,
      onComplete: () => {
        veil.destroy();
        glow.destroy();
        inner.destroy();
      }
    });

    this.microCameraPush(x, y);
  }

  private microCameraPush(targetX: number, targetY: number): void {
    if (this.reducedMotion) return;

    const camera = this.scene.cameras.main;
    const focusX = 640 + (targetX - 640) * 0.12;
    const focusY = 360 + (targetY - 360) * 0.10;

    camera.zoomTo(1.022, 180, 'Sine.easeOut');
    camera.pan(focusX, focusY, 180, 'Sine.easeOut');

    this.scene.time.delayedCall(420, () => {
      camera.zoomTo(1, 260, 'Sine.easeInOut');
      camera.pan(640, 360, 260, 'Sine.easeInOut');
    });
  }

  private captureEvidence(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: number,
    onCaptured?: () => void
  ): void {
    const count = this.reducedMotion ? 3 : 7;
    let completed = 0;

    for (let index = 0; index < count; index += 1) {
      const glyph = index % 3 === 0 ? '✦' : '•';
      const spark = this.scene.add
        .text(fromX + (index - count / 2) * 3, fromY - index * 2, glyph, {
          fontFamily: 'Arial, sans-serif',
          fontSize: glyph === '✦' ? '16px' : '13px',
          fontStyle: 'bold',
          color: `#${color.toString(16).padStart(6, '0')}`,
          stroke: '#fff7d6',
          strokeThickness: glyph === '✦' ? 1 : 0
        })
        .setOrigin(0.5)
        .setDepth(1270)
        .setBlendMode(Phaser.BlendModes.ADD);

      if (this.reducedMotion) {
        spark.setPosition(toX, toY);
        this.scene.time.delayedCall(60 + index * 12, () => {
          spark.destroy();
          completed += 1;
          if (completed === count) onCaptured?.();
        });
        continue;
      }

      const startX = spark.x;
      const startY = spark.y;
      const controlX = (startX + toX) / 2 + (index - count / 2) * 9;
      const controlY = Math.min(startY, toY) - 80 - (index % 3) * 16;
      const progress = { value: 0 };

      this.scene.tweens.add({
        targets: progress,
        value: 1,
        delay: index * 48,
        duration: 520 + index * 22,
        ease: 'Sine.InOut',
        onUpdate: () => {
          const t = progress.value;
          const oneMinus = 1 - t;
          spark.x = oneMinus * oneMinus * startX + 2 * oneMinus * t * controlX + t * t * toX;
          spark.y = oneMinus * oneMinus * startY + 2 * oneMinus * t * controlY + t * t * toY;
          spark.setScale(1 - t * 0.42);
          spark.setAlpha(1 - t * 0.28);
        },
        onComplete: () => {
          spark.destroy();
          completed += 1;
          if (completed === count) onCaptured?.();
        }
      });
    }
  }

  private roomSweep(): void {
    const sweep = this.scene.add
      .rectangle(-140, 355, 220, 780, 0xfde68a, 0.035)
      .setAngle(-9)
      .setDepth(1142)
      .setBlendMode(Phaser.BlendModes.ADD);

    if (this.reducedMotion) {
      this.scene.time.delayedCall(80, () => sweep.destroy());
      return;
    }

    this.scene.tweens.add({
      targets: sweep,
      x: 1420,
      alpha: { from: 0.03, to: 0.15 },
      duration: 620,
      ease: 'Sine.InOut',
      onComplete: () => sweep.destroy()
    });
  }

  private showNextBeat(stageId: MissionStageId, _focusX: number, _focusY: number): void {
    const copy = NEXT_STAGE_COPY[stageId];
    if (!copy) return;
    // P7.0: shown in the shared announcement lane at a fixed spot, not above
    // Quip, where it covered his speech bubble.
    announcementLane(this.scene).request(`next:${copy}`, () => this.drawNextBeat(copy, 640, 228 + 96), 880);
  }

  private drawNextBeat(copy: string, focusX: number, focusY: number): void {

    const plate = this.scene.add
      .rectangle(focusX, focusY - 96, 270, 42, 0x15172a, 0.90)
      .setStrokeStyle(2, 0xd7b35a, 0.78)
      .setDepth(1265)
      .setAlpha(0);
    const text = this.scene.add
      .text(focusX, focusY - 96, `NEXT • ${copy}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fff7d6',
        letterSpacing: 0.8
      })
      .setOrigin(0.5)
      .setDepth(1266)
      .setAlpha(0);

    if (this.reducedMotion) {
      plate.setAlpha(0.94);
      text.setAlpha(1);
      this.scene.time.delayedCall(220, () => {
        plate.destroy();
        text.destroy();
      });
      return;
    }

    plate.setScale(0.86);
    text.setScale(0.86);
    this.scene.tweens.add({
      targets: [plate, text],
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.time.delayedCall(520, () => {
          this.scene.tweens.add({
            targets: [plate, text],
            alpha: 0,
            y: '-=10',
            duration: 180,
            ease: 'Cubic.In',
            onComplete: () => {
              plate.destroy();
              text.destroy();
            }
          });
        });
      }
    });
  }
}
