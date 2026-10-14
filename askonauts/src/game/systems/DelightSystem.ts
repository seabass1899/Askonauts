import Phaser from 'phaser';
import { shouldReduceMotion } from '../settings/GameSettingsStore';
import type { MissionStageId } from '../missions/types';
import { announcementLane } from './AnnouncementLane';

const CHALLENGE_COPY: Partial<Record<MissionStageId, { eyebrow: string; title: string }>> = {
  mystery: { eyebrow: 'MYSTERY', title: 'Something is following Quip…' },
  shadow_follows: { eyebrow: 'SHADOW CHALLENGE', title: 'Can you make the shadow follow?' },
  light_matters: { eyebrow: 'LIGHT CHALLENGE', title: 'What else changes the shadow?' },
  lights_out: { eyebrow: 'DARKNESS TEST', title: 'Can a shadow survive without light?' },
  size_hunt: { eyebrow: 'SIZE CHALLENGE', title: 'Make it HUGE… then tiny!' },
  block_it: { eyebrow: 'TWO SHADOWS', title: 'Can you make another shadow?' }
};

const REWARD_COPY: Partial<Record<MissionStageId, string>> = {
  mystery: 'MYSTERY STARTED!',
  shadow_follows: 'SHADOW CLUE FOUND!',
  light_matters: 'LIGHT CLUE FOUND!',
  lights_out: 'LIGHTS-OUT CLUE!',
  size_hunt: 'SIZE MASTERED!',
  block_it: 'TWO SHADOWS!',
  evidence_lock: 'EVIDENCE LOCKED!',
  free_experiment: 'NEW QUESTION FOUND!',
  question_gate: 'QUESTION GATE OPEN!'
};

/**
 * P1.2A-HF1 — cinematic child-facing challenge presentation.
 *
 * The challenge card is intentionally compact and retracts after the child has
 * had time to read it. This keeps the Light Lab as the visual hero instead of
 * leaving a large HUD panel parked across the environment.
 */
export class DelightSystem {
  private readonly challengeContainer: Phaser.GameObjects.Container;
  private readonly challengePlate: Phaser.GameObjects.Rectangle;
  private readonly challengeEyebrow: Phaser.GameObjects.Text;
  private readonly challengeTitle: Phaser.GameObjects.Text;
  private readonly sparkCounter: Phaser.GameObjects.Text;
  private readonly rewardContainer: Phaser.GameObjects.Container;
  private readonly rewardPlate: Phaser.GameObjects.Rectangle;
  private readonly rewardText: Phaser.GameObjects.Text;
  private readonly reducedMotion: boolean;
  private currentSparks = 0;
  private retractEvent: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.reducedMotion = shouldReduceMotion();

    this.challengePlate = scene.add
      .rectangle(0, 0, 500, 58, 0x07162c, 0.94)
      .setStrokeStyle(2, 0x67e8f9, 0.62);
    this.challengeEyebrow = scene.add
      .text(-220, -14, 'MYSTERY', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#f5d77a',
        letterSpacing: 1.25
      })
      .setOrigin(0, 0.5);
    this.challengeTitle = scene.add
      .text(-220, 10, 'Something is following Quip…', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#fff7df'
      })
      .setOrigin(0, 0.5);
    this.sparkCounter = scene.add
      .text(222, 0, '✦ 0', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#fde68a',
        backgroundColor: '#392553',
        padding: { x: 8, y: 5 }
      })
      .setOrigin(1, 0.5);

    this.challengeContainer = scene.add
      .container(640, 116, [
        this.challengePlate,
        this.challengeEyebrow,
        this.challengeTitle,
        this.sparkCounter
      ])
      .setDepth(910)
      .setAlpha(0)
      .setY(98);

    this.rewardPlate = scene.add
      .rectangle(0, 0, 360, 54, 0x2c1646, 0.94)
      .setStrokeStyle(2, 0xfacc15, 0.88);
    this.rewardText = scene.add
      .text(0, 0, 'CLUE FOUND!  +2 ✦', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#fff7d6',
        align: 'center'
      })
      .setOrigin(0.5);
    this.rewardContainer = scene.add
      .container(640, 142, [this.rewardPlate, this.rewardText])
      .setDepth(1250)
      .setVisible(false)
      .setAlpha(0)
      .setScale(0.82);
  }

  public showStage(stageId: MissionStageId, sparks: number): void {
    this.setSparks(sparks);
    this.retractEvent?.remove(false);
    this.retractEvent = null;

    const copy = CHALLENGE_COPY[stageId];
    if (!copy) {
      this.hideChallenge();
      return;
    }

    this.challengeEyebrow.setText(copy.eyebrow);
    this.challengeTitle.setText(copy.title);
    this.challengeContainer.setVisible(true);
    this.scene.tweens.killTweensOf(this.challengeContainer);

    if (this.reducedMotion) {
      this.challengeContainer.setAlpha(0.94).setY(116).setScale(1);
    } else {
      this.challengeContainer.setAlpha(0).setY(98).setScale(0.96);
      this.scene.tweens.add({
        targets: this.challengeContainer,
        alpha: 0.94,
        y: 116,
        scaleX: 1,
        scaleY: 1,
        duration: 240,
        ease: 'Back.Out'
      });
    }

    // After the prompt has been read, let the world take center stage. The card
    // remains legible but no longer dominates the top third of the room.
    this.retractEvent = this.scene.time.delayedCall(2600, () => {
      if (!this.challengeContainer.visible) return;
      this.scene.tweens.add({
        targets: this.challengeContainer,
        alpha: 0.70,
        y: 103,
        scaleX: 0.90,
        scaleY: 0.90,
        duration: this.reducedMotion ? 1 : 280,
        ease: 'Sine.Out'
      });
    });
  }

  public hideForCinematicTransition(): void {
    this.retractEvent?.remove(false);
    this.retractEvent = null;
    this.scene.tweens.killTweensOf(this.challengeContainer);

    if (!this.challengeContainer.visible) return;

    if (this.reducedMotion) {
      this.challengeContainer.setAlpha(0.18);
      return;
    }

    this.scene.tweens.add({
      targets: this.challengeContainer,
      alpha: 0.22,
      y: 100,
      duration: 140,
      ease: 'Sine.Out'
    });
  }

  public setSparks(sparks: number): void {
    if (sparks === this.currentSparks) return;
    this.currentSparks = sparks;
    this.sparkCounter.setText(`✦ ${sparks}`);
    if (this.reducedMotion) return;
    this.scene.tweens.add({
      targets: this.sparkCounter,
      scaleX: 1.22,
      scaleY: 1.22,
      duration: 105,
      yoyo: true,
      ease: 'Back.Out'
    });
  }

  public celebrateStage(
    completedStage: MissionStageId,
    sparksAdded: number,
    fromX: number,
    fromY: number
  ): void {
    const label = REWARD_COPY[completedStage] ?? 'CLUE FOUND!';
    const suffix = sparksAdded > 0 ? `  +${sparksAdded} ✦` : '';

    this.spawnBurst(fromX, fromY);
    this.flySparks(fromX, fromY, 807, 190, Math.max(4, Math.min(8, sparksAdded + 3)));

    // P7.0: the banner waits its turn in the shared announcement lane.
    announcementLane(this.scene).request(
      `reward:${label}`,
      () => this.showRewardBanner(`${label}${suffix}`),
      1100,
      true
    );
  }

  private showRewardBanner(copy: string): void {
    this.rewardText.setText(copy);
    this.rewardContainer.setVisible(true).setAlpha(1).setScale(1);

    this.scene.tweens.killTweensOf(this.rewardContainer);
    if (!this.reducedMotion) {
      this.rewardContainer.setScale(0.82).setAlpha(0);
      this.scene.tweens.add({
        targets: this.rewardContainer,
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        duration: 170,
        ease: 'Back.Out',
        onComplete: () => this.scene.time.delayedCall(700, () => this.fadeReward())
      });
    } else {
      this.scene.time.delayedCall(700, () => this.fadeReward());
    }
  }

  public celebrateSecret(copy: string, x: number, y: number): void {
    this.spawnBurst(x, y, 0x93c5fd);
    this.flySparks(x, y, 807, 190, 7, 0x93c5fd);
    announcementLane(this.scene).request(`secret:${copy}`, () => {
      this.rewardText.setText(copy);
      this.rewardContainer.setVisible(true).setAlpha(1).setScale(1);
      this.scene.time.delayedCall(860, () => this.fadeReward());
    }, 1100, true);
  }

  public microSpark(x: number, y: number): void {
    this.spawnBurst(x, y, 0xfde68a, 7, 34);
  }

  private hideChallenge(): void {
    this.retractEvent?.remove(false);
    this.retractEvent = null;
    this.scene.tweens.killTweensOf(this.challengeContainer);
    this.scene.tweens.add({
      targets: this.challengeContainer,
      alpha: 0,
      y: 66,
      duration: this.reducedMotion ? 1 : 170,
      ease: 'Sine.In',
      onComplete: () => this.challengeContainer.setVisible(false)
    });
  }

  private fadeReward(): void {
    if (!this.rewardContainer.visible) return;
    this.scene.tweens.add({
      targets: this.rewardContainer,
      y: 132,
      alpha: 0,
      duration: this.reducedMotion ? 1 : 210,
      ease: 'Cubic.In',
      onComplete: () => this.rewardContainer.setVisible(false).setY(142).setScale(0.82)
    });
  }

  private spawnBurst(x: number, y: number, color = 0xfacc15, count = 12, radius = 62): void {
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + (index % 2 ? 0.13 : 0);
      const distance = radius * (0.72 + (index % 3) * 0.12);
      const star = this.scene.add
        .text(x, y, index % 3 === 0 ? '✦' : '•', {
          fontFamily: 'Arial, sans-serif',
          fontSize: index % 3 === 0 ? '18px' : '14px',
          fontStyle: 'bold',
          color: `#${color.toString(16).padStart(6, '0')}`
        })
        .setOrigin(0.5)
        .setDepth(1220);

      if (this.reducedMotion) {
        this.scene.time.delayedCall(220, () => star.destroy());
        continue;
      }

      this.scene.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scaleX: 1.45,
        scaleY: 1.45,
        angle: 90,
        duration: 520,
        ease: 'Cubic.Out',
        onComplete: () => star.destroy()
      });
    }
  }

  private flySparks(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    count: number,
    color = 0xfacc15
  ): void {
    for (let index = 0; index < count; index += 1) {
      const spark = this.scene.add
        .circle(fromX + (index - count / 2) * 5, fromY - index * 2, 4, color, 0.95)
        .setStrokeStyle(1, 0xfff7d6, 0.9)
        .setDepth(1230);

      if (this.reducedMotion) {
        spark.setPosition(toX, toY);
        this.scene.time.delayedCall(80, () => spark.destroy());
        continue;
      }

      this.scene.tweens.add({
        targets: spark,
        x: toX + (index - count / 2) * 4,
        y: toY + (index % 2 ? 5 : -5),
        alpha: { from: 1, to: 0.15 },
        scaleX: { from: 1, to: 0.42 },
        scaleY: { from: 1, to: 0.42 },
        delay: index * 36,
        duration: 520 + index * 20,
        ease: 'Cubic.In',
        onComplete: () => spark.destroy()
      });
    }
  }
}
