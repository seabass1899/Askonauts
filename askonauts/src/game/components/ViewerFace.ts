import Phaser from 'phaser';

export type ViewerExpression = 'curious' | 'surprised' | 'happy';

type ViewerFaceOptions = {
  scale?: number;
  showShoulders?: boolean;
  reflection?: boolean;
};

/**
 * Reusable ASKONAUT-style viewer face for optics experiments.
 * The same component is used for the physical viewer and the reflected image
 * so children can immediately connect cause and effect.
 */
export class ViewerFace extends Phaser.GameObjects.Container {
  private leftBrow: Phaser.GameObjects.Rectangle;
  private rightBrow: Phaser.GameObjects.Rectangle;
  private smile: Phaser.GameObjects.Arc;
  private surprisedMouth: Phaser.GameObjects.Ellipse;
  private happyMouth: Phaser.GameObjects.Arc;
  private cheekLeft: Phaser.GameObjects.Ellipse;
  private cheekRight: Phaser.GameObjects.Ellipse;
  private baseScale: number;
  private reflectionMode: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, options: ViewerFaceOptions = {}) {
    super(scene, x, y);
    scene.add.existing(this);

    this.baseScale = options.scale ?? 1;
    const reflection = options.reflection ?? false;
    this.reflectionMode = reflection;
    const showShoulders = options.showShoulders ?? true;

    const outline = reflection ? 0xfff7ed : 0xe9d5ff;
    const shirt = reflection ? 0x6d4ecf : 0x4338ca;
    const skin = 0x9a5d3b;
    const skinLight = 0xc9875f;
    const hair = 0x201512;
    const eye = 0x25160f;

    if (showShoulders) {
      // Compact rounded bust: intentionally avoids pointed torso geometry that can read
      // as a detached wedge when the viewer is scaled or tweened along the distance rail.
      const torso = scene.add.ellipse(0, 57, 72, 30, shirt, 0.98)
        .setStrokeStyle(2, reflection ? 0xfbbf24 : 0x8b5cf6, 0.72);
      const shoulders = scene.add.ellipse(0, 44, 84, 34, shirt, 0.98)
        .setStrokeStyle(2, reflection ? 0xfbbf24 : 0x8b5cf6, 0.75);
      const neck = scene.add.rectangle(0, 31, 19, 18, skin, 1);
      const collarLeft = scene.add.triangle(-7, 38, -16, 0, 2, 0, -3, 18, 0xf8fafc, 0.82);
      const collarRight = scene.add.triangle(7, 38, -2, 0, 16, 0, 3, 18, 0xf8fafc, 0.82);
      this.add([torso, shoulders, neck, collarLeft, collarRight]);
    }

    // Ears sit behind the head.
    const leftEar = scene.add.ellipse(-34, 1, 14, 20, skin, 1).setStrokeStyle(2, outline, 0.65);
    const rightEar = scene.add.ellipse(34, 1, 14, 20, skin, 1).setStrokeStyle(2, outline, 0.65);

    const head = scene.add.ellipse(0, 0, 72, 78, skin, 1).setStrokeStyle(4, outline, 0.95);
    const faceHighlight = scene.add.ellipse(-12, -10, 34, 46, skinLight, 0.24);

    // Hair silhouette: several soft lobes create a much richer face than the old circle icon.
    const hairCap = scene.add.ellipse(0, -29, 66, 30, hair, 1);
    const hairLeft = scene.add.circle(-26, -23, 13, hair, 1);
    const hairMid = scene.add.circle(-7, -31, 15, hair, 1);
    const hairRight = scene.add.circle(17, -29, 14, hair, 1);
    const hairTip = scene.add.circle(29, -20, 10, hair, 1);

    const leftEyeWhite = scene.add.ellipse(-14, -5, 15, 18, 0xffffff, 1);
    const rightEyeWhite = scene.add.ellipse(14, -5, 15, 18, 0xffffff, 1);
    const leftIris = scene.add.circle(-14, -4, 4.5, eye, 1);
    const rightIris = scene.add.circle(14, -4, 4.5, eye, 1);
    const leftCatch = scene.add.circle(-12.5, -6.2, 1.4, 0xffffff, 1);
    const rightCatch = scene.add.circle(15.5, -6.2, 1.4, 0xffffff, 1);

    this.leftBrow = scene.add.rectangle(-14, -18, 16, 3, hair, 0.95).setRotation(-0.08);
    this.rightBrow = scene.add.rectangle(14, -18, 16, 3, hair, 0.95).setRotation(0.08);

    const nose = scene.add.triangle(0, 5, 0, -3, -3, 4, 3, 4, 0x7a432e, 0.65);
    this.cheekLeft = scene.add.ellipse(-22, 10, 12, 7, 0xf59e8b, 0.18);
    this.cheekRight = scene.add.ellipse(22, 10, 12, 7, 0xf59e8b, 0.18);

    this.smile = scene.add.arc(0, 10, 17, 20, 160, false, 0xffffff, 0).setStrokeStyle(3, 0xffffff, 0.95);
    this.happyMouth = scene.add.arc(0, 8, 22, 18, 165, false, 0xffffff, 0).setStrokeStyle(4, 0xffffff, 1);
    this.surprisedMouth = scene.add.ellipse(0, 15, 12, 16, 0x4b1d16, 0.95).setStrokeStyle(2, 0xffffff, 0.85);

    this.add([
      leftEar, rightEar, head, faceHighlight,
      hairCap, hairLeft, hairMid, hairRight, hairTip,
      leftEyeWhite, rightEyeWhite, leftIris, rightIris, leftCatch, rightCatch,
      this.leftBrow, this.rightBrow, nose, this.cheekLeft, this.cheekRight,
      this.smile, this.happyMouth, this.surprisedMouth
    ]);

    this.setExpression('curious');
    this.setScale(this.baseScale);
  }

  setExpression(expression: ViewerExpression): this {
    this.smile.setVisible(expression === 'curious');
    this.happyMouth.setVisible(expression === 'happy');
    this.surprisedMouth.setVisible(expression === 'surprised');

    if (expression === 'surprised') {
      this.leftBrow.setY(-23).setRotation(0.12);
      this.rightBrow.setY(-23).setRotation(-0.12);
      this.cheekLeft.setAlpha(0.08);
      this.cheekRight.setAlpha(0.08);
    } else if (expression === 'happy') {
      this.leftBrow.setY(-18).setRotation(-0.14);
      this.rightBrow.setY(-18).setRotation(0.14);
      this.cheekLeft.setAlpha(0.32);
      this.cheekRight.setAlpha(0.32);
    } else {
      this.leftBrow.setY(-18).setRotation(-0.08);
      this.rightBrow.setY(-18).setRotation(0.08);
      this.cheekLeft.setAlpha(0.18);
      this.cheekRight.setAlpha(0.18);
    }
    return this;
  }

  transitionState(
    inverted: boolean,
    visualScale: number,
    expression: ViewerExpression,
    animate = true,
    opticalStretchX = 1,
    opticalStretchY = 1
  ): void {
    this.setExpression(expression);

    // Reflection instances get a very small non-uniform transform so they feel optically curved
    // rather than like a perfectly resized UI icon. The physical viewer remains undistorted.
    const stretchX = this.reflectionMode ? opticalStretchX : 1;
    const stretchY = this.reflectionMode ? opticalStretchY : 1;
    const targetX = this.baseScale * visualScale * stretchX;
    const targetY = this.baseScale * visualScale * stretchY * (inverted ? -1 : 1);

    if (!animate) {
      this.setScale(targetX, targetY);
      this.setAlpha(this.reflectionMode ? 0.94 : 1);
      return;
    }

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scaleX: targetX,
      scaleY: targetY,
      alpha: { from: 0.52, to: this.reflectionMode ? 0.94 : 1 },
      duration: 330,
      ease: 'Sine.easeInOut'
    });
  }

  playReaction(expression: ViewerExpression, duration = 950): void {
    this.setExpression(expression);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 1.08,
      scaleY: this.scaleY * 1.08,
      duration: 120,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(duration, () => {
          if (this.active) this.setExpression('curious');
        });
      }
    });
  }
}
