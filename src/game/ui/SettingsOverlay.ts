import Phaser from 'phaser';
import { PlayerProgressStore } from '../progress/PlayerProgressStore';
import { AudioManager } from '../systems/AudioManager';
import type { GameSettings } from '../settings/GameSettingsStore';

const W = 1280;
const H = 720;

type ToggleKey = 'masterMuted' | 'voiceEnabled' | 'sfxEnabled' | 'captionsEnabled' | 'reducedMotion';

/** Compact, persistent child-facing settings modal for P6.4B. */
export class SettingsOverlay {
  private overlay?: Phaser.GameObjects.Container;
  private resetArmed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly audio: AudioManager,
    private readonly progressStore: PlayerProgressStore
  ) {}

  public isOpen(): boolean {
    return Boolean(this.overlay?.active);
  }

  public open(): void {
    this.close();
    this.resetArmed = false;
    const overlay = this.scene.add.container(0, 0).setDepth(2410);
    this.overlay = overlay;
    const dim = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0.80).setInteractive();
    const panel = this.scene.add.rectangle(640, 360, 780, 600, 0x07172d, 0.99).setStrokeStyle(4, 0xd6ad54, 0.96);
    const title = this.scene.add.text(640, 92, 'SETTINGS', {
      fontFamily: 'Arial, sans-serif', fontSize: '31px', fontStyle: 'bold', color: '#ffd966', stroke: '#17325d', strokeThickness: 3
    }).setOrigin(0.5);
    const subtitle = this.scene.add.text(640, 127, 'Sound, readability, and play preferences', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#cbd5e1'
    }).setOrigin(0.5);
    const closeBox = this.scene.add.rectangle(965, 92, 82, 38, 0x102443, 1)
      .setStrokeStyle(2, 0xa78bfa, 0.95).setInteractive({ useHandCursor: true });
    const closeText = this.scene.add.text(965, 92, 'CLOSE', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#e2e8f0'
    }).setOrigin(0.5);
    overlay.add([dim, panel, title, subtitle, closeBox, closeText]);
    closeBox.on('pointerdown', () => this.close());

    const settings = this.audio.getSettings();
    const rows: Array<{ y: number; label: string; key: ToggleKey; invert?: boolean; help: string }> = [
      { y: 190, label: 'MASTER AUDIO', key: 'masterMuted', invert: true, help: 'One switch for narration and sound effects.' },
      { y: 252, label: 'VOICE NARRATION', key: 'voiceEnabled', help: 'Veya, Teyo, Quip, and narrator speech.' },
      { y: 314, label: 'SOUND EFFECTS', key: 'sfxEnabled', help: 'Experiment, discovery, and interaction sounds.' },
      { y: 376, label: 'CAPTIONS', key: 'captionsEnabled', help: 'Keep spoken guidance visible as text.' },
      { y: 438, label: 'REDUCE MOTION', key: 'reducedMotion', help: 'Reduce pulsing, sparkles, and cinematic movement throughout the game.' }
    ];

    rows.forEach((row) => this.createToggleRow(overlay, row.y, row.label, row.help, row.key, settings, Boolean(row.invert)));

    const musicLabel = this.scene.add.text(360, 495, 'MUSIC', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#e2e8f0'
    });
    const musicHelp = this.scene.add.text(360, 515, 'Music system reserved for the dedicated audio-production pass.', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#7f8fa8'
    });
    const musicState = this.scene.add.text(900, 505, 'COMING SOON', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#94a3b8'
    }).setOrigin(0.5);
    overlay.add([musicLabel, musicHelp, musicState]);

    const textLabel = this.scene.add.text(360, 552, 'TEXT SIZE', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#e2e8f0'
    });
    const normal = this.makeActionButton(760, 560, 112, 38, 'NORMAL', settings.textScale <= 1.05 ? 0x2563eb : 0x172033);
    const large = this.makeActionButton(890, 560, 112, 38, 'LARGE', settings.textScale > 1.05 ? 0x2563eb : 0x172033);
    normal.box.on('pointerdown', () => { this.audio.updateSettings({ textScale: 1 }); this.open(); });
    large.box.on('pointerdown', () => { this.audio.updateSettings({ textScale: 1.18 }); this.open(); });
    overlay.add([textLabel, normal.box, normal.text, large.box, large.text]);

    const clubhouse = this.makeActionButton(455, 624, 190, 48, 'RETURN TO CLUBHOUSE', 0x1d4ed8);
    const reset = this.makeActionButton(675, 624, 190, 48, 'RESET SETTINGS', 0x334155);
    const resetProgress = this.makeActionButton(895, 624, 190, 48, 'RESET PROGRESS', 0x7f1d1d);
    overlay.add([clubhouse.box, clubhouse.text, reset.box, reset.text, resetProgress.box, resetProgress.text]);
    clubhouse.box.on('pointerdown', () => { this.close(); this.scene.scene.start('ClubhouseScene'); });
    reset.box.on('pointerdown', () => { this.audio.settings.reset(); this.open(); });
    resetProgress.box.on('pointerdown', () => {
      if (!this.resetArmed) {
        this.resetArmed = true;
        resetProgress.text.setText('TAP AGAIN TO RESET');
        resetProgress.box.setFillStyle(0x991b1b, 1);
        return;
      }
      this.progressStore.resetAll();
      this.close();
      this.scene.scene.start('ClubhouseScene');
    });
  }

  public close(): void {
    this.overlay?.destroy(true);
    this.overlay = undefined;
    this.resetArmed = false;
  }

  private createToggleRow(
    overlay: Phaser.GameObjects.Container,
    y: number,
    label: string,
    help: string,
    key: ToggleKey,
    settings: GameSettings,
    invert: boolean
  ): void {
    const raw = settings[key] as boolean;
    const enabled = invert ? !raw : raw;
    const title = this.scene.add.text(360, y - 10, label, {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#e2e8f0'
    });
    const hint = this.scene.add.text(360, y + 11, help, {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#7f8fa8'
    });
    const box = this.scene.add.rectangle(875, y, 128, 40, enabled ? 0x166534 : 0x3f1d2e, 1)
      .setStrokeStyle(2, enabled ? 0x4ade80 : 0xfb7185, 0.9).setInteractive({ useHandCursor: true });
    const state = this.scene.add.text(875, y, enabled ? 'ON' : 'OFF', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    overlay.add([title, hint, box, state]);
    box.on('pointerdown', () => {
      const current = this.audio.getSettings();
      const currentRaw = current[key] as boolean;
      this.audio.updateSettings({ [key]: !currentRaw });
      this.open();
    });
  }

  private makeActionButton(x: number, y: number, w: number, h: number, label: string, fill: number): {
    box: Phaser.GameObjects.Rectangle;
    text: Phaser.GameObjects.Text;
  } {
    const box = this.scene.add.rectangle(x, y, w, h, fill, 1)
      .setStrokeStyle(2, 0x94a3b8, 0.85).setInteractive({ useHandCursor: true });
    const text = this.scene.add.text(x, y, label, {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    return { box, text };
  }
}
