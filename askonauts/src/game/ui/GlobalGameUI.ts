import Phaser from 'phaser';
import { PlayerProgressStore } from '../progress/PlayerProgressStore';
import { AudioManager } from '../systems/AudioManager';
import { DiscoveryJournalOverlay } from './DiscoveryJournalOverlay';
import { QuestionTreeOverlay } from './QuestionTreeOverlay';
import { SettingsOverlay } from './SettingsOverlay';

export type GlobalGameUIConfig = {
  /** Painted-header hotspot centers in the 1280×720 ASKONAUTS layout. */
  journalX?: number;
  treeX?: number;
  settingsX?: number;
  audioX?: number;
  clubhouseX?: number;
  y?: number;
  /** Draw shared utility buttons instead of binding invisible zones to painted art. */
  renderButtons?: boolean;
  /** Compact mode is intended for programmatic headers with limited horizontal room. */
  compact?: boolean;
  /** Clubhouse is already home, so its shell omits the Home button. */
  showClubhouse?: boolean;
  /** Optional starting center for rendered buttons. */
  startX?: number;
  /** Optional rendered-button geometry override for especially tight headers. */
  buttonWidth?: number;
  /** Escape closes an open modal first, then returns to the Clubhouse when true. */
  escapeToClubhouse?: boolean;
  buttonHeight?: number;
  gap?: number;
};

/**
 * P6.5 shared application shell / production rail.
 *
 * The current world owns its title/chrome. This class owns the global semantics:
 * Journal, Question Tree, Settings, Audio, and Clubhouse. It can either attach
 * invisible hotspots to painted controls (Spoon Lab) or draw a compact live rail
 * for programmatic worlds (Reflection, Funhouse, Shadow Chase, Clubhouse).
 */
export class GlobalGameUI {
  private readonly journal: DiscoveryJournalOverlay;
  private readonly tree: QuestionTreeOverlay;
  private readonly settingsOverlay: SettingsOverlay;
  private toast?: Phaser.GameObjects.Container;
  private audioIcon?: Phaser.GameObjects.Container;
  private unsubscribeSettings?: () => void;
  private escapeHandler?: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    progressStore: PlayerProgressStore,
    public readonly audio: AudioManager,
    config: GlobalGameUIConfig = {}
  ) {
    this.journal = new DiscoveryJournalOverlay(scene, progressStore);
    this.tree = new QuestionTreeOverlay(scene, progressStore);
    this.settingsOverlay = new SettingsOverlay(scene, audio, progressStore);

    const y = config.y ?? 61;
    const showClubhouse = config.showClubhouse !== false;

    if (config.renderButtons) {
      const compact = config.compact ?? false;
      const width = config.buttonWidth ?? (compact ? 38 : 54);
      const height = config.buttonHeight ?? (compact ? 38 : 44);
      const gap = config.gap ?? (compact ? 42 : 58);
      const count = showClubhouse ? 5 : 4;
      const defaultStart = 1270 - ((count - 1) * gap) - width / 2;
      const startX = config.startX ?? defaultStart;

      this.makeRenderedButton(startX, y, width, height, 'journal', 'JOURNAL', () => this.openJournal());
      this.makeRenderedButton(startX + gap, y, width, height, 'tree', 'TREE', () => this.openTree());
      this.makeRenderedButton(startX + gap * 2, y, width, height, 'settings', 'SETTINGS', () => this.openSettings());
      const audioX = startX + gap * 3;
      this.makeRenderedButton(audioX, y, width, height, 'audio', 'AUDIO', () => this.toggleAudio());
      this.createAudioStateIcon(audioX, y - (compact ? 5 : 6), compact ? 10 : 12);
      if (showClubhouse) {
        this.makeRenderedButton(startX + gap * 4, y, width + (compact ? 2 : 8), height, 'home', 'HOME', () => scene.scene.start('ClubhouseScene'));
      }
    } else {
      this.makeHeaderZone(config.journalX ?? 966, y, 56, 48, () => this.openJournal());
      this.makeHeaderZone(config.treeX ?? 1023, y, 56, 48, () => this.openTree());
      this.makeHeaderZone(config.settingsX ?? 1087, y, 62, 48, () => this.openSettings());
      const audioX = config.audioX ?? 1153;
      this.makeHeaderZone(audioX, y, 60, 48, () => this.toggleAudio());
      if (showClubhouse) {
        this.makeHeaderZone(config.clubhouseX ?? 1237, y, 72, 50, () => scene.scene.start('ClubhouseScene'));
      }
      this.createAudioStateIcon(audioX, 35, 19);
    }

    const escapeToClubhouse = config.escapeToClubhouse ?? showClubhouse;
    this.escapeHandler = () => {
      if (this.closeActiveOverlay()) return;
      if (escapeToClubhouse) this.scene.scene.start('ClubhouseScene');
    };
    this.scene.input.keyboard?.on('keydown-ESC', this.escapeHandler);

    this.unsubscribeSettings = this.audio.settings.subscribe((settings) => {
      this.updateAudioStateIcon(settings.masterMuted);
    });
    this.updateAudioStateIcon(this.audio.getSettings().masterMuted);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.closeAllOverlays();
      this.unsubscribeSettings?.();
      this.unsubscribeSettings = undefined;
      if (this.escapeHandler) {
        this.scene.input.keyboard?.off('keydown-ESC', this.escapeHandler);
        this.escapeHandler = undefined;
      }
    });
  }

  private openJournal(): void {
    this.tree.close();
    this.settingsOverlay.close();
    this.journal.open();
  }

  private openTree(): void {
    this.journal.close();
    this.settingsOverlay.close();
    this.tree.open();
  }

  private openSettings(): void {
    this.journal.close();
    this.tree.close();
    this.settingsOverlay.open();
  }

  private closeActiveOverlay(): boolean {
    if (this.settingsOverlay.isOpen()) {
      this.settingsOverlay.close();
      return true;
    }
    if (this.journal.isOpen()) {
      this.journal.close();
      return true;
    }
    if (this.tree.isOpen()) {
      this.tree.close();
      return true;
    }
    return false;
  }

  private closeAllOverlays(): void {
    this.journal.close();
    this.tree.close();
    this.settingsOverlay.close();
  }

  private toggleAudio(): void {
    const muted = this.audio.toggleMaster();
    this.showToast(muted ? 'AUDIO MUTED' : 'AUDIO ON', muted ? '#fda4af' : '#86efac');
  }

  private makeRenderedButton(
    x: number,
    y: number,
    width: number,
    height: number,
    icon: 'journal' | 'tree' | 'settings' | 'audio' | 'home',
    accessibleLabel: string,
    action: () => void
  ): void {
    const button = this.scene.add.rectangle(x, y, width, height, 0x0b1c37, 0.98)
      .setStrokeStyle(2, 0x5c82b5, 0.9)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0)
      .setDepth(1800)
      .setData('aria-label', accessibleLabel);

    if (icon !== 'audio') this.createUtilityGlyph(icon, x, y - 5);

    this.scene.add.text(x, y + Math.max(10, height * 0.27), accessibleLabel, {
      fontFamily: 'Arial, sans-serif',
      fontSize: width <= 42 ? '5.5px' : '6px',
      fontStyle: 'bold',
      color: '#a9bdd8',
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1802);

    button.on('pointerdown', () => {
      this.audio.unlock();
      action();
    });
    button.on('pointerover', () => button.setFillStyle(0x12345d, 1).setStrokeStyle(2, 0x93c5fd, 1));
    button.on('pointerout', () => button.setFillStyle(0x0b1c37, 0.98).setStrokeStyle(2, 0x5c82b5, 0.9));
  }

  private createUtilityGlyph(icon: 'journal' | 'tree' | 'settings' | 'home', x: number, y: number): void {
    const g = this.scene.add.graphics().setScrollFactor(0).setDepth(1802);
    const color = 0xdbeafe;
    g.lineStyle(2, color, 1);

    if (icon === 'journal') {
      g.strokeRoundedRect(x - 10, y - 8, 9, 16, 2);
      g.strokeRoundedRect(x + 1, y - 8, 9, 16, 2);
      g.lineBetween(x, y - 7, x, y + 8);
      g.lineBetween(x - 7, y - 3, x - 3, y - 3);
      g.lineBetween(x + 3, y - 3, x + 7, y - 3);
      return;
    }

    if (icon === 'tree') {
      g.lineBetween(x, y - 7, x - 7, y + 5);
      g.lineBetween(x, y - 7, x + 7, y + 5);
      g.lineBetween(x - 7, y + 5, x + 7, y + 5);
      [ [0, -7], [-7, 5], [7, 5] ].forEach(([dx, dy]) => {
        g.fillStyle(color, 1);
        g.fillCircle(x + dx, y + dy, 3);
      });
      return;
    }

    if (icon === 'settings') {
      g.strokeCircle(x, y, 6);
      g.strokeCircle(x, y, 2.2);
      for (let i = 0; i < 8; i += 1) {
        const a = (Math.PI * 2 * i) / 8;
        g.lineBetween(x + Math.cos(a) * 7, y + Math.sin(a) * 7, x + Math.cos(a) * 10, y + Math.sin(a) * 10);
      }
      return;
    }

    g.beginPath();
    g.moveTo(x - 10, y - 1);
    g.lineTo(x, y - 10);
    g.lineTo(x + 10, y - 1);
    g.strokePath();
    g.strokeRect(x - 7, y - 1, 14, 10);
    g.lineBetween(x - 2, y + 9, x - 2, y + 3);
    g.lineBetween(x + 2, y + 9, x + 2, y + 3);
  }

  private createAudioStateIcon(x: number, y: number, radius: number): void {
    this.audioIcon?.destroy(true);
    this.audioIcon = this.scene.add.container(x, y).setScrollFactor(0).setDepth(1860);
    const cover = this.scene.add.circle(0, 0, radius, 0x07172d, 0.98)
      .setStrokeStyle(2, 0x2f78a8, 0.95);
    const glyph = this.scene.add.graphics();
    glyph.setData('role', 'audio-glyph');
    this.audioIcon.add([cover, glyph]);
  }

  private updateAudioStateIcon(muted: boolean): void {
    const glyph = this.audioIcon?.list.find((child) => child.getData?.('role') === 'audio-glyph') as Phaser.GameObjects.Graphics | undefined;
    if (!glyph) return;
    glyph.clear();

    const iconColor = muted ? 0xfda4af : 0xdbeafe;
    glyph.fillStyle(iconColor, 1);
    glyph.fillRect(-10, -5, 5, 10);
    glyph.fillTriangle(-5, -8, -5, 8, 3, 0);
    glyph.lineStyle(2, iconColor, 1);

    if (muted) {
      glyph.lineBetween(6, -6, 13, 6);
      glyph.lineBetween(13, -6, 6, 6);
      glyph.lineStyle(2.5, 0xfb7185, 1);
      glyph.lineBetween(-12, -12, 14, 12);
    } else {
      glyph.beginPath();
      glyph.arc(4, 0, 6, -0.8, 0.8, false);
      glyph.strokePath();
      glyph.beginPath();
      glyph.arc(4, 0, 11, -0.8, 0.8, false);
      glyph.strokePath();
    }
  }

  private makeHeaderZone(x: number, y: number, width: number, height: number, action: () => void): void {
    const zone = this.scene.add.zone(x, y, width, height)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0)
      .setDepth(1800);
    zone.on('pointerdown', () => {
      this.audio.unlock();
      action();
    });
  }

  private showToast(message: string, color: string): void {
    this.toast?.destroy(true);
    const toast = this.scene.add.container(1088, 128).setScrollFactor(0).setDepth(2500);
    this.toast = toast;
    const bg = this.scene.add.rectangle(0, 0, 170, 34, 0x06152d, 0.96).setStrokeStyle(2, 0x5f78a8, 0.9);
    const label = this.scene.add.text(0, 0, message, {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color
    }).setOrigin(0.5);
    toast.add([bg, label]);
    toast.setAlpha(0).setScale(0.96);
    this.scene.tweens.add({
      targets: toast,
      alpha: 1,
      scale: 1,
      duration: 120,
      yoyo: true,
      hold: 1050,
      onComplete: () => {
        toast.destroy(true);
        if (this.toast === toast) this.toast = undefined;
      }
    });
  }
}
