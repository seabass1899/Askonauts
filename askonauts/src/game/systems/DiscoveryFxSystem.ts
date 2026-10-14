import Phaser from 'phaser';
import { shouldReduceMotion } from '../settings/GameSettingsStore';
import type { DiscoveryId, MissionStageId } from '../missions/types';
import { announcementLane } from './AnnouncementLane';

export type DiscoveryFxContext = {
  quipX: number;
  quipY: number;
  lightX: number;
  lightY: number;
  blockerX: number;
  blockerY: number;
  wallX: number;
  wallCenterY: number;
};

const CORE_SEGMENT_BY_STAGE: Partial<Record<MissionStageId, number>> = {
  shadow_follows: 0,
  light_matters: 1,
  lights_out: 2,
  size_hunt: 3,
  block_it: 4
};

const MEANINGFUL_DISCOVERIES = new Set<DiscoveryId>([
  'shadow_changed_after_quip',
  'shadow_changed_after_light',
  'shadow_disappears_without_light',
  'shadow_returns_with_light',
  'large_shadow',
  'small_shadow',
  'blocker_shadow',
  'evidence_confirmed',
  'free_experimented',
  'question_gate_entered'
]);

/**
 * P1.1C — high-feedback discovery presentation.
 *
 * This system is deliberately presentation-only. It does not change mission
 * state, optics math, drag geometry, or telemetry. It turns semantic discovery
 * events into short, non-blocking visual rewards and keeps the in-world
 * Question Compass visibly charging as the core shadow clues are completed.
 */
export class DiscoveryFxSystem {
  private readonly reducedMotion: boolean;
  private readonly compassX = 807;
  private readonly compassY = 190;
  private readonly compassHalo: Phaser.GameObjects.Arc;
  private readonly compassCore: Phaser.GameObjects.Arc;
  private readonly compassNeedle: Phaser.GameObjects.Rectangle;
  private readonly compassSegments: Phaser.GameObjects.Arc[] = [];
  private readonly streakText: Phaser.GameObjects.Text;
  private activatedSegments = 0;
  private lastDiscoveryAt = -100000;
  private streakCount = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.reducedMotion = shouldReduceMotion();

    this.compassHalo = scene.add
      .circle(this.compassX, this.compassY, 48, 0x7c3aed, 0.02)
      .setStrokeStyle(2, 0xd7b35a, 0.26)
      .setDepth(7.2);

    this.compassCore = scene.add
      .circle(this.compassX, this.compassY, 19, 0x251f55, 0.72)
      .setStrokeStyle(2, 0xf5d77a, 0.66)
      .setDepth(7.25);
    this.compassNeedle = scene.add
      .rectangle(this.compassX, this.compassY - 12, 3, 24, 0xfde68a, 0.92)
      .setOrigin(0.5, 1)
      .setDepth(7.35);

    for (let index = 0; index < 5; index += 1) {
      const angle = Phaser.Math.DegToRad(-140 + index * 70);
      const segment = scene.add
        .circle(
          this.compassX + Math.cos(angle) * 58,
          this.compassY + Math.sin(angle) * 58,
          6.5,
          0x493361,
          0.46
        )
        .setStrokeStyle(2, 0xd7b35a, 0.34)
        .setDepth(7.4);
      this.compassSegments.push(segment);
    }

    this.streakText = scene.add
      .text(640, 235, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#fff7d6',
        backgroundColor: '#392553',
        padding: { x: 12, y: 7 },
        stroke: '#171526',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(1280)
      .setVisible(false)
      .setAlpha(0);
  }

  public celebrateDiscoveries(
    discoveries: readonly DiscoveryId[],
    context: DiscoveryFxContext
  ): DiscoveryId | null {
    const meaningful = discoveries.filter((id) => MEANINGFUL_DISCOVERIES.has(id));
    if (!meaningful.length) return null;

    // One hero effect per semantic observation keeps the room energetic without
    // flooding the child when several discoveries resolve from the same frame.
    const discovery = this.pickHeroDiscovery(meaningful);
    this.playDiscoveryEffect(discovery, context);
    this.noteDiscoveryStreak();
    return discovery;
  }

  public getCompassAnchor(): { x: number; y: number } {
    return { x: this.compassX, y: this.compassY };
  }

  public noteStageComplete(stageId: MissionStageId): void {
    const segmentIndex = CORE_SEGMENT_BY_STAGE[stageId];
    if (segmentIndex === undefined) {
      if (stageId === 'evidence_lock') this.pulseAllCompassSegments();
      return;
    }

    this.activateCompassSegment(segmentIndex);
  }

  public pulseCompass(): void {
    this.scene.tweens.killTweensOf(this.compassHalo);
    this.scene.tweens.killTweensOf(this.compassCore);
    this.scene.tweens.killTweensOf(this.compassNeedle);
    this.compassHalo.setAlpha(0.12).setScale(0.88);
    this.compassCore.setAlpha(0.72).setScale(0.92);
    this.scene.tweens.add({
      targets: this.compassHalo,
      alpha: { from: 0.12, to: 0.48 },
      scaleX: { from: 0.88, to: 1.22 },
      scaleY: { from: 0.88, to: 1.22 },
      duration: this.reducedMotion ? 1 : 380,
      yoyo: true,
      ease: 'Sine.InOut',
      onComplete: () => this.compassHalo.setAlpha(0.02).setScale(1)
    });
    this.scene.tweens.add({
      targets: this.compassCore,
      scaleX: 1.24,
      scaleY: 1.24,
      alpha: 1,
      duration: this.reducedMotion ? 1 : 190,
      yoyo: !this.reducedMotion,
      ease: 'Back.Out',
      onComplete: () => this.compassCore.setScale(1).setAlpha(0.72)
    });
    if (!this.reducedMotion) {
      this.scene.tweens.add({
        targets: this.compassNeedle,
        angle: this.compassNeedle.angle + 120,
        duration: 420,
        ease: 'Cubic.Out'
      });
    }
  }

  private pickHeroDiscovery(discoveries: readonly DiscoveryId[]): DiscoveryId {
    const priority: DiscoveryId[] = [
      'question_gate_entered',
      'free_experimented',
      'evidence_confirmed',
      'blocker_shadow',
      'large_shadow',
      'small_shadow',
      'shadow_disappears_without_light',
      'shadow_returns_with_light',
      'shadow_changed_after_light',
      'shadow_changed_after_quip'
    ];
    return priority.find((id) => discoveries.includes(id)) ?? discoveries[0];
  }

  private playDiscoveryEffect(discovery: DiscoveryId, context: DiscoveryFxContext): void {
    switch (discovery) {
      case 'shadow_changed_after_quip':
        this.ringPulse(context.wallX, context.quipY - 8, 0xc4b5fd, 'SHADOW MOVED!');
        break;
      case 'shadow_changed_after_light':
        this.beamRipple(context.lightX + 54, context.lightY - 10, context.wallX - 30, context.wallCenterY);
        this.popLabel(context.wallX - 120, context.wallCenterY - 140, 'LIGHT CHANGED IT!', 0xfde68a);
        break;
      case 'shadow_disappears_without_light':
        this.darknessMoment('NO LIGHT…');
        break;
      case 'shadow_returns_with_light':
        this.screenFlash(context.wallX - 5, context.wallCenterY, 0xfde68a);
        this.popLabel(context.wallX - 125, context.wallCenterY - 135, 'SHADOW RETURNS!', 0xfde68a);
        break;
      case 'large_shadow':
        this.scalePulse(context.wallX - 18, context.wallCenterY, 1.65, 'HUGE!', 0xf59e0b);
        break;
      case 'small_shadow':
        this.scalePulse(context.wallX - 18, context.wallCenterY, 0.68, 'TINY!', 0x93c5fd);
        break;
      case 'blocker_shadow':
        this.ringPulse(context.blockerX, context.blockerY, 0xf59e0b, 'ANOTHER SHADOW!');
        this.ringPulse(context.wallX - 20, context.wallCenterY + 72, 0xc4b5fd, '');
        break;
      case 'evidence_confirmed':
        this.pulseAllCompassSegments();
        this.popLabel(this.compassX, this.compassY + 88, 'EVIDENCE LOCKED!', 0xfde68a);
        break;
      case 'free_experimented':
        this.rainbowBurst(640, 300);
        this.popLabel(640, 242, 'GREAT ASKING!', 0xfde68a);
        break;
      case 'question_gate_entered':
        this.rainbowBurst(640, 320);
        break;
      default:
        break;
    }
  }

  private activateCompassSegment(index: number): void {
    if (index < this.activatedSegments || !this.compassSegments[index]) return;
    this.activatedSegments = Math.max(this.activatedSegments, index + 1);

    const segment = this.compassSegments[index];
    segment.setFillStyle(0xfacc15, 0.96).setStrokeStyle(2, 0xfff7d6, 0.94);
    this.scene.tweens.killTweensOf(segment);
    this.scene.tweens.add({
      targets: segment,
      scaleX: this.reducedMotion ? 1 : 1.72,
      scaleY: this.reducedMotion ? 1 : 1.72,
      alpha: { from: 0.7, to: 1 },
      duration: this.reducedMotion ? 1 : 180,
      yoyo: !this.reducedMotion,
      ease: 'Back.Out'
    });
    this.pulseCompass();
  }

  private pulseAllCompassSegments(): void {
    this.compassSegments.forEach((segment, index) => {
      this.scene.time.delayedCall(index * 70, () => {
        segment.setFillStyle(0xfacc15, 0.98).setStrokeStyle(2, 0xfff7d6, 0.96);
        if (this.reducedMotion) return;
        this.scene.tweens.add({
          targets: segment,
          scaleX: 1.55,
          scaleY: 1.55,
          duration: 150,
          yoyo: true,
          ease: 'Back.Out'
        });
      });
    });
    this.activatedSegments = 5;
    this.pulseCompass();
  }

  private noteDiscoveryStreak(): void {
    const now = this.scene.time.now;
    const delta = now - this.lastDiscoveryAt;

    if (delta >= 800 && delta <= 12000) {
      this.streakCount += 1;
    } else if (delta > 12000) {
      this.streakCount = 1;
    }
    this.lastDiscoveryAt = now;

    if (this.streakCount === 2) this.showStreak('CURIOUS!');
    else if (this.streakCount === 3) this.showStreak('GREAT ASKING!');
    else if (this.streakCount >= 4) this.showStreak('DISCOVERY STREAK!');
  }

  private showStreak(copy: string): void {
    announcementLane(this.scene).request(`streak:${copy}`, () => this.drawStreak(copy), 970);
  }

  private drawStreak(copy: string): void {
    this.streakText.setText(copy).setVisible(true).setAlpha(1).setScale(0.82);
    this.scene.tweens.killTweensOf(this.streakText);
    this.scene.tweens.add({
      targets: this.streakText,
      scaleX: 1,
      scaleY: 1,
      y: 225,
      duration: this.reducedMotion ? 1 : 170,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.time.delayedCall(620, () => {
          this.scene.tweens.add({
            targets: this.streakText,
            alpha: 0,
            y: 214,
            duration: this.reducedMotion ? 1 : 180,
            onComplete: () => this.streakText.setVisible(false).setY(235)
          });
        });
      }
    });
  }

  private ringPulse(x: number, y: number, color: number, label: string): void {
    for (let index = 0; index < 3; index += 1) {
      const ring = this.scene.add
        .circle(x, y, 24 + index * 6, color, 0.02)
        .setStrokeStyle(4 - index, color, 0.86 - index * 0.16)
        .setDepth(1200)
        .setScale(0.65)
        .setAlpha(0.95);
      this.scene.tweens.add({
        targets: ring,
        scaleX: this.reducedMotion ? 1 : 2.2 + index * 0.25,
        scaleY: this.reducedMotion ? 1 : 2.2 + index * 0.25,
        alpha: 0,
        delay: index * 80,
        duration: this.reducedMotion ? 1 : 560,
        ease: 'Cubic.Out',
        onComplete: () => ring.destroy()
      });
    }
    if (label) this.popLabel(x, y - 82, label, color);
  }

  private beamRipple(fromX: number, fromY: number, toX: number, toY: number): void {
    const beam = this.scene.add.graphics().setDepth(1190).setAlpha(0.92);
    beam.lineStyle(7, 0xfde68a, 0.62);
    beam.lineBetween(fromX, fromY, toX, toY);
    beam.lineStyle(2, 0xffffff, 0.76);
    beam.lineBetween(fromX, fromY, toX, toY);
    this.scene.tweens.add({
      targets: beam,
      alpha: 0,
      duration: this.reducedMotion ? 1 : 420,
      ease: 'Sine.Out',
      onComplete: () => beam.destroy()
    });
  }

  private darknessMoment(copy: string): void {
    const veil = this.scene.add.rectangle(640, 360, 1280, 720, 0x080b1c, 0.22).setDepth(1170);
    const stars: Phaser.GameObjects.Arc[] = [];
    for (let index = 0; index < 9; index += 1) {
      const star = this.scene.add
        .circle(420 + (index * 97) % 520, 170 + (index * 53) % 240, 2 + (index % 2), 0xe0f2fe, 0.9)
        .setDepth(1171);
      stars.push(star);
    }
    this.popLabel(640, 260, copy, 0x93c5fd);
    this.scene.time.delayedCall(this.reducedMotion ? 40 : 420, () => {
      this.scene.tweens.add({
        targets: [veil, ...stars],
        alpha: 0,
        duration: this.reducedMotion ? 1 : 260,
        onComplete: () => {
          veil.destroy();
          stars.forEach((star) => star.destroy());
        }
      });
    });
  }

  private scalePulse(x: number, y: number, scale: number, label: string, color: number): void {
    const ring = this.scene.add
      .circle(x, y, 58, color, 0.035)
      .setStrokeStyle(5, color, 0.9)
      .setDepth(1200);
    this.popLabel(x - 65, y - 145, label, color);
    this.scene.tweens.add({
      targets: ring,
      scaleX: this.reducedMotion ? 1 : scale,
      scaleY: this.reducedMotion ? 1 : scale,
      alpha: 0,
      duration: this.reducedMotion ? 1 : 520,
      ease: scale > 1 ? 'Back.Out' : 'Cubic.In',
      onComplete: () => ring.destroy()
    });
  }

  private screenFlash(x: number, y: number, color: number): void {
    const flash = this.scene.add.rectangle(x, y, 220, 390, color, 0.12).setDepth(1180);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: this.reducedMotion ? 1 : 300,
      onComplete: () => flash.destroy()
    });
  }

  private rainbowBurst(x: number, y: number): void {
    const colors = [0xfacc15, 0x93c5fd, 0xc4b5fd, 0xfb7185, 0x86efac];
    for (let index = 0; index < 18; index += 1) {
      const angle = (Math.PI * 2 * index) / 18;
      const color = colors[index % colors.length];
      const dot = this.scene.add.circle(x, y, 4 + (index % 3), color, 0.95).setDepth(1240);
      this.scene.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * (80 + (index % 4) * 14),
        y: y + Math.sin(angle) * (80 + (index % 4) * 14),
        alpha: 0,
        scaleX: 1.7,
        scaleY: 1.7,
        duration: this.reducedMotion ? 1 : 650,
        ease: 'Cubic.Out',
        onComplete: () => dot.destroy()
      });
    }
  }

  private popLabel(x: number, y: number, copy: string, color: number): void {
    announcementLane(this.scene).request(`pop:${copy}`, () => this.drawPopLabel(x, y, copy, color), 880);
  }

  private drawPopLabel(x: number, y: number, copy: string, color: number): void {
    const label = this.scene.add
      .text(x, y, copy, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#fff7d6',
        backgroundColor: '#231b35',
        padding: { x: 10, y: 6 },
        stroke: `#${color.toString(16).padStart(6, '0')}`,
        strokeThickness: 2
      })
      .setOrigin(0.5)
      .setDepth(1260)
      .setScale(0.82)
      .setAlpha(0.98);

    this.scene.tweens.add({
      targets: label,
      y: y - 16,
      scaleX: 1,
      scaleY: 1,
      duration: this.reducedMotion ? 1 : 170,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.time.delayedCall(520, () => {
          this.scene.tweens.add({
            targets: label,
            y: label.y - 12,
            alpha: 0,
            duration: this.reducedMotion ? 1 : 190,
            onComplete: () => label.destroy()
          });
        });
      }
    });
  }
}
