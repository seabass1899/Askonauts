import Phaser from 'phaser';

/**
 * Production blocker prop for the Block It experiment.
 * Hidden until the mission reaches block_it; input is still handled by the
 * forgiving external Zone in ShadowBoxScene.
 */
export class BlockerObject extends Phaser.GameObjects.Container {
  private readonly grabRing: Phaser.GameObjects.Arc;
  private readonly pulseRing: Phaser.GameObjects.Arc;
  private readonly rock: Phaser.GameObjects.Image;
  private readonly wheelLeft: Phaser.GameObjects.Arc;
  private readonly wheelRight: Phaser.GameObjects.Arc;
  private readonly suspensionGlow: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.grabRing = scene.add
      .circle(0, 5, 74, 0x67e8f9, 0)
      .setStrokeStyle(5, 0x67e8f9, 0.82)
      .setVisible(false);

    this.pulseRing = scene.add
      .circle(0, 5, 68, 0xfde68a, 0)
      .setStrokeStyle(4, 0xfde68a, 0.78)
      .setVisible(false);

    const cartShadow = scene.add.ellipse(0, 64, 126, 18, 0x060812, 0.38);
    const cart = scene.add.rectangle(0, 43, 118, 23, 0x2b2140, 1)
      .setStrokeStyle(4, 0xc18a3e, 1);
    this.suspensionGlow = scene.add.rectangle(0, 43, 76, 5, 0x6d7cff, 0.72);

    this.wheelLeft = scene.add.circle(-43, 57, 10, 0x171827, 1)
      .setStrokeStyle(3, 0xd0a14a, 1);
    this.wheelRight = scene.add.circle(43, 57, 10, 0x171827, 1)
      .setStrokeStyle(3, 0xd0a14a, 1);
    const hubLeft = scene.add.circle(-43, 57, 3, 0x8b5cf6, 1);
    const hubRight = scene.add.circle(43, 57, 3, 0x8b5cf6, 1);

    const rockContactShadow = scene.add.ellipse(0, 31, 104, 20, 0x05060a, 0.30);

    this.rock = scene.add
      .image(0, -16, 'prop-rock-p12chf1')
      .setDisplaySize(116, 104);


    this.label = scene.add
      .text(0, 83, 'BLOCKER', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ead7a2',
        stroke: '#211622',
        strokeThickness: 3,
        letterSpacing: 1.1
      })
      .setOrigin(0.5);

    this.add([
      this.grabRing,
      this.pulseRing,
      cartShadow,
      cart,
      this.suspensionGlow,
      this.wheelLeft,
      this.wheelRight,
      hubLeft,
      hubRight,
      rockContactShadow,
      this.rock,
      this.label
    ]);
    this.setSize(165, 175);
    scene.add.existing(this);

    this.setVisible(false);
    this.setAlpha(0);

    this.scene.tweens.add({
      targets: this.suspensionGlow,
      alpha: { from: 0.28, to: 0.86 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  public unlock(): void {
    if (this.visible) return;

    this.setVisible(true).setAlpha(0).setScale(0.72).setY(this.y + 20);
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      y: this.y - 20,
      scaleX: 1,
      scaleY: 1,
      duration: 420,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.rock,
          y: -20,
          duration: 110,
          yoyo: true,
          ease: 'Quad.Out'
        });
      }
    });

    this.startPulse();
  }

  public setGrabbed(active: boolean): void {
    this.grabRing.setVisible(active);
    if (active) this.stopPulse();

    this.scene.tweens.killTweensOf(this.rock);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scaleX: active ? 1.055 : 1,
      scaleY: active ? 1.055 : 1,
      duration: active ? 100 : 190,
      ease: active ? 'Sine.Out' : 'Back.Out'
    });
    this.scene.tweens.add({
      targets: this.rock,
      y: active ? -25 : -16,
      angle: active ? -1.8 : 0,
      duration: active ? 120 : 260,
      ease: active ? 'Sine.Out' : 'Bounce.Out'
    });
  }

  public rollBy(deltaX: number): void {
    const deltaAngle = Phaser.Math.Clamp(deltaX * 2.4, -28, 28);
    this.wheelLeft.angle += deltaAngle;
    this.wheelRight.angle += deltaAngle;
  }

  public stopPulse(): void {
    this.pulseTween?.stop();
    this.pulseTween = null;
    this.pulseRing.setVisible(false).setScale(1).setAlpha(1);
  }

  private startPulse(): void {
    this.pulseTween?.stop();
    this.pulseRing.setVisible(true).setScale(0.88).setAlpha(0.85);
    this.pulseTween = this.scene.tweens.add({
      targets: this.pulseRing,
      scaleX: 1.35,
      scaleY: 1.35,
      alpha: { from: 0.82, to: 0.08 },
      duration: 850,
      repeat: -1,
      ease: 'Sine.Out'
    });
  }
}
