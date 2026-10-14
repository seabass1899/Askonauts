import Phaser from 'phaser';
import { buildDiscoveryJournal, countJournalSecrets } from '../discoveries/DiscoveryJournal';
import type { DiscoveryJournalEntry } from '../discoveries/DiscoveryJournal';
import { PlayerProgressStore } from '../progress/PlayerProgressStore';

const W = 1280;
const H = 720;

function worldLabel(worldId: string): string {
  if (worldId === 'reflection-hunt') return 'REFLECTION LAB • REFLECTION HUNT';
  if (worldId === 'upside-down-spoon') return 'SPOON LAB • UPSIDE-DOWN SPOON';
  if (worldId === 'funhouse-mirrors') return 'FUNHOUSE MIRRORS';
  return 'LIGHT LAB • SHADOW CHASE';
}

function sceneKeyForWorld(worldId: string): string {
  if (worldId === 'reflection-hunt') return 'ReflectionHuntScene';
  if (worldId === 'upside-down-spoon') return 'UpsideDownSpoonScene';
  if (worldId === 'funhouse-mirrors') return 'FunhouseMirrorsScene';
  return 'ShadowBoxScene';
}

/** Scene-independent Discovery Journal used by the P6.4B global shell. */
export class DiscoveryJournalOverlay {
  private overlay?: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly progressStore: PlayerProgressStore
  ) {}

  public isOpen(): boolean {
    return Boolean(this.overlay?.active);
  }

  public open(): void {
    this.close();
    const entries = buildDiscoveryJournal(this.progressStore.getSnapshot());
    const overlay = this.scene.add.container(0, 0).setDepth(2400);
    this.overlay = overlay;

    const dim = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0.80).setInteractive();
    const panel = this.scene.add.rectangle(640, 360, 1080, 620, 0x06152d, 0.985)
      .setStrokeStyle(3, 0xf2c45c, 0.98);
    const title = this.scene.add.text(640, 74, 'DISCOVERY JOURNAL', {
      fontFamily: 'Arial, sans-serif', fontSize: '31px', fontStyle: 'bold', color: '#ffd966', stroke: '#17325d', strokeThickness: 3
    }).setOrigin(0.5);
    const subtitle = this.scene.add.text(640, 108, entries.length > 0
      ? `${entries.length} discoveries collected  •  ${countJournalSecrets(entries)} secrets`
      : 'Your discoveries will appear here as you explore.', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#cbd5e1'
    }).setOrigin(0.5);
    const closeBox = this.scene.add.rectangle(1110, 76, 82, 38, 0x102443, 1)
      .setStrokeStyle(2, 0xa78bfa, 0.95).setInteractive({ useHandCursor: true });
    const closeText = this.scene.add.text(1110, 76, 'CLOSE', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#e2e8f0'
    }).setOrigin(0.5);
    overlay.add([dim, panel, title, subtitle, closeBox, closeText]);
    closeBox.on('pointerdown', () => this.close());

    if (entries.length === 0) {
      const empty = this.scene.add.text(640, 345,
        'No discoveries yet.\n\nEnter the Light Lab and follow your curiosity.\nThe Journal will remember what you find.', {
          fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#dbeafe', align: 'center', lineSpacing: 10
        }).setOrigin(0.5);
      const launch = this.scene.add.rectangle(640, 485, 280, 58, 0x4338ca, 1)
        .setStrokeStyle(3, 0xc4b5fd, 1).setInteractive({ useHandCursor: true });
      const launchText = this.scene.add.text(640, 485, 'ENTER LIGHT LAB', {
        fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0.5);
      overlay.add([empty, launch, launchText]);
      launch.on('pointerdown', () => this.launch(null));
      return;
    }

    let page = 0;
    const pageSize = 6;
    const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
    let selected: DiscoveryJournalEntry = entries[0];
    const cardObjects: Phaser.GameObjects.GameObject[] = [];

    const detailPanel = this.scene.add.rectangle(895, 415, 400, 360, 0x0b1d38, 0.98)
      .setStrokeStyle(2, 0x5f78a8, 0.95);
    const detailType = this.scene.add.text(715, 265, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#facc15'
    });
    const detailTitle = this.scene.add.text(715, 292, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#ffffff', wordWrap: { width: 350 }
    });
    const detailSummary = this.scene.add.text(715, 338, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#dbeafe', lineSpacing: 3, wordWrap: { width: 350 }
    });
    const scienceLabel = this.scene.add.text(715, 430, 'WHAT YOU FOUND', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#8bd3ff'
    });
    const detailScience = this.scene.add.text(715, 452, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#cbd5e1', lineSpacing: 4, wordWrap: { width: 350 }
    });
    const replayHint = this.scene.add.text(715, 525, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#c4b5fd', lineSpacing: 3, wordWrap: { width: 350 }
    });
    const replayBox = this.scene.add.rectangle(895, 588, 260, 52, 0x4338ca, 1)
      .setStrokeStyle(3, 0xc4b5fd, 1).setInteractive({ useHandCursor: true });
    const replayText = this.scene.add.text(895, 588, 'TRY IT AGAIN', {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    overlay.add([detailPanel, detailType, detailTitle, detailSummary, scienceLabel, detailScience, replayHint, replayBox, replayText]);

    const updateDetail = (entry: DiscoveryJournalEntry) => {
      selected = entry;
      detailType.setText(entry.kind === 'secret' ? '✦ SECRET DISCOVERY' : 'DISCOVERY');
      detailType.setColor(entry.kind === 'secret' ? '#ffe27c' : '#8bd3ff');
      detailTitle.setText(entry.title);
      detailSummary.setText(entry.summary);
      detailScience.setText(entry.science);
      replayHint.setText(`TRY THIS: ${entry.replayPrompt}`);
    };
    updateDetail(selected);
    replayBox.on('pointerdown', () => this.launch(selected));

    const pageText = this.scene.add.text(425, 637, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#94a3b8'
    }).setOrigin(0.5);
    const prev = this.scene.add.rectangle(260, 637, 96, 36, 0x172033, 1)
      .setStrokeStyle(2, 0x475569, 0.85).setInteractive({ useHandCursor: true });
    const prevText = this.scene.add.text(260, 637, '◀ PREV', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#dbeafe'
    }).setOrigin(0.5);
    const next = this.scene.add.rectangle(590, 637, 96, 36, 0x172033, 1)
      .setStrokeStyle(2, 0x475569, 0.85).setInteractive({ useHandCursor: true });
    const nextText = this.scene.add.text(590, 637, 'NEXT ▶', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#dbeafe'
    }).setOrigin(0.5);
    overlay.add([pageText, prev, prevText, next, nextText]);

    const renderPage = () => {
      cardObjects.forEach((object) => object.destroy());
      cardObjects.length = 0;
      const start = page * pageSize;
      const pageEntries = entries.slice(start, start + pageSize);
      pageText.setText(`PAGE ${page + 1} OF ${pageCount}`);
      prev.setAlpha(page === 0 ? 0.35 : 1);
      prevText.setAlpha(page === 0 ? 0.35 : 1);
      next.setAlpha(page >= pageCount - 1 ? 0.35 : 1);
      nextText.setAlpha(page >= pageCount - 1 ? 0.35 : 1);

      pageEntries.forEach((entry, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 245 + col * 205;
        const y = 198 + row * 128;
        const secret = entry.kind === 'secret';
        const card = this.scene.add.rectangle(x, y, 184, 108, secret ? 0x3b2b18 : 0x17233a, 0.98)
          .setStrokeStyle(3, secret ? 0xf2c94c : 0x64748b, secret ? 0.95 : 0.8)
          .setInteractive({ useHandCursor: true });
        const type = this.scene.add.text(x, y - 36, secret ? '✦ SECRET' : 'DISCOVERY', {
          fontFamily: 'Arial, sans-serif', fontSize: '8px', fontStyle: 'bold', color: secret ? '#ffe27c' : '#8bd3ff'
        }).setOrigin(0.5);
        const cardTitle = this.scene.add.text(x, y - 8, entry.title, {
          fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffffff', align: 'center', wordWrap: { width: 164 }
        }).setOrigin(0.5);
        const world = this.scene.add.text(x, y + 34, worldLabel(entry.worldId), {
          fontFamily: 'Arial, sans-serif', fontSize: '8px', color: '#94a3b8'
        }).setOrigin(0.5);
        overlay.add([card, type, cardTitle, world]);
        cardObjects.push(card, type, cardTitle, world);
        card.on('pointerdown', () => updateDetail(entry));
      });
    };

    prev.on('pointerdown', () => {
      if (page <= 0) return;
      page -= 1;
      renderPage();
    });
    next.on('pointerdown', () => {
      if (page >= pageCount - 1) return;
      page += 1;
      renderPage();
    });
    renderPage();
  }

  public close(): void {
    this.overlay?.destroy(true);
    this.overlay = undefined;
  }

  private launch(entry: DiscoveryJournalEntry | null): void {
    const worldId = entry?.worldId ?? 'shadow-chase';
    this.progressStore.setLastWorld(worldId);
    this.close();
    this.scene.scene.start(sceneKeyForWorld(worldId), entry ? {
      replayFocus: entry.id,
      replayKind: entry.kind,
      replayPrompt: entry.replayPrompt
    } : undefined);
  }
}
