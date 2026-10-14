import Phaser from 'phaser';
import { shouldReduceMotion } from '../settings/GameSettingsStore';

export type WorldInteractionId =
  | 'star_window'
  | 'prism'
  | 'telescope'
  | 'question_jar'
  | 'brass_dial'
  | 'pressure_plate'
  | 'quip_tap';

export type WorldInteractionEvent = {
  id: WorldInteractionId;
  firstTime: boolean;
  secret: boolean;
  reaction: 'joy' | 'surprised' | 'skeptical';
  quipCopy: string;
  rewardCopy: string;
  x: number;
  y: number;
};

type BlockerState = {
  x: number;
  y: number;
  visible: boolean;
};

/**
 * P1.2B optional-world layer.
 *
 * These interactions are deliberately outside the mission state machine. They
 * reward curiosity without letting optional taps skip required science beats.
 */
export class InteractiveWorldSystem {
  private readonly discovered = new Set<WorldInteractionId>();
  private readonly secretsFound = new Set<WorldInteractionId>();
  private readonly reducedMotion: boolean;
  private readonly pressurePlate: Phaser.GameObjects.Container;
  private readonly secretBadge: Phaser.GameObjects.Container;
  private readonly secretBadgeText: Phaser.GameObjects.Text;
  private questionIndex = 0;
  private quipTapCount = 0;
  private pressurePlateTriggered = false;
  private dialPhase = 0;

  private readonly questions = [
    'CAN A SHADOW HAVE A COLOR?',
    'WHAT IF THERE WERE TWO LIGHTS?',
    'DO SHADOWS EXIST IN SPACE?',
    'CAN SOMETHING TRANSPARENT MAKE A SHADOW?',
    'WHAT WOULD QUIP LOOK LIKE ON THE MOON?'
  ];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onInteraction: (event: WorldInteractionEvent) => void
  ) {
    this.reducedMotion = shouldReduceMotion();

    this.createTelescope();
    this.createPrism();
    this.createQuestionJar();
    this.createBrassDial();
    this.createStarWindowZone();
    this.pressurePlate = this.createPressurePlate();

    const badgePlate = scene.add
      .rectangle(0, 0, 158, 34, 0x171a2f, 0.92)
      .setStrokeStyle(2, 0xd6ad54, 0.75);
    this.secretBadgeText = scene.add
      .text(0, 0, '✦ LAB SECRETS  0/5', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#f8e7a6',
        letterSpacing: 0.6
      })
      .setOrigin(0.5);
    this.secretBadge = scene.add
      .container(184, 92, [badgePlate, this.secretBadgeText])
      .setDepth(850)
      .setVisible(false)
      .setAlpha(0);
  }

  public update(blocker: BlockerState): void {
    this.pressurePlate.setAlpha(blocker.visible ? 0.56 : 0.16);
    if (!blocker.visible || this.pressurePlateTriggered) return;

    const distance = Phaser.Math.Distance.Between(
      blocker.x,
      blocker.y,
      this.pressurePlate.x,
      this.pressurePlate.y
    );
    if (distance > 72) return;

    this.pressurePlateTriggered = true;
    this.animatePressurePlateSecret();
    this.trigger({
      id: 'pressure_plate',
      secret: true,
      reaction: 'surprised',
      quipCopy: 'WAIT...\nTHE FLOOR HAS SECRETS?!',
      rewardCopy: 'SECRET DRAWER FOUND!  ✦',
      x: this.pressurePlate.x,
      y: this.pressurePlate.y - 24
    });
  }

  public handleQuipTap(): void {
    this.quipTapCount += 1;

    if (this.quipTapCount === 1) {
      this.trigger({
        id: 'quip_tap',
        secret: false,
        reaction: 'skeptical',
        quipCopy: 'YES?\nI AM VERY BUSY SCIENCING.',
        rewardCopy: '',
        x: 650,
        y: 430
      });
      return;
    }

    if (this.quipTapCount === 2) {
      this.trigger({
        id: 'quip_tap',
        secret: false,
        reaction: 'surprised',
        quipCopy: 'AGAIN?\nIS THIS AN EXPERIMENT?',
        rewardCopy: '',
        x: 650,
        y: 430
      });
      return;
    }

    if (this.quipTapCount === 3) {
      this.trigger({
        id: 'quip_tap',
        secret: true,
        reaction: 'joy',
        quipCopy: 'FINE!\nYOU FOUND THE QUIP BUTTON!',
        rewardCopy: 'SECRET: QUIP BUTTON!  ✦',
        x: 650,
        y: 430
      });
      this.spawnQuipConfetti();
      return;
    }

    const copies = [
      'BOOP.',
      'THIS IS NOW\nPEER-REVIEWED BOOPING.',
      'I AM TAKING NOTES.'
    ];
    const copy = copies[(this.quipTapCount - 4) % copies.length];
    this.trigger({
      id: 'quip_tap',
      secret: false,
      reaction: 'joy',
      quipCopy: copy,
      rewardCopy: '',
      x: 650,
      y: 430
    });
  }

  private createTelescope(): void {
    const root = this.scene.add.container(728, 378).setDepth(9.2);
    const aura = this.scene.add
      .circle(0, 0, 46, 0x60a5fa, 0.035)
      .setStrokeStyle(2, 0x93c5fd, 0.18)
      .setBlendMode(Phaser.BlendModes.ADD);
    const contactShadow = this.scene.add
      .ellipse(0, 52, 92, 18, 0x090b16, 0.34)
      .setScale(1, 0.72);
    const brassFoot = this.scene.add
      .ellipse(0, 49, 70, 11, 0x4a2f18, 0.42)
      .setStrokeStyle(1.5, 0xd4a64e, 0.46);
    const telescope = this.scene.add
      .image(0, 4, 'prop-telescope-p12bhf1')
      .setDisplaySize(100, 125)
      .setOrigin(0.5, 0.58);
    const lensGlow = this.scene.add
      .circle(27, -31, 10, 0x60a5fa, 0.16)
      .setStrokeStyle(2, 0xdff6ff, 0.65)
      .setBlendMode(Phaser.BlendModes.ADD);
    const lensCore = this.scene.add
      .circle(27, -31, 4, 0xe0f2fe, 0.78)
      .setBlendMode(Phaser.BlendModes.ADD);
    root.add([contactShadow, brassFoot, aura, telescope, lensGlow, lensCore]);

    const zone = this.scene.add
      .zone(728, 382, 126, 136)
      .setInteractive({ useHandCursor: true })
      .setDepth(9.8);

    this.breatheSprite(aura, 1.12, 1800);
    this.bindPropHover(zone, root, aura);
    if (!this.reducedMotion) {
      this.scene.tweens.add({
        targets: telescope,
        angle: { from: -1.2, to: 1.2 },
        y: { from: 2, to: 5 },
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
      this.scene.tweens.add({
        targets: [lensGlow, lensCore],
        alpha: { from: 0.22, to: 0.92 },
        scaleX: { from: 0.82, to: 1.24 },
        scaleY: { from: 0.82, to: 1.24 },
        duration: 1250,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
    }

    zone.on('pointerdown', () => {
      this.scene.tweens.killTweensOf(root);
      if (!this.reducedMotion) {
        this.scene.tweens.add({
          targets: root,
          y: 371,
          scaleX: 1.08,
          scaleY: 1.08,
          duration: 130,
          yoyo: true,
          ease: 'Back.Out',
          onComplete: () => root.setPosition(728, 378).setScale(1)
        });
        this.scene.tweens.add({
          targets: telescope,
          angle: -9,
          duration: 240,
          yoyo: true,
          hold: 120,
          ease: 'Sine.InOut'
        });
        this.scene.tweens.add({
          targets: lensGlow,
          alpha: 1,
          scaleX: 2.1,
          scaleY: 2.1,
          duration: 160,
          yoyo: true,
          repeat: 1,
          ease: 'Cubic.Out'
        });
      }
      this.playTelescopeScan();
      this.playConstellationReveal();
      this.trigger({
        id: 'telescope',
        secret: true,
        reaction: 'joy',
        quipCopy: 'I FOUND A CONSTELLATION!\n...OR A SANDWICH.',
        rewardCopy: 'CONSTELLATION FOUND!  ✦',
        x: 728,
        y: 347
      });
    });
  }

  private createPrism(): void {
    const root = this.scene.add.container(874, 407).setDepth(9.15);
    const aura = this.scene.add
      .circle(0, 0, 42, 0x8b5cf6, 0.035)
      .setStrokeStyle(2, 0xc4b5fd, 0.22)
      .setBlendMode(Phaser.BlendModes.ADD);
    const contactShadow = this.scene.add
      .ellipse(0, 42, 62, 14, 0x090b16, 0.30);
    const brassBase = this.scene.add
      .ellipse(0, 38, 54, 10, 0x5a3b1b, 0.48)
      .setStrokeStyle(1.5, 0xd6ad54, 0.58);
    const rainbowSpill = this.scene.add
      .ellipse(0, 35, 72, 18, 0x8b5cf6, 0.10)
      .setBlendMode(Phaser.BlendModes.ADD);
    const prism = this.scene.add
      .image(0, 0, 'prop-prism-p12bhf1')
      .setDisplaySize(72, 96)
      .setOrigin(0.5, 0.58);
    const prismBaseScaleX = prism.scaleX;
    const prismBaseScaleY = prism.scaleY;
    const sparkleA = this.scene.add
      .text(-24, -28, '✦', { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#fff7d6' })
      .setOrigin(0.5)
      .setAlpha(0.75)
      .setBlendMode(Phaser.BlendModes.ADD);
    const sparkleB = this.scene.add
      .text(25, 12, '✦', { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#c4b5fd' })
      .setOrigin(0.5)
      .setAlpha(0.65)
      .setBlendMode(Phaser.BlendModes.ADD);
    root.add([contactShadow, brassBase, rainbowSpill, aura, prism, sparkleA, sparkleB]);

    const zone = this.scene.add
      .zone(874, 408, 110, 118)
      .setInteractive({ useHandCursor: true })
      .setDepth(9.8);

    this.breatheSprite(aura, 1.16, 1700);
    this.pulseProp(rainbowSpill, 1.10, 1450);
    this.bindPropHover(zone, root, aura);
    if (!this.reducedMotion) {
      this.scene.tweens.add({
        targets: [sparkleA, sparkleB],
        alpha: { from: 0.25, to: 0.95 },
        scaleX: { from: 0.8, to: 1.2 },
        scaleY: { from: 0.8, to: 1.2 },
        duration: 980,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
    }

    zone.on('pointerdown', () => {
      this.scene.tweens.killTweensOf(root);
      this.scene.tweens.killTweensOf(prism);
      this.scene.tweens.killTweensOf(rainbowSpill);
      prism.setAngle(0).setScale(prismBaseScaleX, prismBaseScaleY);
      rainbowSpill.setScale(1).setAlpha(0.10);
      if (!this.reducedMotion) {
        this.scene.tweens.add({
          targets: root,
          y: 398,
          scaleX: 1.09,
          scaleY: 1.09,
          duration: 130,
          yoyo: true,
          ease: 'Back.Out',
          onComplete: () => root.setPosition(874, 407).setScale(1)
        });
        this.scene.tweens.add({
          targets: prism,
          angle: { from: -10, to: 10 },
          scaleX: prismBaseScaleX * 1.08,
          scaleY: prismBaseScaleY * 1.08,
          duration: 145,
          yoyo: true,
          repeat: 3,
          ease: 'Sine.InOut',
          onComplete: () => prism.setAngle(0).setScale(prismBaseScaleX, prismBaseScaleY)
        });
        this.scene.tweens.add({
          targets: rainbowSpill,
          alpha: 0.78,
          scaleX: 2.05,
          scaleY: 1.55,
          duration: 280,
          yoyo: true,
          hold: 300,
          ease: 'Cubic.Out',
          onComplete: () => rainbowSpill.setScale(1).setAlpha(0.10)
        });
      }
      this.playRainbowReveal();
      this.playPrismLightDance(874, 382);
      this.playPrismSparkBurst(874, 382);
      this.trigger({
        id: 'prism',
        secret: true,
        reaction: 'surprised',
        quipCopy: 'LIGHT IS\nSHOWING OFF!',
        rewardCopy: 'RAINBOW DISCOVERED!  ✦',
        x: 874,
        y: 386
      });
    });
  }

  private createQuestionJar(): void {
    const root = this.scene.add.container(592, 392).setDepth(9.18);
    const aura = this.scene.add
      .circle(0, 0, 45, 0x38bdf8, 0.035)
      .setStrokeStyle(2, 0x93c5fd, 0.20)
      .setBlendMode(Phaser.BlendModes.ADD);
    const contactShadow = this.scene.add
      .ellipse(0, 48, 70, 15, 0x090b16, 0.32);
    const glassSpill = this.scene.add
      .ellipse(0, 44, 62, 16, 0x38bdf8, 0.11)
      .setBlendMode(Phaser.BlendModes.ADD);
    const brassRest = this.scene.add
      .ellipse(0, 43, 54, 9, 0x5a3b1b, 0.40)
      .setStrokeStyle(1.5, 0xd6ad54, 0.50);
    const jar = this.scene.add
      .image(0, 2, 'prop-question-jar-p12bhf1')
      .setDisplaySize(78, 98)
      .setOrigin(0.5, 0.56);
    const jarBaseScaleX = jar.scaleX;
    const jarBaseScaleY = jar.scaleY;
    const moteA = this.scene.add.circle(-18, -8, 2.5, 0xfde68a, 0.9).setBlendMode(Phaser.BlendModes.ADD);
    const moteB = this.scene.add.circle(19, 3, 2.2, 0x93c5fd, 0.9).setBlendMode(Phaser.BlendModes.ADD);
    root.add([contactShadow, glassSpill, brassRest, aura, jar, moteA, moteB]);

    const zone = this.scene.add
      .zone(592, 392, 112, 122)
      .setInteractive({ useHandCursor: true })
      .setDepth(9.8);

    this.breatheSprite(aura, 1.14, 1850);
    this.pulseProp(glassSpill, 1.08, 1700);
    this.bindPropHover(zone, root, aura);
    if (!this.reducedMotion) {
      this.scene.tweens.add({
        targets: moteA,
        x: { from: -18, to: 12 },
        y: { from: 6, to: -26 },
        alpha: { from: 0.25, to: 1 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
      this.scene.tweens.add({
        targets: moteB,
        x: { from: 18, to: -10 },
        y: { from: 12, to: -20 },
        alpha: { from: 0.25, to: 0.9 },
        duration: 1850,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
    }

    zone.on('pointerdown', () => {
      this.scene.tweens.killTweensOf(root);
      this.scene.tweens.killTweensOf(jar);
      this.scene.tweens.killTweensOf(glassSpill);
      jar.setScale(jarBaseScaleX, jarBaseScaleY);
      glassSpill.setScale(1).setAlpha(0.11);
      if (!this.reducedMotion) {
        this.scene.tweens.add({
          targets: root,
          angle: { from: -6, to: 6 },
          y: { from: 392, to: 385 },
          duration: 72,
          yoyo: true,
          repeat: 4,
          ease: 'Sine.InOut',
          onComplete: () => root.setAngle(0).setPosition(592, 392)
        });
        this.scene.tweens.add({
          targets: jar,
          scaleX: jarBaseScaleX * 1.10,
          scaleY: jarBaseScaleY * 0.93,
          duration: 110,
          yoyo: true,
          repeat: 1,
          ease: 'Back.Out',
          onComplete: () => jar.setScale(jarBaseScaleX, jarBaseScaleY)
        });
        this.scene.tweens.add({
          targets: glassSpill,
          alpha: 0.62,
          scaleX: 1.45,
          scaleY: 1.28,
          duration: 240,
          yoyo: true,
          hold: 180,
          ease: 'Cubic.Out',
          onComplete: () => glassSpill.setScale(1).setAlpha(0.11)
        });
      }
      const question = this.questions[this.questionIndex % this.questions.length];
      this.playQuestionJarRelease(question);
      this.showQuestionCard(question);
      this.questionIndex += 1;
      this.trigger({
        id: 'question_jar',
        secret: this.questionIndex === 1,
        reaction: 'joy',
        quipCopy: this.questionIndex === 1
          ? 'OOOH.\nTHAT IS A GOOD QUESTION.'
          : 'ANOTHER ONE!\nKEEP THEM COMING.',
        rewardCopy: 'QUESTION JAR OPENED!  ✦',
        x: 592,
        y: 358
      });
    });
  }

  private createBrassDial(): void {
    const root = this.scene.add.container(468, 376).setDepth(9.16);
    const aura = this.scene.add
      .circle(0, 0, 50, 0x8b5cf6, 0.035)
      .setStrokeStyle(2, 0xd4a64e, 0.20)
      .setBlendMode(Phaser.BlendModes.ADD);
    const contactShadow = this.scene.add
      .ellipse(0, 55, 86, 16, 0x090b16, 0.34);
    const pedestalFoot = this.scene.add
      .ellipse(0, 51, 74, 13, 0x3f2a18, 0.75)
      .setStrokeStyle(2, 0xd6ad54, 0.72);
    const pedestalStem = this.scene.add
      .rectangle(0, 40, 32, 24, 0x40245f, 0.92)
      .setStrokeStyle(2, 0xd6ad54, 0.70);
    const pedestalCollar = this.scene.add
      .ellipse(0, 29, 48, 10, 0x5a3b1b, 0.78)
      .setStrokeStyle(1.5, 0xf0c96a, 0.74);
    const dial = this.scene.add
      .image(0, -6, 'prop-brass-dial-p12bhf1')
      .setDisplaySize(102, 102)
      .setOrigin(0.5);
    // setDisplaySize() establishes a non-1 native scale for this large source art.
    // Preserve it so interaction tweens always return to the authored display size.
    const dialBaseScaleX = dial.scaleX;
    const dialBaseScaleY = dial.scaleY;
    const energyRing = this.scene.add
      .circle(0, -1, 31, 0x000000, 0)
      .setStrokeStyle(2, 0xc4b5fd, 0.58)
      .setBlendMode(Phaser.BlendModes.ADD);
    const centerPulse = this.scene.add
      .circle(0, -6, 18, 0x8b5cf6, 0.05)
      .setBlendMode(Phaser.BlendModes.ADD);
    root.add([contactShadow, pedestalFoot, pedestalStem, pedestalCollar, aura, dial, energyRing, centerPulse]);

    const zone = this.scene.add
      .zone(468, 376, 126, 136)
      .setInteractive({ useHandCursor: true })
      .setDepth(9.8);

    this.breatheSprite(aura, 1.12, 2000);
    this.bindPropHover(zone, root, aura);
    if (!this.reducedMotion) {
      this.scene.tweens.add({
        targets: energyRing,
        angle: 360,
        duration: 5200,
        repeat: -1,
        ease: 'Linear'
      });
      this.scene.tweens.add({
        targets: [energyRing, centerPulse],
        alpha: { from: 0.30, to: 0.88 },
        scaleX: { from: 0.94, to: 1.08 },
        scaleY: { from: 0.94, to: 1.08 },
        duration: 1300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });
    }

    zone.on('pointerdown', () => {
      this.dialPhase = (this.dialPhase + 1) % 4;
      this.scene.tweens.killTweensOf(dial);
      // Defensive reset prevents rapid/repeated taps from compounding scale.
      dial.setScale(dialBaseScaleX, dialBaseScaleY);
      if (!this.reducedMotion) {
        this.scene.tweens.add({
          targets: dial,
          angle: dial.angle + 90,
          scaleX: dialBaseScaleX * 1.08,
          scaleY: dialBaseScaleY * 1.08,
          duration: 480,
          ease: 'Back.Out',
          onComplete: () => dial.setScale(dialBaseScaleX, dialBaseScaleY)
        });
        this.scene.tweens.add({
          targets: energyRing,
          angle: energyRing.angle - 180,
          alpha: 1,
          scaleX: 1.32,
          scaleY: 1.32,
          duration: 360,
          yoyo: true,
          ease: 'Cubic.Out'
        });
      }
      this.playLabPulse(this.dialPhase);
      this.playDialEnergyWave(468, 370, this.dialPhase);
      this.trigger({
        id: 'brass_dial',
        secret: false,
        reaction: this.dialPhase % 2 === 0 ? 'joy' : 'skeptical',
        quipCopy: this.dialPhase === 0
          ? 'I HAVE NO IDEA\nWHAT THAT DID. PERFECT.'
          : 'I DEFINITELY\nMEANT TO DO THAT.',
        rewardCopy: '',
        x: 468,
        y: 344
      });
    });
  }

  private createStarWindowZone(): void {
    const zone = this.scene.add
      .zone(190, 205, 250, 245)
      .setInteractive({ useHandCursor: true })
      .setDepth(8.8);

    zone.on('pointerdown', () => {
      this.playShootingStar();
      this.trigger({
        id: 'star_window',
        secret: true,
        reaction: 'joy',
        quipCopy: 'DID YOU SEE THAT?!\nMAKE A QUESTION!',
        rewardCopy: 'SHOOTING STAR FOUND!  ✦',
        x: 210,
        y: 180
      });
    });
  }

  private bindPropHover(
    zone: Phaser.GameObjects.Zone,
    root: Phaser.GameObjects.Container,
    aura: Phaser.GameObjects.Arc
  ): void {
    zone.on('pointerover', () => {
      this.scene.tweens.killTweensOf(root);
      this.scene.tweens.add({
        targets: root,
        scaleX: 1.035,
        scaleY: 1.035,
        duration: this.reducedMotion ? 1 : 120,
        ease: 'Sine.Out'
      });
      aura.setAlpha(0.26);
    });
    zone.on('pointerout', () => {
      this.scene.tweens.killTweensOf(root);
      this.scene.tweens.add({
        targets: root,
        scaleX: 1,
        scaleY: 1,
        duration: this.reducedMotion ? 1 : 140,
        ease: 'Sine.Out'
      });
      aura.setAlpha(0.08);
    });
  }

  private playTelescopeScan(): void {
    const beam = this.scene.add.graphics().setDepth(12.55).setAlpha(0.92);
    beam.lineStyle(3, 0x93c5fd, 0.72);
    beam.lineBetween(755, 347, 355, 205);
    beam.lineStyle(1, 0xf8e7a6, 0.55);
    beam.lineBetween(755, 350, 350, 216);

    const reticle = this.scene.add
      .circle(350, 210, 24, 0x38bdf8, 0.035)
      .setStrokeStyle(2, 0xdff6ff, 0.82)
      .setDepth(12.6)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(this.reducedMotion ? 1 : 0.2);
    const glint = this.scene.add
      .text(755, 347, '✦', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#e0f2fe'
      })
      .setOrigin(0.5)
      .setDepth(12.65)
      .setBlendMode(Phaser.BlendModes.ADD);

    if (!this.reducedMotion) {
      this.scene.tweens.add({
        targets: reticle,
        scaleX: 1.25,
        scaleY: 1.25,
        angle: 90,
        duration: 420,
        ease: 'Back.Out'
      });
      this.scene.tweens.add({
        targets: glint,
        x: 350,
        y: 210,
        scaleX: 1.8,
        scaleY: 1.8,
        duration: 420,
        ease: 'Cubic.Out'
      });
    }

    this.scene.time.delayedCall(this.reducedMotion ? 500 : 850, () => {
      this.scene.tweens.add({
        targets: [beam, reticle, glint],
        alpha: 0,
        duration: 260,
        onComplete: () => {
          beam.destroy();
          reticle.destroy();
          glint.destroy();
        }
      });
    });
  }

  private playPrismLightDance(x: number, y: number): void {
    const colors = [0xef4444, 0xf59e0b, 0xfacc15, 0x22c55e, 0x38bdf8, 0x8b5cf6, 0xf472b6];
    colors.forEach((color, index) => {
      const ray = this.scene.add
        .rectangle(x, y, 108, 4, color, 0.72)
        .setOrigin(0, 0.5)
        .setDepth(13.25 + index * 0.01)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAngle(-22 + index * 6)
        .setScale(0.08, 1);

      this.scene.tweens.add({
        targets: ray,
        scaleX: 1.15,
        alpha: { from: 0.85, to: 0.18 },
        angle: -10 + index * 6,
        duration: this.reducedMotion ? 260 : 760,
        delay: index * 35,
        ease: 'Cubic.Out',
        onComplete: () => ray.destroy()
      });
    });

    if (!this.reducedMotion) {
      const orbit = this.scene.add
        .circle(x, y, 34, 0x000000, 0)
        .setStrokeStyle(3, 0xffffff, 0.55)
        .setDepth(13.35)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.45);
      this.scene.tweens.add({
        targets: orbit,
        scaleX: 1.8,
        scaleY: 1.8,
        angle: 180,
        alpha: 0,
        duration: 820,
        ease: 'Cubic.Out',
        onComplete: () => orbit.destroy()
      });
    }
  }

  private playPrismSparkBurst(x: number, y: number): void {
    const colors = [0xff6b6b, 0xfacc15, 0x4ade80, 0x38bdf8, 0xa78bfa, 0xf472b6];
    for (let index = 0; index < 12; index += 1) {
      const particle = this.scene.add
        .circle(x, y, 2.5 + (index % 2), colors[index % colors.length], 0.96)
        .setDepth(13.4)
        .setBlendMode(Phaser.BlendModes.ADD);
      const angle = (Math.PI * 2 * index) / 12;
      const distance = 32 + (index % 3) * 13;
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: this.reducedMotion ? 220 : 620,
        ease: 'Cubic.Out',
        onComplete: () => particle.destroy()
      });
    }
  }

  private playQuestionJarRelease(question: string): void {
    const glyphs = ['?', '✦', '?'];
    glyphs.forEach((glyph, index) => {
      const text = this.scene.add
        .text(592 + (index - 1) * 12, 352, glyph, {
          fontFamily: 'Arial, sans-serif',
          fontSize: index === 1 ? '17px' : '22px',
          fontStyle: 'bold',
          color: index === 1 ? '#fde68a' : '#dff6ff'
        })
        .setOrigin(0.5)
        .setDepth(13.2)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: text,
        x: 592 + (index - 1) * 34,
        y: 292 - index * 14,
        alpha: 0,
        angle: (index - 1) * 18,
        scaleX: 1.35,
        scaleY: 1.35,
        duration: this.reducedMotion ? 350 : 920,
        delay: index * 70,
        ease: 'Cubic.Out',
        onComplete: () => text.destroy()
      });
    });

    const ripple = this.scene.add
      .circle(592, 356, 22, 0x38bdf8, 0.03)
      .setStrokeStyle(3, 0xfde68a, 0.72)
      .setDepth(13.1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: ripple,
      scaleX: 2.1,
      scaleY: 2.1,
      alpha: 0,
      duration: this.reducedMotion ? 300 : 720,
      ease: 'Cubic.Out',
      onComplete: () => ripple.destroy()
    });

    // Keep the question in the release path for screen readers/debugging without
    // adding another visible panel here; showQuestionCard owns the readable copy.
    void question;
  }

  private playDialEnergyWave(x: number, y: number, phase: number): void {
    const colors = [0xd6ad54, 0x8b5cf6, 0x38bdf8];
    for (let index = 0; index < 3; index += 1) {
      const ring = this.scene.add
        .circle(x, y, 34 + index * 5, 0x000000, 0)
        .setStrokeStyle(3 - index * 0.5, colors[(phase + index) % colors.length], 0.72)
        .setDepth(12.4 + index * 0.01)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: ring,
        scaleX: 4.2 + index * 0.6,
        scaleY: 4.2 + index * 0.6,
        alpha: 0,
        duration: this.reducedMotion ? 420 : 1050 + index * 100,
        delay: index * 80,
        ease: 'Cubic.Out',
        onComplete: () => ring.destroy()
      });
    }
  }

  private createPressurePlate(): Phaser.GameObjects.Container {
    const root = this.scene.add.container(760, 520).setDepth(6.6).setAlpha(0.16);
    const glow = this.scene.add.circle(0, 0, 55, 0x8b5cf6, 0.035)
      .setStrokeStyle(2, 0xd4a64e, 0.26);
    const outer = this.scene.add.ellipse(0, 0, 98, 31, 0x241a30, 0.72)
      .setStrokeStyle(3, 0x9a6b34, 0.62);
    const inner = this.scene.add.ellipse(0, 0, 67, 18, 0x312e81, 0.42)
      .setStrokeStyle(2, 0x8b5cf6, 0.44);
    root.add([glow, outer, inner]);
    this.pulseProp(glow, 1.08, 2400);
    return root;
  }

  private trigger(event: Omit<WorldInteractionEvent, 'firstTime'>): void {
    const firstInteraction = !this.discovered.has(event.id);
    const firstSecret = event.secret && !this.secretsFound.has(event.id);
    this.discovered.add(event.id);
    if (firstSecret) this.secretsFound.add(event.id);

    // For a secret that unlocks after repeated interaction (Quip's third tap),
    // the secret reveal itself is treated as the first-time reward moment.
    const firstTime = event.secret ? firstSecret : firstInteraction;
    this.onInteraction({ ...event, firstTime });

    if (firstSecret) {
      this.updateSecretBadge();
    }
  }

  private updateSecretBadge(): void {
    const secrets = ['star_window', 'prism', 'telescope', 'question_jar', 'pressure_plate']
      .filter((id) => this.secretsFound.has(id as WorldInteractionId)).length;

    this.secretBadgeText.setText(`✦ LAB SECRETS  ${secrets}/5`);
    this.secretBadge.setVisible(true);
    this.scene.tweens.killTweensOf(this.secretBadge);

    if (this.reducedMotion) {
      this.secretBadge.setAlpha(0.72);
      return;
    }

    this.secretBadge.setAlpha(0).setScale(0.86);
    this.scene.tweens.add({
      targets: this.secretBadge,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.time.delayedCall(1800, () => {
          this.scene.tweens.add({
            targets: this.secretBadge,
            alpha: 0.58,
            duration: 300,
            ease: 'Sine.Out'
          });
        });
      }
    });
  }

  private breatheSprite(target: Phaser.GameObjects.GameObject, scale = 1.08, duration = 1800): void {
    if (this.reducedMotion) return;
    this.scene.tweens.add({
      targets: target,
      alpha: { from: 0.05, to: 0.20 },
      scaleX: { from: 0.96, to: scale },
      scaleY: { from: 0.96, to: scale },
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  private pulseProp(target: Phaser.GameObjects.GameObject, scale = 1.15, duration = 1900): void {
    if (this.reducedMotion) return;
    this.scene.tweens.add({
      targets: target,
      alpha: { from: 0.04, to: 0.18 },
      scaleX: { from: 0.96, to: scale },
      scaleY: { from: 0.96, to: scale },
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  private playRainbowReveal(): void {
    const colors = [0xef4444, 0xf59e0b, 0xfacc15, 0x22c55e, 0x38bdf8, 0x8b5cf6];
    colors.forEach((color, index) => {
      const ray = this.scene.add.graphics().setDepth(13 + index * 0.01).setAlpha(0.72);
      ray.lineStyle(4, color, 0.78);
      ray.lineBetween(883, 392 + index * 3 - 8, 1010, 333 + index * 16);
      this.scene.tweens.add({
        targets: ray,
        alpha: 0,
        duration: this.reducedMotion ? 450 : 1650,
        delay: index * 35,
        ease: 'Sine.In',
        onComplete: () => ray.destroy()
      });
    });
  }

  private playConstellationReveal(): void {
    const points = [
      [190, 155], [228, 135], [262, 168], [299, 145], [330, 185], [286, 210], [240, 202]
    ];
    const lines = this.scene.add.graphics().setDepth(12.7).setAlpha(0.8);
    lines.lineStyle(2, 0x93c5fd, 0.65);
    for (let index = 0; index < points.length - 1; index += 1) {
      lines.lineBetween(points[index][0], points[index][1], points[index + 1][0], points[index + 1][1]);
    }

    const stars = points.map(([x, y], index) => this.scene.add
      .circle(x, y, index % 2 ? 4 : 6, 0xf8e7a6, 0.95)
      .setStrokeStyle(1, 0xffffff, 0.8)
      .setDepth(12.8)
      .setScale(this.reducedMotion ? 1 : 0.1));

    if (!this.reducedMotion) {
      stars.forEach((star, index) => {
        this.scene.tweens.add({
          targets: star,
          scaleX: 1,
          scaleY: 1,
          duration: 200,
          delay: index * 65,
          ease: 'Back.Out'
        });
      });
    }

    this.scene.time.delayedCall(1900, () => {
      this.scene.tweens.add({
        targets: [...stars, lines],
        alpha: 0,
        duration: 300,
        onComplete: () => {
          lines.destroy();
          stars.forEach((star) => star.destroy());
        }
      });
    });
  }

  private showQuestionCard(question: string): void {
    const plate = this.scene.add
      .rectangle(650, 212, 430, 92, 0x171a2f, 0.96)
      .setStrokeStyle(3, 0xd6ad54, 0.92)
      .setDepth(1150);
    const eyebrow = this.scene.add.text(650, 187, 'QUESTION JAR', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#fde68a',
      letterSpacing: 1.2
    }).setOrigin(0.5).setDepth(1151);
    const copy = this.scene.add.text(650, 220, question, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#fff7df',
      align: 'center',
      wordWrap: { width: 380 }
    }).setOrigin(0.5).setDepth(1151);

    const objects = [plate, eyebrow, copy];
    if (!this.reducedMotion) {
      objects.forEach((object) => object.setAlpha(0).setScale(0.92));
      this.scene.tweens.add({
        targets: objects,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 190,
        ease: 'Back.Out'
      });
    }

    this.scene.time.delayedCall(2100, () => {
      this.scene.tweens.add({
        targets: objects,
        alpha: 0,
        y: '-=12',
        duration: 230,
        onComplete: () => objects.forEach((object) => object.destroy())
      });
    });
  }

  private playLabPulse(phase = 0): void {
    const colors = [0x8b5cf6, 0xd6ad54, 0x38bdf8, 0xf59e0b];
    const pulse = this.scene.add
      .rectangle(640, 360, 1280, 720, colors[phase % colors.length], 0.02)
      .setDepth(11.8)
      .setBlendMode(Phaser.BlendModes.ADD);
    const horizon = this.scene.add
      .rectangle(640, 470, 1100, 4, colors[(phase + 1) % colors.length], 0.14)
      .setDepth(11.9)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.scene.tweens.add({
      targets: pulse,
      alpha: { from: 0.02, to: 0.18 },
      duration: this.reducedMotion ? 1 : 190,
      yoyo: true,
      repeat: this.reducedMotion ? 0 : 1,
      ease: 'Sine.InOut',
      onComplete: () => pulse.destroy()
    });
    this.scene.tweens.add({
      targets: horizon,
      alpha: 0,
      scaleX: 1.16,
      duration: this.reducedMotion ? 200 : 720,
      ease: 'Cubic.Out',
      onComplete: () => horizon.destroy()
    });
  }

  private playShootingStar(): void {
    const star = this.scene.add.text(120, 125, '✦', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#fff7d6'
    }).setOrigin(0.5).setDepth(12.4);
    const trail = this.scene.add.graphics().setDepth(12.3).setAlpha(0.72);
    trail.lineStyle(3, 0x93c5fd, 0.7);
    trail.lineBetween(114, 132, 170, 170);

    this.scene.tweens.add({
      targets: star,
      x: 335,
      y: 245,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: this.reducedMotion ? 450 : 720,
      ease: 'Cubic.In',
      onComplete: () => {
        star.destroy();
        trail.destroy();
      }
    });
    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: this.reducedMotion ? 450 : 720,
      ease: 'Sine.In'
    });
  }

  private animatePressurePlateSecret(): void {
    this.scene.tweens.killTweensOf(this.pressurePlate);
    this.scene.tweens.add({
      targets: this.pressurePlate,
      scaleX: 0.92,
      scaleY: 0.82,
      alpha: 0.95,
      duration: this.reducedMotion ? 1 : 130,
      yoyo: true,
      repeat: 1,
      ease: 'Back.Out'
    });

    const drawer = this.scene.add.container(760, 492).setDepth(12.2);
    const body = this.scene.add.rectangle(0, 0, 120, 44, 0x322331, 0.98)
      .setStrokeStyle(4, 0xd4a64e, 0.95);
    const inner = this.scene.add.rectangle(0, 0, 102, 28, 0x312e81, 0.76)
      .setStrokeStyle(2, 0x8b5cf6, 0.85);
    const handle = this.scene.add.circle(0, 0, 7, 0xfacc15, 1)
      .setStrokeStyle(2, 0xfff1b3, 0.9);
    drawer.add([body, inner, handle]);
    drawer.setScale(this.reducedMotion ? 1 : 0.72).setAlpha(this.reducedMotion ? 1 : 0);

    if (!this.reducedMotion) {
      this.scene.tweens.add({
        targets: drawer,
        y: 458,
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        duration: 380,
        ease: 'Back.Out'
      });
    }

    this.scene.time.delayedCall(2500, () => {
      this.scene.tweens.add({
        targets: drawer,
        alpha: 0,
        y: 480,
        duration: 280,
        onComplete: () => drawer.destroy()
      });
    });
  }

  private spawnQuipConfetti(): void {
    const colors = [0xfacc15, 0x8b5cf6, 0x38bdf8, 0xfb7185];
    for (let index = 0; index < 16; index += 1) {
      const particle = this.scene.add
        .circle(650, 415, 3 + (index % 3), colors[index % colors.length], 0.95)
        .setDepth(1200);
      const angle = (Math.PI * 2 * index) / 16;
      this.scene.tweens.add({
        targets: particle,
        x: 650 + Math.cos(angle) * (55 + (index % 4) * 12),
        y: 415 + Math.sin(angle) * (55 + (index % 4) * 9),
        alpha: 0,
        duration: this.reducedMotion ? 250 : 650,
        ease: 'Cubic.Out',
        onComplete: () => particle.destroy()
      });
    }
  }
}
