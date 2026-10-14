import Phaser from 'phaser';
import type { ReactionZone } from './ReactionSystem';

export type DebugSnapshot = {
  shadowScale: number;
  shadowVisible: boolean;
  lightEnabled: boolean;
  lightX: number;
  lightY: number;
  quipX: number;
  quipY: number;
  zone: ReactionZone;
  secretTriggered: boolean;
};

export class DebugOverlay {
  private visible = false;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.panel = scene.add
      .rectangle(16, 626, 398, 82, 0x020617, 0.86)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x475569, 0.7)
      .setDepth(199)
      .setVisible(false);

    this.text = scene.add
      .text(28, 638, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#cbd5e1',
        lineSpacing: 3
      })
      .setDepth(200)
      .setVisible(false);
  }

  public toggle(): void {
    this.visible = !this.visible;
    this.panel.setVisible(this.visible);
    this.text.setVisible(this.visible);
  }

  public update(snapshot: DebugSnapshot): void {
    if (!this.visible) return;

    this.text.setText([
      `shadow=${snapshot.shadowScale.toFixed(2)} visible=${snapshot.shadowVisible} light=${snapshot.lightEnabled ? 'ON' : 'OFF'}`,
      `light=(${snapshot.lightX.toFixed(0)}, ${snapshot.lightY.toFixed(0)}) quip=(${snapshot.quipX.toFixed(0)}, ${snapshot.quipY.toFixed(0)})`,
      `reaction=${snapshot.zone} giantSecret=${snapshot.secretTriggered}`
    ]);
  }
}
