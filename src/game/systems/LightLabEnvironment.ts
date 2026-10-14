import Phaser from 'phaser';

/**
 * P1.2A production environment layer for the Light Lab.
 *
 * Gameplay objects remain independent. This class owns only atmosphere,
 * depth, scenic animation and world dressing so optics and input geometry stay
 * stable while the room gains a much more finished visual language.
 */
export class LightLabEnvironment {
  private readonly screenGlow: Phaser.GameObjects.Rectangle;
  private readonly ambientWarmth: Phaser.GameObjects.Rectangle;
  private readonly coolVeil: Phaser.GameObjects.Rectangle;
  private readonly scenicPlate: Phaser.GameObjects.Image;
  private readonly dust: Phaser.GameObjects.Arc[] = [];
  private readonly twinkles: Phaser.GameObjects.Arc[] = [];
  private readonly brassOrbit: Phaser.GameObjects.Container;
  private readonly dockGlow: Phaser.GameObjects.Arc;
  private secretTriggered = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly wallBounds: Phaser.Geom.Rectangle,
    private readonly wallX: number,
    private readonly floorY: number
  ) {
    this.scenicPlate = this.createBackdrop();
    this.createExperimentFloor();
    this.createProjectionWall();
    this.brassOrbit = this.createLivingOrrery();
    this.dockGlow = this.createCompassDockGlow();
    this.createForegroundDepth();
    this.createAmbientDust();
    this.createLivingLabFx();

    this.coolVeil = scene.add
      .rectangle(640, 360, 1280, 720, 0x1e2d52, 0.03)
      .setDepth(0.87)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.ambientWarmth = scene.add
      .rectangle(640, 360, 1280, 720, 0xf59e0b, 0.028)
      .setDepth(0.88)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.screenGlow = scene.add
      .rectangle(
        wallBounds.centerX,
        wallBounds.centerY,
        wallBounds.width - 18,
        wallBounds.height - 18,
        0xfff4cf,
        0.055
      )
      .setDepth(0.95)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.startParallaxBreathing();
  }

  public setLightEnabled(enabled: boolean): void {
    this.scene.tweens.killTweensOf([this.screenGlow, this.ambientWarmth, this.coolVeil]);
    this.scene.tweens.add({
      targets: this.screenGlow,
      alpha: enabled ? 0.12 : 0.018,
      duration: 240,
      ease: 'Sine.Out'
    });
    this.scene.tweens.add({
      targets: this.ambientWarmth,
      alpha: enabled ? 0.055 : 0.012,
      duration: 280,
      ease: 'Sine.Out'
    });
    this.scene.tweens.add({
      targets: this.coolVeil,
      alpha: enabled ? 0.025 : 0.14,
      duration: 300,
      ease: 'Sine.Out'
    });

    for (const mote of this.dust) {
      mote.setVisible(enabled);
    }
  }

  public pulseDiscovery(): void {
    this.scene.tweens.killTweensOf([this.screenGlow, this.ambientWarmth, this.dockGlow]);
    this.scene.tweens.add({
      targets: this.ambientWarmth,
      alpha: 0.12,
      duration: 170,
      yoyo: true,
      ease: 'Sine.Out'
    });
    this.scene.tweens.add({
      targets: this.screenGlow,
      alpha: 0.22,
      duration: 190,
      yoyo: true,
      ease: 'Sine.Out'
    });
    this.scene.tweens.add({
      targets: this.dockGlow,
      alpha: 0.66,
      scaleX: 1.28,
      scaleY: 1.28,
      duration: 220,
      yoyo: true,
      ease: 'Back.Out'
    });

    for (let index = 0; index < 9; index += 1) {
      const glyph = this.scene.add
        .text(807 + (index % 3) * 14 - 14, 190 + (index % 2) * 10, '✦', {
          fontFamily: 'Arial, sans-serif',
          fontSize: `${12 + (index % 3) * 3}px`,
          color: index % 2 ? '#fde68a' : '#c4b5fd'
        })
        .setOrigin(0.5)
        .setDepth(6.8)
        .setAlpha(0.9);
      this.scene.tweens.add({
        targets: glyph,
        y: glyph.y - 30 - index * 2,
        x: glyph.x + (index - 4) * 5,
        alpha: 0,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 660,
        delay: index * 24,
        ease: 'Cubic.Out',
        onComplete: () => glyph.destroy()
      });
    }
  }

  public enableStarWindowSecret(onTriggered: () => void): void {
    const zone = this.scene.add
      .zone(630, 190, 190, 150)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(7.5);

    zone.on('pointerdown', () => {
      if (this.secretTriggered) return;
      this.secretTriggered = true;
      onTriggered();
      this.playShootingStar();
    });
  }

  private createBackdrop(): Phaser.GameObjects.Image {
    this.scene.add.rectangle(640, 360, 1280, 720, 0x0a0f20).setDepth(-20);

    const plate = this.scene.add
      .image(640, 228, 'light-lab-production-p12a')
      .setDisplaySize(1294, 430)
      .setDepth(-19.5)
      .setAlpha(0.99);

    // Smoothly blend the scenic plate into the interactive floor. The earlier
    // prototype used two hard bands; this stepped gradient removes that visual
    // seam and keeps the room feeling like one place.
    const gradientSteps = 12;
    for (let index = 0; index < gradientSteps; index += 1) {
      const t = index / (gradientSteps - 1);
      const y = 378 + index * 11;
      const alpha = 0.08 + t * 0.56;
      this.scene.add
        .rectangle(640, y, 1280, 14, 0x211722, alpha)
        .setDepth(-18.7 + index * 0.001);
    }

    this.scene.add.rectangle(640, 67, 1280, 4, 0xd29a45, 0.46).setDepth(-18.4);
    return plate;
  }

  private createExperimentFloor(): void {
    const floorTop = 476;

    // Warm planks with less flat repetition than the prototype floor.
    for (let y = floorTop, row = 0; y < 720; y += 31, row += 1) {
      const color = row % 2 ? 0x382326 : 0x43292c;
      this.scene.add.rectangle(640, y, 1280, 29, color, 1).setDepth(-7);
      this.scene.add.rectangle(640, y + 14, 1280, 1, 0xc38445, 0.15).setDepth(-6.9);
    }

    // Perspective seams converge toward the experiment area and provide depth.
    const seams = this.scene.add.graphics().setDepth(-6.7);
    seams.lineStyle(2, 0x211416, 0.42);
    for (let x = 40; x <= 1240; x += 115) {
      const vanishingX = 640 + (x - 640) * 0.22;
      seams.lineBetween(x, 720, vanishingX, floorTop);
    }

    // Specular floor highlights from warm lab fixtures.
    const floorGlow = this.scene.add
      .ellipse(440, 585, 520, 90, 0xf3b64d, 0.04)
      .setDepth(-6.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: floorGlow,
      alpha: { from: 0.025, to: 0.075 },
      scaleX: { from: 0.96, to: 1.04 },
      duration: 2800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    // Brass experiment track: same gameplay geometry, upgraded visual language.
    this.scene.add.rectangle(640, this.floorY + 5, 1280, 13, 0x35261f, 1).setDepth(-5);
    this.scene.add.rectangle(640, this.floorY + 2, 1280, 3, 0xd4a64e, 0.88).setDepth(-4.9);
    this.scene.add.rectangle(640, this.floorY + 10, 1280, 2, 0x6d4b2b, 0.9).setDepth(-4.9);

    // Quip experiment pad at the exact existing starting location.
    const padX = 650;
    const padY = 526;
    const padGlow = this.scene.add.circle(padX, padY, 97, 0x8b5cf6, 0.025)
      .setDepth(-3.9)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.add.circle(padX, padY, 92, 0x171a2f, 0.52)
      .setStrokeStyle(5, 0xc89b46, 0.86)
      .setDepth(-3.8);
    this.scene.add.circle(padX, padY, 72, 0x312e81, 0.24)
      .setStrokeStyle(4, 0x8b5cf6, 0.86)
      .setDepth(-3.7);
    this.scene.add.circle(padX, padY, 51, 0x1d4ed8, 0.08)
      .setStrokeStyle(2, 0x60a5fa, 0.55)
      .setDepth(-3.6);

    this.scene.tweens.add({
      targets: padGlow,
      alpha: { from: 0.03, to: 0.14 },
      scaleX: { from: 0.94, to: 1.08 },
      scaleY: { from: 0.94, to: 1.08 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12;
      const x1 = padX + Math.cos(angle) * 76;
      const y1 = padY + Math.sin(angle) * 76;
      const x2 = padX + Math.cos(angle) * 86;
      const y2 = padY + Math.sin(angle) * 86;
      const tick = this.scene.add.graphics().setDepth(-3.5);
      tick.lineStyle(index % 3 === 0 ? 3 : 2, index % 3 === 0 ? 0xf4d06f : 0x8b5cf6, 0.72);
      tick.lineBetween(x1, y1, x2, y2);
    }
  }

  private createProjectionWall(): void {
    const outer = new Phaser.Geom.Rectangle(
      this.wallBounds.x - 20,
      this.wallBounds.y - 20,
      this.wallBounds.width + 40,
      this.wallBounds.height + 40
    );

    const frameGlow = this.scene.add
      .rectangle(outer.centerX, outer.centerY, outer.width + 12, outer.height + 12, 0x8b5cf6, 0.035)
      .setDepth(0.15)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: frameGlow,
      alpha: { from: 0.02, to: 0.10 },
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    this.scene.add.rectangle(outer.centerX, outer.centerY, outer.width, outer.height, 0x2b2140, 1)
      .setStrokeStyle(11, 0xc99a48, 0.95)
      .setDepth(0.2);
    this.scene.add.rectangle(outer.centerX, outer.centerY, outer.width - 17, outer.height - 17, 0x3f2a61, 1)
      .setStrokeStyle(4, 0x8b5cf6, 0.9)
      .setDepth(0.3);
    this.scene.add.rectangle(
      this.wallBounds.centerX,
      this.wallBounds.centerY,
      this.wallBounds.width,
      this.wallBounds.height,
      0xf4ead2,
      0.99
    )
      .setStrokeStyle(3, 0xd8c79d, 0.85)
      .setDepth(0.45);

    const grid = this.scene.add.graphics().setDepth(0.5);
    grid.lineStyle(1, 0x9a8c72, 0.10);
    for (let x = this.wallBounds.x + 25; x < this.wallBounds.right; x += 50) {
      grid.lineBetween(x, this.wallBounds.y + 8, x, this.wallBounds.bottom - 8);
    }
    for (let y = this.wallBounds.y + 30; y < this.wallBounds.bottom; y += 55) {
      grid.lineBetween(this.wallBounds.x + 8, y, this.wallBounds.right - 8, y);
    }

    for (const [x, y] of [
      [outer.left + 7, outer.top + 7],
      [outer.right - 7, outer.top + 7],
      [outer.left + 7, outer.bottom - 7],
      [outer.right - 7, outer.bottom - 7]
    ]) {
      this.scene.add.circle(x, y, 10, 0xd0a14a, 1)
        .setStrokeStyle(2, 0x6d471f, 1)
        .setDepth(0.6);
    }

    this.scene.add.text(this.wallX, 91, 'OBSERVATION SCREEN', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ead7a2',
      letterSpacing: 1.2
    }).setOrigin(0.5).setDepth(0.7);
  }

  private createLivingOrrery(): Phaser.GameObjects.Container {
    const orrery = this.scene.add.container(150, 165).setDepth(-8.3);
    const ringA = this.scene.add.circle(0, 0, 48, 0x0f172a, 0)
      .setStrokeStyle(2, 0xc99345, 0.42);
    const ringB = this.scene.add.circle(0, 0, 34, 0x0f172a, 0)
      .setStrokeStyle(2, 0x8b5cf6, 0.34);
    const core = this.scene.add.circle(0, 0, 8, 0x60a5fa, 0.52)
      .setStrokeStyle(2, 0xffe69a, 0.55);
    const planet = this.scene.add.circle(42, 0, 5, 0xf6d365, 0.78);
    orrery.add([ringA, ringB, core, planet]);
    this.scene.tweens.add({
      targets: orrery,
      angle: 360,
      duration: 18000,
      repeat: -1,
      ease: 'Linear'
    });
    return orrery;
  }

  private createCompassDockGlow(): Phaser.GameObjects.Arc {
    const glow = this.scene.add
      .circle(807, 190, 48, 0x8b5cf6, 0.04)
      .setStrokeStyle(2, 0xd6ad54, 0.24)
      .setDepth(-8.2);
    this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.03, to: 0.18 },
      scaleX: { from: 0.96, to: 1.10 },
      scaleY: { from: 0.96, to: 1.10 },
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
    return glow;
  }

  private createForegroundDepth(): void {
    // P1.2B cleanup: replace the old opaque corner blocks with low-profile
    // brass consoles so the safe-frame edges feel intentional rather than
    // like unfinished clipping masks.
    const makeConsole = (x: number, width: number, dialColor: number) => {
      const panel = this.scene.add.graphics().setDepth(6);
      panel.fillStyle(0x17131d, 0.78);
      panel.fillRoundedRect(x - width / 2, 688, width, 28, 12);
      panel.lineStyle(2, 0x8b642f, 0.62);
      panel.strokeRoundedRect(x - width / 2, 688, width, 28, 12);
      panel.lineStyle(1, 0xd4a64e, 0.28);
      panel.lineBetween(x - width / 2 + 14, 693, x + width / 2 - 14, 693);

      const dial = this.scene.add
        .circle(x, 690, 18, dialColor, 0.72)
        .setStrokeStyle(3, 0xd4a64e, 0.48)
        .setDepth(6.2);
      const core = this.scene.add
        .circle(x, 690, 7, 0x0f172a, 0.84)
        .setStrokeStyle(1, 0xfde68a, 0.35)
        .setDepth(6.3);

      this.scene.tweens.add({
        targets: dial,
        alpha: { from: 0.56, to: 0.9 },
        duration: 2600 + x,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
      void core;
    };

    makeConsole(74, 126, 0x312e81);
    makeConsole(1202, 132, 0x1d4ed8);
  }

  private createAmbientDust(): void {
    const motes = [
      [340, 360, 2], [392, 402, 1.5], [452, 333, 2.4], [510, 387, 1.7],
      [576, 355, 2.1], [725, 330, 1.8], [770, 370, 1.5], [860, 342, 2]
    ];
    for (const [x, y, r] of motes) {
      const mote = this.scene.add.circle(x, y, r, 0xffe9a3, 0.42).setDepth(4.6);
      this.scene.tweens.add({
        targets: mote,
        y: y - 24,
        x: x + 8,
        alpha: { from: 0.14, to: 0.62 },
        duration: 2100 + x,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
      this.dust.push(mote);
    }
  }

  private createLivingLabFx(): void {
    const stars = [
      [575, 145, 2.2], [615, 170, 1.6], [651, 143, 1.9], [687, 183, 2.3],
      [620, 215, 1.4], [550, 205, 1.5], [700, 128, 1.2]
    ];
    stars.forEach(([x, y, radius], index) => {
      const star = this.scene.add.circle(x, y, radius, 0xe0f2fe, 0.35).setDepth(-8.8);
      this.scene.tweens.add({
        targets: star,
        alpha: { from: 0.18, to: 0.95 },
        scaleX: { from: 0.8, to: 1.55 },
        scaleY: { from: 0.8, to: 1.55 },
        duration: 900 + index * 180,
        yoyo: true,
        repeat: -1,
        delay: index * 170,
        ease: 'Sine.InOut'
      });
      this.twinkles.push(star);
    });

    const gaugeNeedle = this.scene.add
      .rectangle(902, 251, 28, 2, 0xfde68a, 0.72)
      .setOrigin(0, 0.5)
      .setDepth(-8.5)
      .setAngle(-18);
    this.scene.tweens.add({
      targets: gaugeNeedle,
      angle: 20,
      duration: 2300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  private startParallaxBreathing(): void {
    this.scene.tweens.add({
      targets: this.scenicPlate,
      x: { from: 637, to: 643 },
      y: { from: 226, to: 230 },
      scaleX: { from: this.scenicPlate.scaleX * 1.002, to: this.scenicPlate.scaleX * 1.008 },
      scaleY: { from: this.scenicPlate.scaleY * 1.002, to: this.scenicPlate.scaleY * 1.008 },
      duration: 12000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });

    this.scene.tweens.add({
      targets: this.brassOrbit,
      scaleX: { from: 0.98, to: 1.03 },
      scaleY: { from: 0.98, to: 1.03 },
      duration: 4200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  private playShootingStar(): void {
    const star = this.scene.add
      .text(554, 134, '✦', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#fff7d6'
      })
      .setOrigin(0.5)
      .setDepth(8.2);
    const trail = this.scene.add.graphics().setDepth(8.1).setAlpha(0.72);
    trail.lineStyle(3, 0x93c5fd, 0.7);
    trail.lineBetween(548, 140, 598, 180);

    this.scene.tweens.add({
      targets: star,
      x: 704,
      y: 232,
      scaleX: 1.7,
      scaleY: 1.7,
      duration: 620,
      ease: 'Cubic.In',
      onComplete: () => {
        star.destroy();
        trail.destroy();
      }
    });
    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 620,
      ease: 'Sine.In'
    });
  }
}
