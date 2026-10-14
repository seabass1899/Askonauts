import Phaser from 'phaser';

/**
 * Child-facing evidence lock for P1 Stage D.
 *
 * This is intentionally not a quiz. The Compass reflects discoveries the child
 * already made, then lets them actively "lock" that evidence before returning
 * to free experimentation.
 */
export class QuestionCompass extends Phaser.GameObjects.Container {
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly card: Phaser.GameObjects.Rectangle;
  private readonly outerRing: Phaser.GameObjects.Arc;
  private readonly innerFace: Phaser.GameObjects.Arc;
  private readonly pulseRing: Phaser.GameObjects.Arc;
  private readonly needle: Phaser.GameObjects.Triangle;
  private readonly centerMark: Phaser.GameObjects.Text;
  private readonly prompt: Phaser.GameObjects.Text;
  private readonly evidenceChips: Phaser.GameObjects.Container[] = [];
  private readonly tapZone: Phaser.GameObjects.Zone;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private locked = false;
  private lockTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 640, 360);

    this.backdrop = scene.add
      .rectangle(0, 0, 1280, 720, 0x020617, 0.68)
      .setInteractive();

    this.card = scene.add
      .rectangle(0, 0, 760, 500, 0x111827, 0.985)
      .setStrokeStyle(3, 0xb99245, 0.92);

    const kicker = scene.add
      .text(0, -207, 'QUESTION COMPASS', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#fde68a'
      })
      .setOrigin(0.5);

    const title = scene.add
      .text(0, -167, 'You found a pattern.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '31px',
        fontStyle: 'bold',
        color: '#f8fafc'
      })
      .setOrigin(0.5);

    const subtitle = scene.add
      .text(0, -127, 'These clues belong together.', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        color: '#cbd5e1'
      })
      .setOrigin(0.5);

    this.evidenceChips.push(
      this.makeEvidenceChip(-220, -57, 'LIGHT', '✦', 0xfde68a),
      this.makeEvidenceChip(0, -57, 'BLOCK', '◆', 0xcbd5e1),
      this.makeEvidenceChip(220, -57, 'SHADOW', '◐', 0xa78bfa)
    );

    this.pulseRing = scene.add
      .circle(0, 112, 84, 0x60a5fa, 0)
      .setStrokeStyle(5, 0x60a5fa, 0.72);

    this.outerRing = scene.add
      .circle(0, 112, 72, 0x1f2937, 1)
      .setStrokeStyle(10, 0xb99245, 1);

    const innerBrass = scene.add
      .circle(0, 112, 61, 0x0f172a, 1)
      .setStrokeStyle(3, 0xf6d365, 0.9);

    this.innerFace = scene.add
      .circle(0, 112, 50, 0x1d4ed8, 0.9)
      .setStrokeStyle(3, 0x7dd3fc, 0.88);

    // A simple needle/arrow gives the Compass a physical instrument feel.
    this.needle = scene.add
      .triangle(0, 89, 0, 0, -8, 31, 8, 31, 0xfef3c7, 1)
      .setOrigin(0.5, 0.72);

    this.centerMark = scene.add
      .text(0, 120, '?', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '42px',
        fontStyle: 'bold',
        color: '#f8fafc'
      })
      .setOrigin(0.5);

    this.prompt = scene.add
      .text(0, 207, 'Tap the Compass to lock your evidence', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#e2e8f0'
      })
      .setOrigin(0.5);

    this.tapZone = scene.add
      .zone(0, 112, 210, 190)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.add([
      this.backdrop,
      this.card,
      kicker,
      title,
      subtitle,
      ...this.evidenceChips,
      this.pulseRing,
      this.outerRing,
      innerBrass,
      this.innerFace,
      this.needle,
      this.centerMark,
      this.prompt,
      this.tapZone
    ]);

    scene.add.existing(this);
    this.setDepth(1200).setVisible(false).setAlpha(0);
    this.backdrop.disableInteractive();
    this.tapZone.disableInteractive();

    this.tapZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      if (this.locked) {
        this.finishEvidenceLock();
        return;
      }
      this.lockEvidence();
    });
  }

  public showEvidence(): void {
    if (this.visible) return;

    this.locked = false;
    this.backdrop.setInteractive();
    this.tapZone.setInteractive({ useHandCursor: true });
    this.centerMark.setText('?').setColor('#f8fafc');
    this.prompt.setText('Tap the Compass to lock your evidence').setColor('#e2e8f0');
    this.innerFace.setFillStyle(0x1d4ed8, 0.9).setStrokeStyle(3, 0x7dd3fc, 0.88);
    this.needle.setAngle(0);
    this.outerRing.setAngle(0);

    for (const chip of this.evidenceChips) {
      chip.setAlpha(1).setScale(1);
    }

    this.setVisible(true).setAlpha(0).setScale(0.96);
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 260,
      ease: 'Back.Out'
    });

    this.startPulse();
  }

  public dismiss(onComplete?: () => void): void {
    this.stopPulse();
    this.backdrop.disableInteractive();
    this.tapZone.disableInteractive();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 0.97,
      scaleY: 0.97,
      duration: 420,
      ease: 'Sine.In',
      onComplete: () => {
        this.setVisible(false);
        onComplete?.();
      }
    });
  }

  private lockEvidence(): void {
    if (this.locked) return;
    this.locked = true;
    this.stopPulse();
    this.emit('compass-tapped');

    this.prompt.setText('Locking evidence…').setColor('#fde68a');

    this.scene.tweens.add({
      targets: this.outerRing,
      angle: 360,
      duration: 720,
      ease: 'Cubic.InOut'
    });
    this.scene.tweens.add({
      targets: this.needle,
      angle: 360,
      duration: 620,
      ease: 'Back.InOut'
    });

    this.evidenceChips.forEach((chip, index) => {
      this.scene.tweens.add({
        targets: chip,
        x: Phaser.Math.Linear(chip.x, 0, 0.72),
        y: Phaser.Math.Linear(chip.y, 112, 0.72),
        scaleX: 0.72,
        scaleY: 0.72,
        alpha: 0.28,
        delay: index * 75,
        duration: 460,
        ease: 'Cubic.In'
      });
    });

    this.prompt.setText('Locking evidence…  TAP TO FINISH').setColor('#fde68a');
    this.tapZone.setInteractive({ useHandCursor: true });
    this.lockTimer = this.scene.time.delayedCall(1600, () => this.finishEvidenceLock());
  }

  private finishEvidenceLock(): void {
    if (!this.locked) return;
    this.lockTimer?.remove(false);
    this.lockTimer = null;
    this.tapZone.disableInteractive();
    this.scene.tweens.killTweensOf(this.outerRing);
    this.scene.tweens.killTweensOf(this.needle);
    for (const chip of this.evidenceChips) this.scene.tweens.killTweensOf(chip);

    this.outerRing.setAngle(360);
    this.needle.setAngle(360);
    this.centerMark.setText('✓').setColor('#ecfccb');
    this.innerFace.setFillStyle(0x166534, 0.96).setStrokeStyle(3, 0x86efac, 0.95);
    this.prompt.setText('EVIDENCE LOCKED!').setColor('#86efac');

    const flash = this.scene.add
      .circle(640, 472, 52, 0xfde68a, 0)
      .setStrokeStyle(6, 0xfde68a, 0.9)
      .setDepth(1250);
    this.scene.tweens.add({
      targets: flash,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 480,
      ease: 'Cubic.Out',
      onComplete: () => flash.destroy()
    });

    this.emit('evidence-confirmed');
  }

  private makeEvidenceChip(
    x: number,
    y: number,
    label: string,
    glyph: string,
    accent: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const card = this.scene.add
      .rectangle(0, 0, 172, 92, 0x1e293b, 0.98)
      .setStrokeStyle(2, accent, 0.8);
    const icon = this.scene.add
      .text(0, -14, glyph, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: `#${accent.toString(16).padStart(6, '0')}`
      })
      .setOrigin(0.5);
    const text = this.scene.add
      .text(0, 25, `✓ ${label}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#f8fafc'
      })
      .setOrigin(0.5);
    container.add([card, icon, text]);
    return container;
  }

  private startPulse(): void {
    this.stopPulse();
    this.pulseRing.setScale(0.9).setAlpha(0.85);
    this.pulseTween = this.scene.tweens.add({
      targets: this.pulseRing,
      scaleX: 1.45,
      scaleY: 1.45,
      alpha: { from: 0.82, to: 0.08 },
      duration: 900,
      repeat: -1,
      ease: 'Sine.Out'
    });
  }

  private stopPulse(): void {
    this.pulseTween?.stop();
    this.pulseTween = null;
    this.pulseRing.setScale(1).setAlpha(1);
  }
}
