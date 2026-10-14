import Phaser from 'phaser';

export class LightSource extends Phaser.GameObjects.Container {
  public enabled = true;

  private readonly halo: Phaser.GameObjects.Arc;
  private readonly bulb: Phaser.GameObjects.Arc;
  private readonly switchPad: Phaser.GameObjects.Arc;
  private readonly switchLabel: Phaser.GameObjects.Text;
  private readonly grabRing: Phaser.GameObjects.Arc;
  private readonly lensRotor: Phaser.GameObjects.Container;
  private readonly lensSheen: Phaser.GameObjects.Ellipse;
  private readonly statusGlow: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.grabRing = scene.add
      .circle(0, 4, 84, 0xf6d26a, 0)
      .setStrokeStyle(5, 0xf6d26a, 0.78)
      .setVisible(false);

    // Brass-and-indigo discovery lamp inspired by the approved Light Lab concept.
    const standBack = scene.add.rectangle(-22, 34, 12, 78, 0x563b31, 1).setAngle(16);
    const standFront = scene.add.rectangle(-15, 30, 7, 78, 0xc9903f, 1).setAngle(16);
    const base = scene.add.ellipse(-4, 78, 108, 24, 0x2b2140, 1)
      .setStrokeStyle(4, 0xc38f43, 0.95);
    const baseInset = scene.add.ellipse(-4, 75, 76, 12, 0x17203a, 1)
      .setStrokeStyle(2, 0x5b6da7, 0.72);

    const rearCap = scene.add.circle(-27, -9, 29, 0x2c2551, 1)
      .setStrokeStyle(5, 0xb77f37, 1);
    const barrel = scene.add.rectangle(-1, -9, 83, 52, 0x292955, 1)
      .setStrokeStyle(4, 0xc68f3f, 1);
    const barrelBandA = scene.add.rectangle(-24, -9, 8, 58, 0xb47b36, 1);
    const barrelBandB = scene.add.rectangle(11, -9, 8, 58, 0xd1a04d, 1);

    this.lensRotor = scene.add.container(26, -6);
    const rotorRing = scene.add.circle(0, 0, 33, 0x0f172a, 0)
      .setStrokeStyle(3, 0xf1c969, 0.78);
    this.lensRotor.add(rotorRing);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const jewel = scene.add
        .circle(Math.cos(angle) * 29, Math.sin(angle) * 29, index % 2 ? 2.6 : 3.4, 0x8b5cf6, 0.92)
        .setStrokeStyle(1, 0xffefae, 0.72);
      this.lensRotor.add(jewel);
    }

    const lensRim = scene.add.circle(26, -6, 31, 0xd3a44f, 1)
      .setStrokeStyle(4, 0x6f451e, 1);
    const lensGlass = scene.add.circle(26, -6, 23, 0xffefae, 0.95)
      .setStrokeStyle(3, 0xffc928, 0.95);

    this.halo = scene.add.circle(26, -6, 45, 0xffd33d, 0.16);
    this.bulb = lensGlass;
    this.lensSheen = scene.add.ellipse(18, -14, 13, 6, 0xffffff, 0.52).setAngle(-24);

    const boltTop = scene.add.circle(-4, -35, 4, 0xf2d27a, 1);
    const boltBottom = scene.add.circle(-4, 17, 4, 0xf2d27a, 1);

    this.statusGlow = scene.add.circle(-4, 116, 39, 0x60a5fa, 0.04)
      .setStrokeStyle(2, 0x60a5fa, 0.28);

    // Child-friendly switch, visually integrated into the lamp pedestal.
    this.switchPad = scene.add
      .circle(-4, 116, 31, 0x1e3a68, 1)
      .setStrokeStyle(4, 0xd0a14a, 1)
      .setInteractive({ useHandCursor: true });

    const powerGlyph = scene.add
      .text(-4, 112, '⏻', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#dbeafe'
      })
      .setOrigin(0.5);

    this.switchLabel = scene.add
      .text(-4, 149, 'ON', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fde68a',
        stroke: '#2b1b21',
        strokeThickness: 3
      })
      .setOrigin(0.5);

    this.switchPad.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.setEnabled(!this.enabled);
    });

    this.add([
      this.grabRing,
      standBack,
      standFront,
      base,
      baseInset,
      rearCap,
      barrel,
      barrelBandA,
      barrelBandB,
      this.halo,
      this.lensRotor,
      lensRim,
      this.bulb,
      this.lensSheen,
      boltTop,
      boltBottom,
      this.statusGlow,
      this.switchPad,
      powerGlyph,
      this.switchLabel
    ]);

    this.setSize(205, 255);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-102, -104, 205, 228),
      Phaser.Geom.Rectangle.Contains
    );
    scene.input.setDraggable(this);
    scene.add.existing(this);

    this.startAmbientMotion();
  }

  public getEmitterPoint(): { x: number; y: number } {
    return { x: this.x + 26, y: this.y - 6 };
  }

  public setGrabbed(active: boolean): void {
    this.grabRing.setVisible(active);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scaleX: active ? 1.04 : 1,
      scaleY: active ? 1.04 : 1,
      angle: active ? -1.1 : 0,
      duration: active ? 100 : 210,
      ease: active ? 'Sine.Out' : 'Back.Out'
    });
  }

  public noteDragged(deltaX: number): void {
    this.lensRotor.angle += Phaser.Math.Clamp(deltaX * 0.75, -9, 9);
  }

  public playIdleInvitation(): void {
    this.scene.tweens.killTweensOf(this.grabRing);
    this.grabRing
      .setVisible(true)
      .setPosition(-9, 4)
      .setAlpha(0.14)
      .setScale(0.92);

    this.scene.tweens.add({
      targets: this.grabRing,
      x: 9,
      alpha: { from: 0.14, to: 0.78 },
      scaleX: { from: 0.92, to: 1.12 },
      scaleY: { from: 0.92, to: 1.12 },
      duration: 430,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.grabRing.setVisible(false).setPosition(0, 4).setAlpha(1).setScale(1);
      }
    });

    this.scene.tweens.killTweensOf(this.switchPad);
    this.scene.tweens.add({
      targets: this.switchPad,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 240,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.InOut'
    });
  }

  public stopIdleInvitation(): void {
    this.scene.tweens.killTweensOf(this.grabRing);
    this.grabRing.setVisible(false).setPosition(0, 4).setAlpha(1).setScale(1);
    this.scene.tweens.killTweensOf(this.switchPad);
    this.switchPad.setScale(1);
  }

  public setEnabled(next: boolean): void {
    if (next === this.enabled) return;

    this.enabled = next;
    this.halo.setVisible(true);
    this.bulb.setFillStyle(next ? 0xfde68a : 0x1f2937, 1);
    this.bulb.setStrokeStyle(3, next ? 0xfacc15 : 0x475569);
    this.switchPad.setStrokeStyle(3, next ? 0xfacc15 : 0x475569, next ? 0.9 : 0.85);
    this.switchLabel.setText(next ? 'ON' : 'OFF');
    this.switchLabel.setColor(next ? '#fde68a' : '#94a3b8');
    this.lensSheen.setVisible(next);

    this.scene.tweens.killTweensOf([this.halo, this.statusGlow]);
    this.scene.tweens.add({
      targets: this.halo,
      alpha: next ? 0.22 : 0.02,
      scaleX: next ? 1.12 : 0.92,
      scaleY: next ? 1.12 : 0.92,
      duration: 240,
      ease: 'Sine.Out'
    });
    this.scene.tweens.add({
      targets: this.statusGlow,
      alpha: next ? 0.68 : 0.12,
      scaleX: next ? 1.08 : 0.96,
      scaleY: next ? 1.08 : 0.96,
      duration: 260,
      ease: 'Sine.Out'
    });

    this.emit('light-toggled', next);
  }

  private startAmbientMotion(): void {
    this.scene.tweens.add({
      targets: this.lensRotor,
      angle: 360,
      duration: 12000,
      repeat: -1,
      ease: 'Linear'
    });

    this.scene.tweens.add({
      targets: this.halo,
      scaleX: { from: 0.96, to: 1.08 },
      scaleY: { from: 0.96, to: 1.08 },
      alpha: { from: 0.11, to: 0.21 },
      duration: 1250,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    this.scene.tweens.add({
      targets: this.lensSheen,
      x: { from: 13, to: 27 },
      y: { from: -17, to: -8 },
      alpha: { from: 0.15, to: 0.72 },
      duration: 1650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }
}
