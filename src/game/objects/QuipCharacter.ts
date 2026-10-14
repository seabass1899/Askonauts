import Phaser from 'phaser';

export type QuipReaction = 'idle' | 'surprised' | 'skeptical' | 'joy';

/**
 * P1.2A production presentation rig for Quip.
 *
 * The canonical Quip artwork stays untouched. The animation is applied as
 * squash/stretch, body pose, floor shadow, aura and speech-bubble motion so we
 * gain personality without introducing a second drifting character design.
 */
export class QuipCharacter extends Phaser.GameObjects.Container {
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly floorShadow: Phaser.GameObjects.Ellipse;
  private readonly grabRing: Phaser.GameObjects.Arc;
  private readonly aura: Phaser.GameObjects.Arc;
  private readonly speechPanel: Phaser.GameObjects.Graphics;
  private readonly speechTail: Phaser.GameObjects.Triangle;
  private readonly reactionText: Phaser.GameObjects.Text;
  private readonly baseSpriteScaleX: number;
  private readonly baseSpriteScaleY: number;

  private clearEvent: Phaser.Time.TimerEvent | null = null;
  private reaction: QuipReaction = 'idle';
  private grabbed = false;
  private ambientBeatIndex = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.floorShadow = scene.add
      .ellipse(0, 80, 104, 23, 0x050816, 0.34)
      .setStrokeStyle(1, 0x8b5cf6, 0.12);

    this.aura = scene.add
      .circle(0, 0, 86, 0x8b5cf6, 0.02)
      .setStrokeStyle(4, 0xf6d365, 0.72)
      .setVisible(false);

    this.grabRing = scene.add
      .circle(0, 4, 102, 0x8b5cf6, 0)
      .setStrokeStyle(5, 0xc4b5fd, 0.8)
      .setVisible(false);

    this.sprite = scene.add.image(0, 0, 'quip-idle').setDisplaySize(132, 158);
    this.baseSpriteScaleX = this.sprite.scaleX;
    this.baseSpriteScaleY = this.sprite.scaleY;

    const label = scene.add
      .text(0, 96, 'QUIP', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#fff7dd',
        stroke: '#2b1c55',
        strokeThickness: 5
      })
      .setOrigin(0.5);

    // Production speech bubble: one consistent voice surface rather than a
    // separate portrait icon competing with the main character.
    this.speechPanel = scene.add.graphics().setVisible(false);
    this.redrawSpeechPanel();

    this.speechTail = scene.add
      .triangle(31, -87, 0, 0, 22, 0, 7, 18, 0x171a2f, 0.97)
      .setStrokeStyle(2, 0xd9b65f, 0.9)
      .setVisible(false);

    this.reactionText = scene.add
      .text(70, -126, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        align: 'center',
        color: '#fff7dd',
        lineSpacing: 2,
        wordWrap: { width: 205, useAdvancedWrap: true }
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.add([
      this.floorShadow,
      this.aura,
      this.grabRing,
      this.sprite,
      label,
      this.speechPanel,
      this.speechTail,
      this.reactionText
    ]);

    // Larger invisible touch target than the rendered character.
    this.setSize(220, 235);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-110, -108, 220, 224),
      Phaser.Geom.Rectangle.Contains
    );
    scene.input.setDraggable(this);
    scene.add.existing(this);
  }

  public setGrabbed(active: boolean): void {
    this.grabbed = active;
    this.grabRing.setVisible(active);
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this.floorShadow);

    if (active) {
      this.scene.tweens.add({
        targets: this.sprite,
        y: -5,
        scaleX: this.baseSpriteScaleX * 0.96,
        scaleY: this.baseSpriteScaleY * 1.055,
        duration: 95,
        ease: 'Sine.Out'
      });
      this.scene.tweens.add({
        targets: this.floorShadow,
        scaleX: 0.82,
        scaleY: 0.82,
        alpha: 0.22,
        duration: 95,
        ease: 'Sine.Out'
      });
      return;
    }

    this.scene.tweens.add({
      targets: this.sprite,
      y: 0,
      angle: 0,
      scaleX: this.baseSpriteScaleX,
      scaleY: this.baseSpriteScaleY,
      duration: 240,
      ease: 'Back.Out'
    });
    this.scene.tweens.add({
      targets: this.floorShadow,
      scaleX: 1,
      scaleY: 1,
      alpha: 0.34,
      duration: 220,
      ease: 'Sine.Out'
    });
  }

  public playIdleInvitation(): void {
    if (this.reaction !== 'idle' || this.grabbed) return;

    this.scene.tweens.killTweensOf(this.grabRing);
    this.grabRing.setVisible(true).setAlpha(0.12).setScale(0.92);
    this.scene.tweens.add({
      targets: this.grabRing,
      alpha: { from: 0.12, to: 0.82 },
      scaleX: { from: 0.92, to: 1.18 },
      scaleY: { from: 0.92, to: 1.18 },
      duration: 520,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.InOut',
      onComplete: () => {
        if (this.reaction === 'idle' && !this.grabbed) {
          this.grabRing.setVisible(false).setAlpha(1).setScale(1);
        }
      }
    });

    this.playBodyPose('invite');
  }

  public playAmbientBeat(): void {
    if (this.grabbed || this.reaction !== 'idle') return;

    const beats: Array<'breathe' | 'look' | 'bounce'> = ['breathe', 'look', 'bounce'];
    const beat = beats[this.ambientBeatIndex % beats.length];
    this.ambientBeatIndex += 1;
    this.playBodyPose(beat);
  }

  public celebrate(): void {
    if (this.grabbed) return;

    this.scene.tweens.killTweensOf(this.aura);
    this.aura.setVisible(true).setAlpha(0.74).setScale(0.62);
    this.scene.tweens.add({
      targets: this.aura,
      scaleX: 1.52,
      scaleY: 1.52,
      alpha: 0,
      duration: 620,
      ease: 'Cubic.Out',
      onComplete: () => this.aura.setVisible(false).setAlpha(1).setScale(1)
    });

    this.scene.tweens.killTweensOf(this.grabRing);
    this.grabRing.setVisible(true).setAlpha(0.9).setScale(0.74);
    this.scene.tweens.add({
      targets: this.grabRing,
      scaleX: 1.34,
      scaleY: 1.34,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.Out',
      onComplete: () => this.grabRing.setVisible(false).setAlpha(1).setScale(1)
    });

    this.playBodyPose('celebrate');
  }

  public stopIdleInvitation(): void {
    this.scene.tweens.killTweensOf(this.grabRing);
    this.grabRing.setVisible(false).setAlpha(1).setScale(1).setPosition(0, 4);

    if (this.reaction === 'idle' && !this.grabbed) {
      this.resetBodyPose();
    }
  }

  public showReaction(next: QuipReaction, caption: string, durationMs = 1300): void {
    if (next === 'idle') {
      this.clearReaction();
      return;
    }

    this.clearEvent?.remove(false);
    this.clearEvent = null;
    this.reaction = next;

    this.reactionText.setText(caption);
    this.speechPanel.setVisible(true).setAlpha(0).setScale(0.88);
    this.speechTail.setVisible(true).setAlpha(0).setScale(0.88);
    this.reactionText.setVisible(true).setAlpha(0).setScale(0.88);

    this.scene.tweens.add({
      targets: [this.speechPanel, this.speechTail, this.reactionText],
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 190,
      ease: 'Back.Out'
    });

    if (next === 'surprised') this.playBodyPose('surprised');
    else if (next === 'skeptical') this.playBodyPose('skeptical');
    else this.playBodyPose('joy');

    this.clearEvent = this.scene.time.delayedCall(durationMs, () => {
      this.clearReaction();
    });
  }

  public clearReactionAfter(delayMs: number): void {
    if (this.reaction === 'idle') return;

    this.clearEvent?.remove(false);
    this.clearEvent = this.scene.time.delayedCall(delayMs, () => {
      this.clearReaction();
    });
  }

  public clearReaction(): void {
    this.clearEvent?.remove(false);
    this.clearEvent = null;
    this.reaction = 'idle';

    this.scene.tweens.killTweensOf([this.speechPanel, this.speechTail, this.reactionText]);
    this.speechPanel.setVisible(false);
    this.speechTail.setVisible(false);
    this.reactionText.setVisible(false);
    this.setAngle(0);
    if (!this.grabbed) this.resetBodyPose();
  }

  private redrawSpeechPanel(): void {
    this.speechPanel.clear();
    this.speechPanel.fillStyle(0x171a2f, 0.97);
    this.speechPanel.fillRoundedRect(-50, -164, 240, 76, 18);
    this.speechPanel.lineStyle(3, 0xd9b65f, 0.92);
    this.speechPanel.strokeRoundedRect(-50, -164, 240, 76, 18);
    this.speechPanel.lineStyle(1, 0x8b5cf6, 0.42);
    this.speechPanel.strokeRoundedRect(-43, -157, 226, 62, 14);
  }

  private playBodyPose(
    pose: 'invite' | 'breathe' | 'look' | 'bounce' | 'celebrate' | 'surprised' | 'skeptical' | 'joy'
  ): void {
    if (this.grabbed) return;

    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this.floorShadow);
    this.resetBodyPose();

    if (pose === 'breathe') {
      this.scene.tweens.add({
        targets: this.sprite,
        y: -2,
        scaleX: this.baseSpriteScaleX * 1.008,
        scaleY: this.baseSpriteScaleY * 1.018,
        duration: 620,
        yoyo: true,
        ease: 'Sine.InOut',
        onComplete: () => this.resetBodyPose()
      });
      return;
    }

    if (pose === 'look') {
      this.scene.tweens.add({
        targets: this.sprite,
        x: -3,
        angle: -1.8,
        duration: 380,
        yoyo: true,
        hold: 120,
        ease: 'Sine.InOut',
        onComplete: () => this.resetBodyPose()
      });
      return;
    }

    if (pose === 'bounce' || pose === 'invite') {
      this.scene.tweens.add({
        targets: this.sprite,
        y: pose === 'invite' ? -8 : -5,
        angle: pose === 'invite' ? 2.4 : 1.4,
        scaleX: this.baseSpriteScaleX * 1.015,
        scaleY: this.baseSpriteScaleY * 0.99,
        duration: 190,
        yoyo: true,
        repeat: pose === 'invite' ? 1 : 0,
        ease: 'Sine.InOut',
        onComplete: () => this.resetBodyPose()
      });
      return;
    }

    if (pose === 'skeptical') {
      this.scene.tweens.add({
        targets: this.sprite,
        x: -4,
        angle: -4,
        scaleX: this.baseSpriteScaleX * 0.99,
        scaleY: this.baseSpriteScaleY * 1.01,
        duration: 220,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.InOut',
        onComplete: () => this.resetBodyPose()
      });
      return;
    }

    if (pose === 'surprised') {
      this.scene.tweens.add({
        targets: this.sprite,
        y: -17,
        scaleX: this.baseSpriteScaleX * 0.94,
        scaleY: this.baseSpriteScaleY * 1.08,
        duration: 125,
        yoyo: true,
        ease: 'Quad.Out',
        onComplete: () => this.resetBodyPose()
      });
      this.scene.tweens.add({
        targets: this.floorShadow,
        scaleX: 0.72,
        alpha: 0.18,
        duration: 125,
        yoyo: true,
        ease: 'Quad.Out'
      });
      return;
    }

    const hopHeight = pose === 'celebrate' ? -22 : -13;
    this.scene.tweens.add({
      targets: this.sprite,
      y: hopHeight,
      angle: pose === 'celebrate' ? 5 : 3,
      scaleX: this.baseSpriteScaleX * 1.045,
      scaleY: this.baseSpriteScaleY * 1.045,
      duration: 150,
      yoyo: true,
      repeat: pose === 'celebrate' ? 1 : 0,
      ease: 'Back.Out',
      onComplete: () => this.resetBodyPose()
    });
    this.scene.tweens.add({
      targets: this.floorShadow,
      scaleX: 1.18,
      scaleY: 0.72,
      alpha: 0.20,
      duration: 150,
      yoyo: true,
      ease: 'Sine.Out'
    });
  }

  private resetBodyPose(): void {
    this.sprite
      .setPosition(0, 0)
      .setAngle(0)
      .setScale(this.baseSpriteScaleX, this.baseSpriteScaleY);
    this.floorShadow.setScale(1).setAlpha(0.34);
  }
}
