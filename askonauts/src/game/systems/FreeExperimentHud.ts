import Phaser from 'phaser';
import type { SandboxDiscoveryId } from '../missions/types';

const DISCOVERY_LABELS: Record<SandboxDiscoveryId, string> = {
  left_beam: 'OUTSIDE LIGHT',
  blocker_occlusion: 'ROCK BLOCK',
  giant_shadow: 'GIANT SHADOW'
};

/**
 * P1.3D child-facing sandbox HUD.
 *
 * Progress now represents distinct discoveries instead of raw interactions.
 * Repeating the same action does not advance the HUD.
 */
export class FreeExperimentHud {
  private readonly container: Phaser.GameObjects.Container;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly pips: Phaser.GameObjects.Arc[] = [];
  private readonly pipHalos: Phaser.GameObjects.Arc[] = [];
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly found = new Set<SandboxDiscoveryId>();
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly totalSecrets: number,
    private readonly requiredDiscoveries: number
  ) {
    const plate = scene.add
      .rectangle(0, 0, 680, 128, 0x172033, 0.97)
      .setStrokeStyle(3, 0x8b5cf6, 0.88);

    const eyebrow = scene.add
      .text(0, -42, '✦ LIGHT LAB SECRETS ✦', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#fde68a'
      })
      .setOrigin(0.5);

    this.subtitle = scene.add
      .text(0, -14, `Find ${requiredDiscoveries} new things light can do.`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#f8fafc'
      })
      .setOrigin(0.5);

    const ids: SandboxDiscoveryId[] = ['left_beam', 'blocker_occlusion', 'giant_shadow'];
    const spacing = 176;
    const totalWidth = Math.max(0, (this.totalSecrets - 1) * spacing);
    for (let index = 0; index < this.totalSecrets; index += 1) {
      const x = -totalWidth / 2 + index * spacing;
      const halo = scene.add
        .circle(x, 21, 13, 0x8b5cf6, 0)
        .setStrokeStyle(2, 0xa78bfa, 0.18);
      const pip = scene.add
        .circle(x, 21, 7, 0x475569, 0.95)
        .setStrokeStyle(2, 0x94a3b8, 0.55);
      const label = scene.add
        .text(x, 45, '???', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#94a3b8'
        })
        .setOrigin(0.5);
      // Store the intended label on the object without showing the answer early.
      label.setData('discoveryId', ids[index]);
      this.pipHalos.push(halo);
      this.pips.push(pip);
      this.labels.push(label);
    }

    this.container = scene.add
      .container(640, 112, [plate, eyebrow, this.subtitle, ...this.pipHalos, ...this.pips, ...this.labels])
      .setDepth(940)
      .setAlpha(0)
      .setScale(0.92)
      .setVisible(false);
  }

  public show(): void {
    this.visible = true;
    this.found.clear();
    this.subtitle.setText(`Find ${this.requiredDiscoveries} new things light can do.`);
    this.resetPips();
    this.container.setVisible(true).setAlpha(0).setScale(0.92).setY(112);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 260,
      ease: 'Back.Out'
    });
  }

  public revealDiscovery(id: SandboxDiscoveryId): void {
    if (!this.visible || this.found.has(id)) return;
    this.found.add(id);

    const index = this.labels.findIndex((label) => label.getData('discoveryId') === id);
    if (index >= 0) {
      this.lightPip(index);
      this.labels[index]
        .setText(DISCOVERY_LABELS[id])
        .setColor('#fef3c7');
    }

    const count = this.found.size;
    if (count < this.requiredDiscoveries) {
      this.subtitle.setText('Nice discovery! Can you find one more?');
    } else {
      this.subtitle.setText('NEW QUESTION DETECTED');
    }
  }

  /** Compatibility helper for older scene code. */
  public setProgress(progress: number): void {
    if (!this.visible || progress <= this.found.size) return;
    this.subtitle.setText(
      progress >= this.requiredDiscoveries
        ? 'NEW QUESTION DETECTED'
        : 'Interesting. Try a different experiment.'
    );
  }

  public complete(): void {
    if (!this.visible) return;
    this.subtitle.setText('NEW QUESTION DETECTED');

    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.035,
      scaleY: 1.035,
      duration: 150,
      yoyo: true,
      ease: 'Sine.Out'
    });

    this.scene.time.delayedCall(1500, () => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        y: 94,
        duration: 280,
        ease: 'Cubic.In',
        onComplete: () => {
          this.container.setVisible(false).setY(112);
          this.visible = false;
        }
      });
    });
  }

  public hide(): void {
    this.container.setVisible(false);
    this.visible = false;
  }

  private lightPip(index: number): void {
    const pip = this.pips[index];
    const halo = this.pipHalos[index];
    if (!pip || !halo) return;

    pip.setFillStyle(0xfacc15, 1).setStrokeStyle(2, 0xfef3c7, 0.95);
    halo.setStrokeStyle(2, 0xfacc15, 0.72).setAlpha(1).setScale(0.55);

    this.scene.tweens.add({
      targets: halo,
      scaleX: 1.45,
      scaleY: 1.45,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.Out'
    });

    this.scene.tweens.add({
      targets: pip,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 110,
      yoyo: true,
      ease: 'Back.Out'
    });
  }

  private resetPips(): void {
    for (let index = 0; index < this.pips.length; index += 1) {
      this.pips[index].setFillStyle(0x475569, 0.95).setStrokeStyle(2, 0x94a3b8, 0.55).setScale(1);
      this.pipHalos[index].setAlpha(0).setScale(1);
      this.labels[index].setText('???').setColor('#94a3b8');
    }
  }
}
