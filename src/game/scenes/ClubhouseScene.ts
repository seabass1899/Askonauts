import Phaser from 'phaser';
import { PlayerProgressStore } from '../progress/PlayerProgressStore';
import type { AskonautAccentId, AskonautAvatarId, AskonautIdentity } from '../progress/PlayerProgressStore';
import { buildQuestionTree } from '../questions/QuestionTree';
import type { QuestionTreeNode, QuestionNodeState } from '../questions/QuestionTree';
import { buildDiscoveryJournal, countJournalSecrets } from '../discoveries/DiscoveryJournal';
import type { DiscoveryJournalEntry } from '../discoveries/DiscoveryJournal';
import { MasteryProgress } from '../progress/MasteryProgress';
import type { MissionMasteryId } from '../progress/MasteryProgress';
import { VoiceDirector, type CharacterVoice } from '../systems/VoiceDirector';
import { AudioManager } from '../systems/AudioManager';
import { GlobalGameUI } from '../ui/GlobalGameUI';
import { BUILD_ID } from '../../buildInfo';

const W = 1280;
const H = 720;

export class ClubhouseScene extends Phaser.Scene {
  private progressStore!: PlayerProgressStore;
  private masteryProgress!: MasteryProgress;
  private voice!: VoiceDirector;
  private audio!: AudioManager;
  private bubble?: Phaser.GameObjects.Container;
  private quipTapIndex = 0;
  private identityOverlay?: Phaser.GameObjects.Container;
  private questionTreeOverlay?: Phaser.GameObjects.Container;
  private discoveryJournalOverlay?: Phaser.GameObjects.Container;
  private derivedDiscoveryOverlay?: Phaser.GameObjects.Container;
  private missionBoardOverlay?: Phaser.GameObjects.Container;
  private identityDom?: HTMLDivElement;
  private starTapCount = 0;
  private lastStarTapAt = 0;
  private constellationCooldown = false;

  constructor() {
    super('ClubhouseScene');
  }

  preload(): void {
    this.load.image('club-veya-p51-hf1', '/assets/characters/clubhouse/veya-clubhouse-p51-hf1.webp');
    this.load.image('club-teyo-p51-hf1', '/assets/characters/clubhouse/teyo-clubhouse-p51-hf1.webp');
    this.load.image('club-quip-p60a', '/assets/characters/quip/quip-clubhouse-p60a.webp');
    this.load.image('clubhouse-observatory-p61-hf2', '/assets/clubhouse/clubhouse-observatory-p61-hf2.webp');
this.load.image('p63-discovery-panel', '/assets/clubhouse/p63/discovery_crop.webp');
this.load.image('p63-trophy-panel', '/assets/clubhouse/p63/trophies_crop.webp');
this.load.image('p63-compass-panel', '/assets/clubhouse/p63/compass_crop.webp');
this.load.image('p63-mission-panel', '/assets/clubhouse/p63/mission_crop.webp');
this.load.image('p63-gate-panel', '/assets/clubhouse/p63/gate_crop.webp');
this.load.image('p63-spark-panel', '/assets/clubhouse/p63/spark_crop.webp');
  }

  create(): void {
    this.progressStore = new PlayerProgressStore();
    this.masteryProgress = new MasteryProgress();
    this.audio = new AudioManager(this);
    this.voice = this.audio.voice;
    const shadow = this.progressStore.getWorldProgress('shadow-chase');
    const reflection = this.progressStore.getWorldProgress('reflection-hunt');
    const spoon = this.progressStore.getWorldProgress('upside-down-spoon');
    const funhouse = this.progressStore.getWorldProgress('funhouse-mirrors');
    const totalSparks = this.progressStore.getTotalSparks();
    const shadowMissionReady = shadow.completed && shadow.discoveries.includes('large_shadow') && shadow.discoveries.includes('small_shadow') && shadow.secrets.length > 0;
    this.masteryProgress.syncShadowQuestComplete(shadowMissionReady);
    const mastery = this.masteryProgress.getSnapshot();

    this.cameras.main.setBackgroundColor('#060b14');
    this.drawRoom();
    const identity = this.progressStore.getIdentity();
    this.createHeader(totalSparks, identity, mastery.rankLabel, mastery.completedCount, mastery.totalMissions);
    new GlobalGameUI(this, this.progressStore, this.audio, {
      renderButtons: true, compact: true, showClubhouse: false, startX: 1116, y: 47,
      buttonWidth: 38, buttonHeight: 38, gap: 42
    });
    this.createStarWindow();
    this.createDiscoveryWall();
    this.createSparkVessel(totalSparks, mastery.completedCount);
    this.createQuestionCompass();
    this.createMissionBoard();
    this.createEvolvingClubhouse(
      shadow.completed,
      reflection.completed,
      spoon.completed,
      funhouse.completed,
      mastery.rankIndex,
      mastery.completedCount
    );
    this.createQuestionGate(shadow.completed, reflection.completed, spoon.completed);
    this.createWorkbench();
    this.createCharacters(identity.name);
    this.createWelcome(identity.name);
    // P6.3-HF2: no automatic TAP rings; the illustrated UI already communicates affordances.
    if (identity.complete && this.masteryProgress.hasUncelebratedRankUp()) {
      this.time.delayedCall(950, () => this.showRankUpCelebration());
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyIdentityDom());
    if (!identity.complete) {
      this.time.delayedCall(350, () => this.showIdentitySetup(false));
    }
  }

  private drawRoom(): void {
    // P6.1-HF2: illustrated environment layer. Dynamic UI remains live Phaser objects above it.
    const bg = this.add.image(W / 2, H / 2, 'clubhouse-observatory-p61-hf2').setDepth(0);
    const sx = W / bg.width;
    const sy = H / bg.height;
    bg.setScale(Math.max(sx, sy));

    // Subtle readability veil keeps live labels legible without flattening the artwork.
    this.add.rectangle(W / 2, 46, W, 92, 0x031022, 0.78).setDepth(1);
    this.add.rectangle(W / 2, 690, W, 60, 0x04101f, 0.18).setDepth(1);

    // Gentle ambient light bloom around the character stage.
    const stageGlow = this.add.ellipse(660, 620, 520, 130, 0x4b56ff, 0.06).setDepth(1);
    this.tweens.add({
      targets: stageGlow,
      alpha: { from: 0.035, to: 0.11 },
      scaleX: { from: 0.96, to: 1.04 },
      scaleY: { from: 0.96, to: 1.04 },
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  private createHeader(totalSparks: number, identity: AskonautIdentity, rankLabel: string, masteryCount: number, masteryTotal: number): void {
    // P6.1 unified command bar.
    const rail = this.add.container(0, 0).setDepth(30);
    const bg = this.add.rectangle(640, 47, 1280, 86, 0x061327, 0.995).setStrokeStyle(2, 0xe4b54f, 0.72);
    const goldLine = this.add.rectangle(640, 89, 1280, 3, 0xd9aa45, 0.72);
    rail.add([bg, goldLine]);

    const logo = this.add.text(42, 22, '✦ ASKONAUTS', {
      fontFamily: 'Arial, sans-serif', fontSize: '31px', fontStyle: 'bold', color: '#ffd75f',
      stroke: '#0b2a57', strokeThickness: 5
    });
    const sub = this.add.text(62, 59, `THE CLUBHOUSE  •  ${BUILD_ID}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#9edcff', letterSpacing: 1.2
    });
    rail.add([logo, sub]);

    const makeChip = (x: number, w: number, border: number) => {
      const c = this.add.container(x, 47);
      const r = this.add.rectangle(0, 0, w, 52, 0x0c1b34, 0.98).setStrokeStyle(2, border, 0.9);
      c.add(r); rail.add(c); return c;
    };

    const masteryChip = makeChip(690, 166, 0xe0b64e);
    masteryChip.add([
      this.add.text(-62, 0, '★', { fontSize: '20px', color: '#ffe16e' }).setOrigin(0.5),
      this.add.text(16, -8, rankLabel, { fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffe9a8' }).setOrigin(0.5),
      this.add.text(16, 11, `${masteryCount}/${masteryTotal} MISSIONS`, { fontFamily: 'Arial, sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#9fb3cf' }).setOrigin(0.5)
    ]);

    const accent = this.accentColor(identity.accentId);
    const identityChip = makeChip(875, 172, accent);
    const identityHit = identityChip.list[0] as Phaser.GameObjects.Rectangle;
    identityHit.setInteractive({ useHandCursor: true });
    identityChip.add([
      this.add.text(-60, 0, this.avatarSymbol(identity.avatarId), { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: Phaser.Display.Color.IntegerToColor(accent).rgba }).setOrigin(0.5),
      this.add.text(15, -8, identity.name || 'ASKONAUT', { fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5),
      this.add.text(15, 11, identity.complete ? 'MY ASKONAUT' : 'CREATE ASKONAUT', { fontFamily: 'Arial, sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#a9b8cd' }).setOrigin(0.5)
    ]);
    identityHit.on('pointerdown', () => this.showIdentitySetup(true));

    const sparkChip = makeChip(1054, 164, 0xe0b64e);
    const star = this.add.text(-56, 0, '✦', { fontSize: '22px', color: '#ffe27c' }).setOrigin(0.5);
    sparkChip.add([star, this.add.text(14, 0, `${totalSparks} SPARKS`, { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#fff4c1' }).setOrigin(0.5)]);
    this.tweens.add({ targets: star, angle: 12, scale: 1.14, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // P6.4C: global utilities are rendered by GlobalGameUI after the header is created.
  }

  private createStarWindow(): void {
    // P6.3-HF2: the illustrated Star Window already carries its visual identity.
    // Keep only a transparent hotspot plus a very subtle focus pulse.
    const x = 145;
    const y = 274;
    const focus = this.add.circle(x, y, 96, 0x59c7ff, 0.001)
      .setStrokeStyle(2, 0x8fdcff, 0.08).setDepth(4);
    const hit = this.add.circle(x, y, 100, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true }).setDepth(7);
    hit.on('pointerdown', () => this.handleStarWindowTap(x, y));
    this.tweens.add({ targets: focus, alpha: { from: 0.001, to: 0.035 }, scale: { from: 0.985, to: 1.02 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  private handleStarWindowTap(windowX: number, windowY: number): void {
    this.playShootingStar(windowX, windowY);
    if (this.constellationCooldown) return;
    const now = this.time.now;
    this.starTapCount = now - this.lastStarTapAt <= 2200 ? this.starTapCount + 1 : 1;
    this.lastStarTapAt = now;
    if (this.starTapCount >= 3) {
      this.starTapCount = 0;
      this.playConstellationSurprise(windowX, windowY);
    }
  }

  private playConstellationSurprise(windowX: number, windowY: number): void {
    this.constellationCooldown = true;
    const layer = this.add.container(0, 0).setDepth(42);
    const constellation = [[windowX-55,windowY-38],[windowX-22,windowY-60],[windowX+8,windowY-25],[windowX+48,windowY-52],[windowX+60,windowY-10],[windowX+24,windowY+22]];
    const g = this.add.graphics();
    g.lineStyle(2, 0x8bd3ff, 0.85);
    for (let i = 0; i < constellation.length - 1; i++) {
      const [x1,y1] = constellation[i]; const [x2,y2] = constellation[i+1];
      g.lineBetween(x1,y1,x2,y2);
    }
    layer.add(g);
    constellation.forEach(([sx,sy], i) => {
      const s = this.add.text(sx, sy, i % 2 ? '✦' : '★', { fontSize: '15px', color: '#fff2a8' }).setOrigin(0.5);
      layer.add(s);
    });
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 280, yoyo: true, hold: 2600, onComplete: () => layer.destroy(true) });
    this.showBubble(610, 476, 'QUIP', 'You found a secret constellation! Okay... the window really IS suspicious.', 5200, '#ffe384');
    this.time.delayedCall(5200, () => { this.constellationCooldown = false; });
  }

  private playShootingStar(windowX: number, windowY: number): void {
    const star = this.add.text(windowX - 70, windowY - 60, '✦', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#fff2a8'
    }).setDepth(30);
    const trail = this.add.line(0, 0, windowX - 72, windowY - 54, windowX - 42, windowY - 35, 0xffe27c, 0.7).setOrigin(0).setDepth(29);
    this.tweens.add({
      targets: [star, trail],
      x: '+=110',
      y: '+=55',
      alpha: 0,
      duration: 650,
      ease: 'Quad.Out',
      onComplete: () => { star.destroy(); trail.destroy(); }
    });
    this.showBubble(610, 476, 'QUIP', 'I saw that! The window is definitely suspicious.', 2500, '#a78bfa');
  }

private createDiscoveryWall(): void {
  const x = 205;
  const y = 298;
  const skin = this.add.image(x, y, 'p63-discovery-panel').setDepth(8);
  skin.setDisplaySize(372, 342);
  const hit = this.add.rectangle(x, y, 360, 330, 0xffffff, 0.001)
    .setInteractive({ useHandCursor: true }).setDepth(15);
  hit.on('pointerdown', () => this.showDiscoveryJournal());
}
  private showDiscoveryJournal(): void {
    this.discoveryJournalOverlay?.destroy(true);
    this.bubble?.destroy(true);

    const entries = buildDiscoveryJournal(this.progressStore.getSnapshot());
    const overlay = this.add.container(0, 0).setDepth(230);
    this.discoveryJournalOverlay = overlay;

    const dim = this.add.rectangle(640, 360, W, H, 0x020617, 0.76).setInteractive();
    const panel = this.add.rectangle(640, 360, 1080, 620, 0x06152d, 0.965)
      .setStrokeStyle(3, 0xf2c45c, 0.98);
    const title = this.add.text(640, 74, 'DISCOVERY JOURNAL', {
      fontFamily: 'Arial, sans-serif', fontSize: '31px', fontStyle: 'bold', color: '#ffd966', stroke: '#17325d', strokeThickness: 3
    }).setOrigin(0.5);
    const subtitle = this.add.text(640, 108, entries.length > 0
      ? `${entries.length} discoveries collected  •  ${countJournalSecrets(entries)} secrets`
      : 'Your discoveries will appear here as you explore.', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#cbd5e1'
    }).setOrigin(0.5);
    const closeBox = this.add.rectangle(1110, 76, 82, 38, 0x102443, 1)
      .setStrokeStyle(2, 0xa78bfa, 0.95).setInteractive({ useHandCursor: true });
    const closeText = this.add.text(1110, 76, 'CLOSE', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#e2e8f0'
    }).setOrigin(0.5);
    overlay.add([dim, panel, title, subtitle, closeBox, closeText]);
    closeBox.on('pointerdown', () => this.closeDiscoveryJournal());

    if (entries.length === 0) {
      const empty = this.add.text(640, 345,
        'No discoveries yet.\n\nEnter the Light Lab and follow your curiosity.\nThe Journal will remember what you find.', {
        fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#dbeafe', align: 'center', lineSpacing: 10
      }).setOrigin(0.5);
      const launch = this.add.rectangle(640, 485, 280, 58, 0x4338ca, 1)
        .setStrokeStyle(3, 0xc4b5fd, 1).setInteractive({ useHandCursor: true });
      const launchText = this.add.text(640, 485, 'ENTER LIGHT LAB', {
        fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0.5);
      overlay.add([empty, launch, launchText]);
      launch.on('pointerdown', () => this.launchJournalExperiment(null));
      return;
    }

    let page = 0;
    const pageSize = 6;
    const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
    let selected: DiscoveryJournalEntry | null = entries[0] ?? null;
    const cardObjects: Phaser.GameObjects.GameObject[] = [];

    const detailPanel = this.add.rectangle(895, 415, 400, 360, 0x0b1d38, 0.965)
      .setStrokeStyle(2, 0x5f78a8, 0.95);
    const detailType = this.add.text(715, 265, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#facc15'
    });
    const detailTitle = this.add.text(715, 292, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
      wordWrap: { width: 350 }
    });
    const detailSummary = this.add.text(715, 338, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#dbeafe', lineSpacing: 3,
      wordWrap: { width: 350 }
    });
    const scienceLabel = this.add.text(715, 430, 'WHAT YOU FOUND', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#8bd3ff'
    });
    const detailScience = this.add.text(715, 452, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#cbd5e1', lineSpacing: 4,
      wordWrap: { width: 350 }
    });
    const replayHint = this.add.text(715, 525, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#c4b5fd', lineSpacing: 3,
      wordWrap: { width: 350 }
    });
    const replayBox = this.add.rectangle(895, 588, 260, 52, 0x4338ca, 1)
      .setStrokeStyle(3, 0xc4b5fd, 1).setInteractive({ useHandCursor: true });
    const replayText = this.add.text(895, 588, 'TRY IT AGAIN', {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    overlay.add([detailPanel, detailType, detailTitle, detailSummary, scienceLabel, detailScience, replayHint, replayBox, replayText]);

    const updateDetail = (entry: DiscoveryJournalEntry) => {
      selected = entry;
      detailType.setText(entry.kind === 'secret' ? '✦ LIGHT LAB SECRET' : 'DISCOVERY');
      detailType.setColor(entry.kind === 'secret' ? '#ffe27c' : '#8bd3ff');
      detailTitle.setText(entry.title);
      detailSummary.setText(entry.summary);
      detailScience.setText(entry.science);
      replayHint.setText(`TRY THIS: ${entry.replayPrompt}`);
    };
    updateDetail(entries[0]);
    replayBox.on('pointerdown', () => this.launchJournalExperiment(selected));

    const pageText = this.add.text(425, 637, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#94a3b8'
    }).setOrigin(0.5);
    const prev = this.add.rectangle(260, 637, 96, 36, 0x172033, 1)
      .setStrokeStyle(2, 0x475569, 0.85).setInteractive({ useHandCursor: true });
    const prevText = this.add.text(260, 637, '◀ PREV', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#dbeafe'
    }).setOrigin(0.5);
    const next = this.add.rectangle(590, 637, 96, 36, 0x172033, 1)
      .setStrokeStyle(2, 0x475569, 0.85).setInteractive({ useHandCursor: true });
    const nextText = this.add.text(590, 637, 'NEXT ▶', {
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
        const card = this.add.rectangle(x, y, 184, 108, secret ? 0x3b2b18 : 0x17233a, 0.98)
          .setStrokeStyle(3, secret ? 0xf2c94c : 0x64748b, secret ? 0.95 : 0.8)
          .setInteractive({ useHandCursor: true });
        const type = this.add.text(x, y - 36, secret ? '✦ SECRET' : 'DISCOVERY', {
          fontFamily: 'Arial, sans-serif', fontSize: '8px', fontStyle: 'bold', color: secret ? '#ffe27c' : '#8bd3ff'
        }).setOrigin(0.5);
        const cardTitle = this.add.text(x, y - 8, entry.title, {
          fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffffff',
          align: 'center', wordWrap: { width: 164 }
        }).setOrigin(0.5);
        const worldLabel = entry.worldId === 'reflection-hunt'
          ? 'REFLECTION LAB • REFLECTION HUNT'
          : entry.worldId === 'upside-down-spoon'
            ? 'SPOON LAB • UPSIDE-DOWN SPOON'
            : 'LIGHT LAB • SHADOW CHASE';
        const world = this.add.text(x, y + 34, worldLabel, {
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

  private closeDiscoveryJournal(): void {
    this.discoveryJournalOverlay?.destroy(true);
    this.discoveryJournalOverlay = undefined;
  }

  private launchJournalExperiment(entry: DiscoveryJournalEntry | null): void {
    this.registry.set('askonauts.journalReplayFocus', entry?.id ?? null);
    this.registry.set('askonauts.journalReplayKind', entry?.kind ?? null);
    this.registry.set('askonauts.journalReplayPrompt', entry?.replayPrompt ?? null);
    const worldId = entry?.worldId ?? 'shadow-chase';
    this.progressStore.setLastWorld(worldId);
    this.closeDiscoveryJournal();
    const sceneKey = worldId === 'reflection-hunt'
      ? 'ReflectionHuntScene'
      : worldId === 'upside-down-spoon'
        ? 'UpsideDownSpoonScene'
        : worldId === 'funhouse-mirrors'
          ? 'FunhouseMirrorsScene'
          : 'ShadowBoxScene';
    this.scene.start(sceneKey, entry ? {
      replayFocus: entry.id,
      replayKind: entry.kind,
      replayPrompt: entry.replayPrompt
    } : undefined);
  }

private createSparkVessel(totalSparks: number, masteryCount: number): void {
  const x = 1108;
  const y = 566;
  const skin = this.add.image(x, y, 'p63-spark-panel').setDepth(8);
  skin.setDisplaySize(300, 235);
  const hit = this.add.rectangle(x, y, 278, 214, 0xffffff, 0.001).setInteractive({ useHandCursor: true }).setDepth(15);
  hit.on('pointerdown', () => this.showBubble(x - 10, y - 145, 'CURIOSITY SPARKS', totalSparks > 0 ? `${totalSparks} sparks from things you discovered.` : 'Every real discovery can light this vessel.', 4200, '#facc15'));
  // P6.3-HF1: avoid duplicating the count/state baked into the canonical vessel art.
  // The authoritative live Spark total remains in the header.
  if (masteryCount >= 4) {
    const glow = this.add.circle(x - 92, y + 84, 10, 0xffe384, 0.16).setDepth(16);
    this.tweens.add({ targets: glow, alpha: { from: 0.06, to: 0.28 }, scale: { from: 0.9, to: 1.18 }, duration: 950, yoyo: true, repeat: -1 });
  }
}
private createEvolvingClubhouse(
  shadowCompleted: boolean,
  reflectionCompleted: boolean,
  spoonCompleted: boolean,
  funhouseCompleted: boolean,
  rankIndex: number,
  masteryCount: number
): void {
  const x = 205;
  const y = 548;
  const skin = this.add.image(x, y, 'p63-trophy-panel').setDepth(8);
  skin.setDisplaySize(386, 182);
  const trophyData = [
    { x: 86, unlocked: shadowCompleted, title: 'SHADOW CHASE', line: 'You learned how light, blockers, and distance shape a shadow.' },
    { x: 157, unlocked: reflectionCompleted, title: 'REFLECTION HUNT', line: 'You steered reflected light and learned that angle matters.' },
    { x: 229, unlocked: spoonCompleted, title: 'UPSIDE-DOWN SPOON', line: 'You discovered how curved reflections change with distance.' },
    { x: 301, unlocked: funhouseCompleted, title: 'FUNHOUSE MIRRORS', line: 'You used mirror shape to stretch, squash, and warp a reflection.' }
  ];
  trophyData.forEach((t) => {
    if (!t.unlocked) return;
    const hit = this.add.circle(x - 193 + t.x, y + 12, 28, 0xffffff, 0.001).setInteractive({ useHandCursor: true }).setDepth(15);
    hit.on('pointerdown', () => this.showBubble(x - 193 + t.x, y - 104, t.title, t.line, 5200, '#ffe384'));
  });
  // P6.3-HF1: mastery/rank decoration is already represented in the canonical trophy art and header.
  void rankIndex;
  void masteryCount;
}
private createQuestionCompass(): void {
  const x = 650;
  const y = 276;
  const skin = this.add.image(x, y, 'p63-compass-panel').setDepth(8);
  skin.setDisplaySize(342, 296);
  const hit = this.add.circle(x, y + 30, 98, 0xffffff, 0.001)
    .setInteractive({ useHandCursor: true }).setDepth(15);
  hit.on('pointerdown', () => this.showQuestionTree());
  const pulse = this.add.circle(x, y + 28, 64, 0x38bdf8, 0.002).setDepth(14);
  this.tweens.add({ targets:pulse, alpha:{from:0.001,to:0.06}, scale:{from:0.96,to:1.07}, duration:1450, yoyo:true, repeat:-1, ease:'Sine.InOut' });
}
  private showQuestionTree(): void {
    this.questionTreeOverlay?.destroy(true);
    this.bubble?.destroy(true);

    const nodes = buildQuestionTree(this.progressStore.getSnapshot());
    const overlay = this.add.container(0, 0).setDepth(220);
    this.questionTreeOverlay = overlay;

    const dim = this.add.rectangle(640, 360, W, H, 0x020617, 0.74).setInteractive();
    const panel = this.add.rectangle(640, 360, 1080, 610, 0x091426, 0.985)
      .setStrokeStyle(4, 0xd6ad54, 0.95);
    const title = this.add.text(640, 86, 'THE QUESTION TREE', {
      fontFamily: 'Arial, sans-serif', fontSize: '31px', fontStyle: 'bold', color: '#ffd966', stroke: '#17325d', strokeThickness: 3
    }).setOrigin(0.5);
    const subtitle = this.add.text(640, 122, 'Every answer can grow a new question.', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#cbd5e1'
    }).setOrigin(0.5);
    const closeBox = this.add.rectangle(1110, 86, 82, 38, 0x102443, 1)
      .setStrokeStyle(2, 0xa78bfa, 0.95).setInteractive({ useHandCursor: true });
    const closeText = this.add.text(1110, 86, 'CLOSE', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#e2e8f0'
    }).setOrigin(0.5);
    overlay.add([dim, panel, title, subtitle, closeBox, closeText]);
    closeBox.on('pointerdown', () => this.closeQuestionTree());

    const positions: Record<string, { x: number; y: number }> = {
      'shadow-chase': { x: 640, y: 195 },
      'shadow-size': { x: 380, y: 340 },
      'reflection-hunt': { x: 850, y: 340 },
      'two-shadows': { x: 260, y: 500 },
      'spoon-reflection': { x: 825, y: 475 },
      'funhouse-mirrors': { x: 990, y: 585 }
    };

    const lines = this.add.graphics();
    overlay.add(lines);
    nodes.forEach((node) => {
      if (!node.parentId) return;
      const from = positions[node.parentId];
      const to = positions[node.id];
      const alpha = node.state === 'mystery' ? 0.22 : 0.62;
      const color = node.state === 'completed' ? 0xf2c94c : node.state === 'discovered' ? 0xa78bfa : 0x60a5fa;
      lines.lineStyle(4, color, alpha);
      lines.lineBetween(from.x, from.y + 50, to.x, to.y - 50);
    });

    // Keep the guidance panel in the lower-left so the growing right-hand branch
    // has room for Spoon → Funhouse without card overlap.
    const detailBg = this.add.rectangle(485, 615, 580, 46, 0x10192b, 0.96).setStrokeStyle(2, 0x334155, 0.9);
    const detail = this.add.text(485, 615, 'Tap a question to see where curiosity leads.', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#dbeafe', align: 'center',
      wordWrap: { width: 540 }
    }).setOrigin(0.5);
    overlay.add([detailBg, detail]);

    nodes.forEach((node) => {
      const pos = positions[node.id];
      this.createQuestionTreeNode(overlay, node, pos.x, pos.y, detail);
    });
  }

  private createQuestionTreeNode(
    overlay: Phaser.GameObjects.Container,
    node: QuestionTreeNode,
    x: number,
    y: number,
    detail: Phaser.GameObjects.Text
  ): void {
    const style = this.questionNodeStyle(node.state);
    const box = this.add.rectangle(x, y, 248, 102, style.fill, 0.98)
      .setStrokeStyle(node.state === 'mystery' ? 2 : 4, style.stroke, style.alpha)
      .setInteractive({ useHandCursor: true });
    const worldNode = node.id === 'shadow-chase' || node.id === 'reflection-hunt' || node.id === 'spoon-reflection' || node.id === 'funhouse-mirrors';
    const stateText = worldNode && node.state === 'completed' ? 'COMPLETED • TAP TO REVISIT' : style.label;
    const stateLabel = this.add.text(x, y - 34, stateText, {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', fontStyle: 'bold', color: style.text
    }).setOrigin(0.5);
    const title = this.add.text(x, y - 10, node.state === 'mystery' ? '???' : node.title, {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: node.state === 'mystery' ? '#94a3b8' : '#ffffff'
    }).setOrigin(0.5);
    const question = this.add.text(x, y + 22, node.state === 'mystery' ? 'A question is still hiding here.' : node.question, {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', color: node.state === 'mystery' ? '#64748b' : '#dbeafe',
      align: 'center', wordWrap: { width: 220 }
    }).setOrigin(0.5);
    overlay.add([box, stateLabel, title, question]);

    if (node.state === 'completed') {
      const spark = this.add.text(x + 105, y - 42, '✦', { fontSize: '15px', color: '#ffe27c' }).setOrigin(0.5);
      overlay.add(spark);
      this.tweens.add({ targets: spark, scale: { from: 0.85, to: 1.2 }, alpha: { from: 0.55, to: 1 }, duration: 800, yoyo: true, repeat: -1 });
    }

    box.on('pointerdown', () => {
      if (node.id === 'shadow-chase') {
        detail.setText(node.state === 'completed'
          ? 'Revisiting Shadow Chase — return to the Light Lab and experiment again.'
          : 'Entering Shadow Chase — investigate why shadows follow us.');
        this.progressStore.setLastWorld('shadow-chase');
        this.closeQuestionTree();
        this.scene.start('ShadowBoxScene');
        return;
      }

      if (node.id === 'reflection-hunt' && node.state !== 'mystery') {
        detail.setText(node.state === 'completed'
          ? 'Revisiting Reflection Hunt — return to the Reflection Lab and experiment again.'
          : 'Entering Reflection Hunt — investigate why we can see ourselves in some things.');
        this.progressStore.setLastWorld('reflection-hunt');
        this.closeQuestionTree();
        this.scene.start('ReflectionHuntScene');
        return;
      }

      if (node.id === 'spoon-reflection' && node.state !== 'mystery') {
        detail.setText(node.state === 'completed'
          ? 'Revisiting Upside-Down Spoon — return to the Spoon Lab and experiment again.'
          : 'Entering Upside-Down Spoon — investigate why a spoon can flip your reflection.');
        this.progressStore.setLastWorld('upside-down-spoon');
        this.closeQuestionTree();
        this.scene.start('UpsideDownSpoonScene');
        return;
      }

      if (node.id === 'funhouse-mirrors' && node.state !== 'mystery') {
        detail.setText(node.state === 'completed'
          ? 'Revisiting Funhouse Mirrors — return to the Mirror Hall and experiment again.'
          : 'Entering Funhouse Mirrors — investigate why curved mirrors stretch and squash reflections.');
        this.progressStore.setLastWorld('funhouse-mirrors');
        this.closeQuestionTree();
        this.scene.start('FunhouseMirrorsScene');
        return;
      }

      if (node.id === 'shadow-size' && node.state === 'completed') {
        this.closeQuestionTree();
        this.showDerivedDiscoveryDetail(
          'SHADOW SIZE',
          'Why does a shadow change size?',
          'You discovered that changing the distance between an object and the light changes the shadow size.',
          'Move Quip closer to the lamp for a giant shadow, then farther away for a smaller one.'
        );
        return;
      }

      if (node.state === 'completed') {
        detail.setText(`${node.question} You found evidence for this while experimenting in Shadow Chase.`);
      } else if (node.state === 'discovered') {
        detail.setText(`${node.question} New question detected. Keep exploring to open its world.`);
      } else if (node.state === 'available') {
        detail.setText(`${node.question} This question is ready to investigate.`);
      } else {
        detail.setText('That question is still hiding. Discoveries elsewhere in the tree may reveal it.');
      }
    });
  }

  private questionNodeStyle(state: QuestionNodeState): { fill: number; stroke: number; text: string; label: string; alpha: number } {
    if (state === 'completed') return { fill: 0x30254e, stroke: 0xf2c94c, text: '#ffe384', label: 'COMPLETED', alpha: 1 };
    if (state === 'available') return { fill: 0x132d45, stroke: 0x38bdf8, text: '#8bd3ff', label: 'READY TO EXPLORE', alpha: 1 };
    if (state === 'discovered') return { fill: 0x2d2350, stroke: 0xa78bfa, text: '#c4b5fd', label: 'NEW QUESTION', alpha: 1 };
    return { fill: 0x111827, stroke: 0x475569, text: '#94a3b8', label: 'MYSTERY', alpha: 0.72 };
  }

  private showDerivedDiscoveryDetail(
    title: string,
    question: string,
    science: string,
    replayPrompt: string
  ): void {
    this.derivedDiscoveryOverlay?.destroy(true);
    const overlay = this.add.container(0, 0).setDepth(225);
    this.derivedDiscoveryOverlay = overlay;

    const dim = this.add.rectangle(640, 360, W, H, 0x020617, 0.76).setInteractive();
    const panel = this.add.rectangle(640, 360, 760, 470, 0x06152d, 0.965)
      .setStrokeStyle(3, 0xf2c45c, 0.98);
    const type = this.add.text(640, 165, 'DISCOVERY FROM SHADOW CHASE', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#8bd3ff'
    }).setOrigin(0.5);
    const heading = this.add.text(640, 210, title, {
      fontFamily: 'Arial, sans-serif', fontSize: '31px', fontStyle: 'bold', color: '#ffd966', stroke: '#17325d', strokeThickness: 3
    }).setOrigin(0.5);
    const q = this.add.text(640, 252, question, {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffffff', align: 'center'
    }).setOrigin(0.5);
    const foundLabel = this.add.text(365, 307, 'WHAT YOU FOUND', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#8bd3ff'
    });
    const found = this.add.text(365, 332, science, {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#dbeafe', lineSpacing: 6,
      wordWrap: { width: 550 }
    });
    const tryLabel = this.add.text(365, 408, `TRY THIS: ${replayPrompt}`, {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#c4b5fd', lineSpacing: 4,
      wordWrap: { width: 550 }
    });
    const replayBox = this.add.rectangle(540, 505, 260, 58, 0x4338ca, 1)
      .setStrokeStyle(3, 0xc4b5fd, 1).setInteractive({ useHandCursor: true });
    const replayText = this.add.text(540, 505, 'TRY IT AGAIN', {
      fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const closeBox = this.add.rectangle(795, 505, 170, 58, 0x102443, 1)
      .setStrokeStyle(2, 0xa78bfa, 0.95).setInteractive({ useHandCursor: true });
    const closeText = this.add.text(795, 505, 'BACK TO TREE', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#e2e8f0'
    }).setOrigin(0.5);

    overlay.add([dim, panel, type, heading, q, foundLabel, found, tryLabel, replayBox, replayText, closeBox, closeText]);

    replayBox.on('pointerdown', () => {
      this.progressStore.setLastWorld('shadow-chase');
      this.derivedDiscoveryOverlay?.destroy(true);
      this.derivedDiscoveryOverlay = undefined;
      this.scene.start('ShadowBoxScene', {
        replayFocus: 'shadow-size',
        replayKind: 'discovery',
        replayPrompt
      });
    });

    closeBox.on('pointerdown', () => {
      this.derivedDiscoveryOverlay?.destroy(true);
      this.derivedDiscoveryOverlay = undefined;
      this.showQuestionTree();
    });
  }

  private closeQuestionTree(): void {
    this.questionTreeOverlay?.destroy(true);
    this.questionTreeOverlay = undefined;
  }

private createQuestionGate(shadowCompleted: boolean, reflectionCompleted: boolean, spoonCompleted: boolean): void {
  const x = 1135;
  const y = 323;
  const skin = this.add.image(x, y, 'p63-gate-panel').setDepth(8);
  skin.setDisplaySize(236, 365);
  const reflectionReady = shadowCompleted && !reflectionCompleted;
  const hit = this.add.rectangle(x, y + 18, 214, 330, 0xffffff, 0.001).setInteractive({ useHandCursor: true }).setDepth(15);
  hit.on('pointerdown', () => {
    if (reflectionCompleted) {
      this.showBubble(x - 60, y + 158, 'QUESTION GATE', spoonCompleted ? 'A new mystery is forming beyond the gate...' : 'Another question is forming...\nWhy does a spoon flip your reflection?', 4200, '#a78bfa');
      return;
    }
    if (reflectionReady) { this.progressStore.setLastWorld('reflection-hunt'); this.scene.start('ReflectionHuntScene'); return; }
    this.progressStore.setLastWorld('shadow-chase'); this.scene.start('ShadowBoxScene');
  });
}
private createMissionBoard(): void {
  const x = 935;
  const y = 300;
  const skin = this.add.image(x, y, 'p63-mission-panel').setDepth(8);
  skin.setDisplaySize(258, 273);
  const hit = this.add.rectangle(x, y, 246, 258, 0xffffff, 0.001).setInteractive({ useHandCursor: true }).setDepth(15);
  hit.on('pointerdown', () => this.showMissionBoard());
  // P6.3-HF1: the canonical mission panel already contains its call-to-action.
}
  private showMissionBoard(): void {
    this.missionBoardOverlay?.destroy(true);
    this.bubble?.destroy(true);

    const overlay = this.add.container(0, 0).setDepth(240);
    this.missionBoardOverlay = overlay;
    const dim = this.add.rectangle(640, 360, W, H, 0x020617, 0.78).setInteractive();
    const panel = this.add.rectangle(640, 360, 1080, 610, 0x06152d, 0.965)
      .setStrokeStyle(3, 0xf2c45c, 0.98);
    const title = this.add.text(640, 80, 'ASKONAUT MISSION BOARD', {
      fontFamily: 'Arial, sans-serif', fontSize: '31px', fontStyle: 'bold', color: '#ffd966', stroke: '#17325d', strokeThickness: 3
    }).setOrigin(0.5);
    const subtitle = this.add.text(640, 116, 'Every replay can combine new objectives, starting states, clues, and constraints.', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#cbd5e1'
    }).setOrigin(0.5);
    const closeBox = this.add.rectangle(1110, 80, 82, 38, 0x102443, 1)
      .setStrokeStyle(2, 0xa78bfa, 0.95).setInteractive({ useHandCursor: true });
    const closeText = this.add.text(1110, 80, 'CLOSE', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#e2e8f0'
    }).setOrigin(0.5);
    const mastery = this.masteryProgress.getSnapshot();
    const rankBarBg = this.add.rectangle(640, 151, 520, 34, 0x111d33, 1).setStrokeStyle(2, 0x475569, 0.9);
    const progressWidth = mastery.totalMissions > 0 ? 500 * (mastery.completedCount / mastery.totalMissions) : 0;
    const rankBarFill = this.add.rectangle(390, 151, Math.max(2, progressWidth), 20, 0xd6ad54, 0.9).setOrigin(0, 0.5);
    const rankText = this.add.text(640, 151, `${mastery.rankLabel}  •  ${mastery.completedCount}/${mastery.totalMissions} MISSIONS MASTERED`, {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#fff4c1'
    }).setOrigin(0.5);
    overlay.add([dim, panel, title, subtitle, closeBox, closeText, rankBarBg, rankBarFill, rankText]);
    closeBox.on('pointerdown', () => {
      this.missionBoardOverlay?.destroy(true);
      this.missionBoardOverlay = undefined;
    });

    const shadow = this.progressStore.getWorldProgress('shadow-chase');
    const reflection = this.progressStore.getWorldProgress('reflection-hunt');
    const spoon = this.progressStore.getWorldProgress('upside-down-spoon');
    const funhouse = this.progressStore.getWorldProgress('funhouse-mirrors');

    const missions = [
      {
        id: 'shadow-quest' as MissionMasteryId,
        title: 'SHADOW QUEST',
        world: 'SHADOW CHASE',
        guide: 'QUIP',
        description: 'Re-enter the Light Lab and deliberately make giant and tiny shadows while hunting for a secret.',
        ready: shadow.completed,
        color: 0xf59e0b,
        launch: () => {
          this.progressStore.setLastWorld('shadow-chase');
          this.scene.start('ShadowBoxScene', {
            replayFocus: 'shadow-mission', replayKind: 'mission',
            replayPrompt: 'Mission: make a giant shadow, make a tiny shadow, and uncover a secret.'
          });
        }
      },
      {
        id: 'light-rescue' as MissionMasteryId,
        title: 'LIGHT RESCUE',
        world: 'REFLECTION HUNT',
        guide: 'VEYA + TEYO',
        description: 'Replay with changing target order, starting angles, and occasional precision-rescue rules.',
        ready: reflection.completed,
        color: 0x38bdf8,
        launch: () => {
          this.progressStore.setLastWorld('reflection-hunt');
          this.scene.start('ReflectionHuntScene', { startMission: 'light-rescue' });
        }
      },
      {
        id: 'spoon-sprint' as MissionMasteryId,
        title: 'SPOON SPRINT',
        world: 'UPSIDE-DOWN SPOON',
        guide: 'QUIP',
        description: 'Recreate spoon effects with randomized order, starting states, and optional two-move bonuses.',
        ready: spoon.completed,
        color: 0xa78bfa,
        launch: () => {
          this.progressStore.setLastWorld('upside-down-spoon');
          this.scene.start('UpsideDownSpoonScene', { startMission: 'spoon-sprint' });
        }
      },
      {
        id: 'mirror-mission' as MissionMasteryId,
        title: 'MIRROR MISSION',
        world: 'FUNHOUSE MIRRORS',
        guide: 'VEYA',
        description: 'Predict mirror effects through direct prompts, riddles, or science-clue variants.',
        ready: funhouse.completed,
        color: 0x34d399,
        launch: () => {
          this.progressStore.setLastWorld('funhouse-mirrors');
          this.scene.start('FunhouseMirrorsScene', { startMission: 'mirror-mission' });
        }
      }
    ];

    missions.forEach((mission, index) => {
      const completed = this.masteryProgress.isMissionComplete(mission.id);
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 365 + col * 550;
      const y = 260 + row * 225;
      const card = this.add.rectangle(x, y, 460, 175, 0x0b1d38, 0.965)
        .setStrokeStyle(3, mission.ready ? mission.color : 0x475569, mission.ready ? 0.95 : 0.7);
      const state = this.add.text(x - 190, y - 64, completed ? '✓ MASTERED' : mission.ready ? '★ READY' : 'LOCKED', {
        fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: completed ? '#86efac' : mission.ready ? '#ffe384' : '#94a3b8'
      });
      const missionTitle = this.add.text(x - 190, y - 38, mission.title, {
        fontFamily: 'Arial, sans-serif', fontSize: '21px', fontStyle: 'bold', color: '#ffffff'
      });
      const world = this.add.text(x - 190, y - 8, `${mission.world}  •  GUIDE: ${mission.guide}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#8bd3ff'
      });
      const description = this.add.text(x - 190, y + 17, mission.description, {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#cbd5e1',
        wordWrap: { width: 300 }, lineSpacing: 3
      });
      const button = this.add.rectangle(x + 150, y + 48, 112, 42, mission.ready ? 0x4338ca : 0x1f2937, 1)
        .setStrokeStyle(2, mission.ready ? 0xc4b5fd : 0x475569, 0.95);
      const buttonText = this.add.text(x + 150, y + 48, completed ? 'REPLAY' : mission.ready ? 'START' : 'LOCKED', {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold',
        color: mission.ready ? '#ffffff' : '#64748b'
      }).setOrigin(0.5);
      overlay.add([card, state, missionTitle, world, description, button, buttonText]);
      if (mission.ready) {
        button.setInteractive({ useHandCursor: true });
        button.on('pointerdown', mission.launch);
      }
    });
  }

  private showRankUpCelebration(): void {
    const mastery = this.masteryProgress.getSnapshot();
    const overlay = this.add.container(0, 0).setDepth(270);
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0.8).setInteractive();
    const panel = this.add.rectangle(W / 2, H / 2, 680, 330, 0x0b1728, 0.97).setStrokeStyle(4, 0xffd45f, 1);
    const star = this.add.text(W / 2, 255, '★', { fontSize: '58px', color: '#ffe384' }).setOrigin(0.5);
    const kicker = this.add.text(W / 2, 310, 'ASKONAUT RANK UP!', {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#8bd3ff'
    }).setOrigin(0.5);
    const rank = this.add.text(W / 2, 350, mastery.rankLabel, {
      fontFamily: 'Arial, sans-serif', fontSize: '34px', fontStyle: 'bold', color: '#ffe384'
    }).setOrigin(0.5);
    const copy = this.add.text(W / 2, 397,
      mastery.rankId === 'master-askonaut'
        ? 'You mastered every current ASKONAUT mission. New mysteries are waiting.'
        : `${mastery.completedCount} of ${mastery.totalMissions} missions mastered. Keep solving mysteries to reach ${mastery.nextRankLabel}.`, {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#dbeafe', align: 'center', wordWrap: { width: 560 }
    }).setOrigin(0.5);
    const button = this.add.rectangle(W / 2, 468, 180, 48, 0x4338ca, 1)
      .setStrokeStyle(2, 0xc4b5fd, 1).setInteractive({ useHandCursor: true });
    const buttonText = this.add.text(W / 2, 468, 'AWESOME', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    overlay.add([shade, panel, star, kicker, rank, copy, button, buttonText]);
    overlay.setScale(0.94).setAlpha(0);
    this.tweens.add({ targets: overlay, scale: 1, alpha: 1, duration: 280, ease: 'Back.Out' });
    this.tweens.add({ targets: star, angle: { from: -8, to: 8 }, scale: { from: 0.9, to: 1.12 }, duration: 700, yoyo: true, repeat: 3, ease: 'Sine.InOut' });
    const dismiss = () => {
      this.masteryProgress.acknowledgeCurrentRank();
      overlay.destroy(true);
    };
    button.on('pointerdown', dismiss);
    shade.on('pointerdown', dismiss);
  }

  private createWorkbench(): void {
    // P6.2: the desk/workbench is part of the illustrated room. Only the interaction hotspot remains.
    const x=900,y=520;
    const hit=this.add.rectangle(x,y+10,250,120,0xffffff,0.001).setInteractive({useHandCursor:true}).setDepth(9);
    hit.on('pointerdown',()=>this.showBubble(640,126,'TEYO','I am building something.\nI just need to figure out what it is.',4200,'#60a5fa','teyo','clubhouse.teyo.workbench'));
  }

  private createCharacters(askonautName: string): void {
    // P6.1 character stage: balanced trio on one ground plane.
    const veya=this.add.image(530,662,'club-veya-p51-hf1').setOrigin(0.5,1).setScale(0.59).setDepth(16).setInteractive({useHandCursor:true});
    const teyo=this.add.image(790,662,'club-teyo-p51-hf1').setOrigin(0.5,1).setScale(0.58).setDepth(16).setInteractive({useHandCursor:true});
    const quipGroup=this.add.container(660,662).setDepth(17);
    const quip=this.add.image(0,0,'club-quip-p60a').setOrigin(0.5,1).setScale(0.135).setInteractive({useHandCursor:true}); quipGroup.add(quip);
    const namePlate=(x:number,label:string,color:number)=>{this.add.rectangle(x,676,88,24,0x07152e,0.97).setStrokeStyle(2,color,0.85).setDepth(18);this.add.text(x,676,label,{fontFamily:'Arial, sans-serif',fontSize:'11px',fontStyle:'bold',color:'#ffffff'}).setOrigin(0.5).setDepth(19);};
    namePlate(530,'VEYA',0xfb7185);namePlate(660,'QUIP',0xa78bfa);namePlate(790,'TEYO',0x38bdf8);
    veya.on('pointerdown',()=>this.showBubble(640,126,'VEYA',`${askonautName}, wait a second...\nwhat do you notice?`,4200,'#fb7185','veya','clubhouse.veya.tap'));
    teyo.on('pointerdown',()=>this.showBubble(640,126,'TEYO',`${askonautName}, there’s one way to find out.\nTry something.`,4300,'#38bdf8','teyo','clubhouse.teyo.tap'));
    quip.on('pointerdown',()=>{const lines=['I have several excellent questions.\nMost of them are about snacks.','Do you think the Compass\ncan detect suspicious sandwiches?','I am prepared for science.\nEmotionally? Less certain.',`Tap everything, ${askonautName}.\nThat is definitely how science works.`];const line=lines[this.quipTapIndex%lines.length];this.quipTapIndex+=1;this.showBubble(640,126,'QUIP',line,4400,'#a78bfa','quip',`clubhouse.quip.tap.${this.quipTapIndex%lines.length}`);});
    this.tweens.add({targets:veya,y:657,angle:-0.8,duration:1900,yoyo:true,repeat:-1,ease:'Sine.InOut'});this.tweens.add({targets:teyo,y:657,angle:0.7,duration:2100,yoyo:true,repeat:-1,ease:'Sine.InOut',delay:300});this.tweens.add({targets:quipGroup,y:657,scaleX:1.02,scaleY:1.02,duration:1250,yoyo:true,repeat:-1,ease:'Sine.InOut'});
  }

  private avatarSymbol(id: AskonautAvatarId): string {
    if (id === 'gear') return '⚙';
    if (id === 'comet') return '☄';
    return '✦';
  }

  private accentColor(id: AskonautAccentId): number {
    if (id === 'gold') return 0xf2c94c;
    if (id === 'cyan') return 0x38bdf8;
    if (id === 'rose') return 0xfb7185;
    return 0xa78bfa;
  }

  private showIdentitySetup(editing: boolean): void {
    this.identityOverlay?.destroy(true);
    this.destroyIdentityDom();

    const existing = this.progressStore.getIdentity();
    let selectedName = existing.name === 'ASKONAUT' ? 'EXPLORER' : existing.name;
    let selectedAvatar: AskonautAvatarId = existing.avatarId;
    let selectedAccent: AskonautAccentId = existing.accentId;

    const overlay = this.add.container(0, 0).setDepth(300);
    this.identityOverlay = overlay;

    const dim = this.add.rectangle(640, 360, W, H, 0x020617, 0.9).setInteractive();
    const card = this.add.rectangle(640, 360, 760, 570, 0x0b1528, 0.995)
      .setStrokeStyle(4, 0xd6ad54, 0.95);
    const cardGlow = this.add.rectangle(640, 360, 775, 585, 0x000000, 0)
      .setStrokeStyle(2, 0xffe384, 0.18);
    overlay.add([dim, cardGlow, card]);

    const title = this.add.text(640, 112, editing ? 'YOUR ASKONAUT BADGE' : 'WELCOME, NEW ASKONAUT!', {
      fontFamily: 'Arial, sans-serif', fontSize: '31px', fontStyle: 'bold', color: '#ffe384'
    }).setOrigin(0.5);
    const intro = this.add.text(640, 148, editing
      ? 'Tune your badge. The Clubhouse will remember it.'
      : 'Every explorer needs a name, a symbol, and colors of their own.', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#cbd5e1'
    }).setOrigin(0.5);
    overlay.add([title, intro]);

    // Live badge preview: this makes the choices feel like one identity instead of three settings.
    const badgeGlow = this.add.circle(390, 224, 57, this.accentColor(selectedAccent), 0.12);
    const badgeOuter = this.add.circle(390, 224, 47, 0x111d33, 1)
      .setStrokeStyle(5, this.accentColor(selectedAccent), 1);
    const badgeInner = this.add.circle(390, 224, 35, 0x1b2948, 1)
      .setStrokeStyle(2, 0xffffff, 0.16);
    const badgeSymbol = this.add.text(390, 221, this.avatarSymbol(selectedAvatar), {
      fontFamily: 'Arial, sans-serif', fontSize: '39px', color: '#fff6c8'
    }).setOrigin(0.5);
    const badgeName = this.add.text(390, 283, selectedName.toUpperCase(), {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    overlay.add([badgeGlow, badgeOuter, badgeInner, badgeSymbol, badgeName]);
    this.tweens.add({ targets: badgeGlow, alpha: { from: 0.07, to: 0.24 }, scale: { from: 0.94, to: 1.1 }, duration: 1050, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const reaction = this.add.text(725, 282, editing
      ? 'QUIP: Looking official.'
      : 'QUIP: Excellent. We were dangerously low on new ASKONAUTS.', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#c4b5fd',
      align: 'center', wordWrap: { width: 360 }
    }).setOrigin(0.5);
    overlay.add(reaction);

    this.addIdentitySectionLabel(overlay, 490, 171, editing ? 'YOUR ASKONAUT NAME' : 'WHAT SHOULD WE CALL YOU?');
    const nameAccent = editing ? this.accentColor(selectedAccent) : 0x64748b;
    const nameBox = this.add.rectangle(690, 224, 300, 58, editing ? 0x0f1a2e : 0x111d33, 1)
      .setStrokeStyle(editing ? 3 : 2, nameAccent, editing ? 0.95 : 0.8);
    const nameText = this.add.text(690, 224, selectedName, {
      fontFamily: 'Arial, sans-serif', fontSize: editing ? '24px' : '22px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    const changeName = this.add.rectangle(890, 224, 120, 48, 0x263a63, 1)
      .setStrokeStyle(2, 0x7dd3fc, 0.9).setInteractive({ useHandCursor: true });
    const changeNameText = this.add.text(890, 224, editing ? 'CHANGE NAME' : 'CHOOSE NAME', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#e0f2fe'
    }).setOrigin(0.5);
    overlay.add([nameBox, nameText, changeName, changeNameText]);

    this.addIdentitySectionLabel(overlay, 330, 307, 'CHOOSE YOUR ASKONAUT SYMBOL');
    const avatarIds: AskonautAvatarId[] = ['star', 'gear', 'comet'];
    const avatarButtons: Phaser.GameObjects.Rectangle[] = [];
    const avatarSymbols: Phaser.GameObjects.Text[] = [];
    avatarIds.forEach((id, i) => {
      const x = 485 + i * 155;
      const box = this.add.rectangle(x, 371, 122, 92, 0x111d33, 1).setInteractive({ useHandCursor: true });
      const symbol = this.add.text(x, 356, this.avatarSymbol(id), {
        fontFamily: 'Arial, sans-serif', fontSize: '38px', color: '#fff4c1'
      }).setOrigin(0.5);
      const label = this.add.text(x, 399, id === 'star' ? 'STAR' : id === 'gear' ? 'BUILDER' : 'COMET', {
        fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#cbd5e1'
      }).setOrigin(0.5);
      avatarButtons.push(box);
      avatarSymbols.push(symbol);
      overlay.add([box, symbol, label]);
      box.on('pointerdown', () => {
        selectedAvatar = id;
        reaction.setText(id === 'star'
          ? 'VEYA: A star. Perfect for someone who follows questions.'
          : id === 'gear'
            ? 'TEYO: Builder badge. Solid choice.'
            : 'QUIP: COMET. Fast, mysterious, excellent dramatic entrance.');
        updateSelections();
      });
    });

    this.addIdentitySectionLabel(overlay, 330, 431, 'PICK YOUR BADGE COLOR');
    const accentIds: AskonautAccentId[] = ['violet', 'gold', 'cyan', 'rose'];
    const accentButtons: Phaser.GameObjects.Arc[] = [];
    accentIds.forEach((id, i) => {
      const x = 445 + i * 130;
      const swatch = this.add.circle(x, 486, 28, this.accentColor(id), 1).setInteractive({ useHandCursor: true });
      accentButtons.push(swatch);
      overlay.add(swatch);
      swatch.on('pointerdown', () => {
        selectedAccent = id;
        reaction.setText('QUIP: Yes. Very official. Possibly too official.');
        updateSelections();
      });
    });

    const updateSelections = () => {
      const accent = this.accentColor(selectedAccent);
      avatarButtons.forEach((box, i) => {
        const id = avatarIds[i];
        box.setStrokeStyle(id === selectedAvatar ? 4 : 2, id === selectedAvatar ? accent : 0x475569, id === selectedAvatar ? 1 : 0.75);
      });
      avatarSymbols.forEach((symbol, i) => {
        symbol.setColor(avatarIds[i] === selectedAvatar ? Phaser.Display.Color.IntegerToColor(accent).rgba : '#fff4c1');
      });
      accentButtons.forEach((swatch, i) => {
        const id = accentIds[i];
        swatch.setStrokeStyle(id === selectedAccent ? 5 : 2, id === selectedAccent ? 0xffffff : 0x475569, id === selectedAccent ? 1 : 0.65);
      });
      badgeOuter.setStrokeStyle(5, accent, 1);
      badgeGlow.setFillStyle(accent, 0.15);
      badgeSymbol.setText(this.avatarSymbol(selectedAvatar));
      badgeName.setText(selectedName.toUpperCase());
    };

    changeName.on('pointerdown', () => {
      this.requestNameInput(selectedName, (value) => {
        selectedName = value;
        nameText.setText(value);
        reaction.setText(`VEYA: ${value}. Welcome to the question crew.`);
        updateSelections();
      });
    });
    updateSelections();

    const ready = this.add.rectangle(640, 565, 300, 66, 0x4338ca, 1)
      .setStrokeStyle(3, 0xc4b5fd, 1).setInteractive({ useHandCursor: true });
    const readyText = this.add.text(640, 565, editing ? 'SAVE MY BADGE' : 'JOIN THE TEAM', {
      fontFamily: 'Arial, sans-serif', fontSize: '19px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    overlay.add([ready, readyText]);

    ready.on('pointerdown', () => {
      ready.disableInteractive();
      this.progressStore.setIdentity({
        name: selectedName,
        avatarId: selectedAvatar,
        accentId: selectedAccent,
        complete: true
      });
      this.destroyIdentityDom();
      this.playIdentityCelebration(overlay, selectedName, selectedAvatar, selectedAccent);
    });

    if (editing) {
      const cancel = this.add.text(640, 615, 'CANCEL', {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#94a3b8'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      overlay.add(cancel);
      cancel.on('pointerdown', () => {
        overlay.destroy(true);
        if (this.identityOverlay === overlay) this.identityOverlay = undefined;
      });
    }
  }

  private playIdentityCelebration(
    overlay: Phaser.GameObjects.Container,
    name: string,
    avatarId: AskonautAvatarId,
    accentId: AskonautAccentId
  ): void {
    const accent = this.accentColor(accentId);
    overlay.removeAll(true);

    const dim = this.add.rectangle(640, 360, W, H, 0x020617, 0.94);
    const glow = this.add.circle(640, 318, 118, accent, 0.12);
    const ring = this.add.circle(640, 318, 84, 0x111d33, 1).setStrokeStyle(7, accent, 1);
    const symbol = this.add.text(640, 310, this.avatarSymbol(avatarId), {
      fontFamily: 'Arial, sans-serif', fontSize: '72px', color: '#fff6c8'
    }).setOrigin(0.5);
    const welcome = this.add.text(640, 432, `WELCOME TO THE TEAM, ${name.toUpperCase()}!`, {
      fontFamily: 'Arial, sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#ffe384'
    }).setOrigin(0.5);
    const quip = this.add.text(640, 474, `QUIP: ${name}! Excellent. We were dangerously low on ${name}.`, {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#ddd6fe', align: 'center',
      wordWrap: { width: 520 }
    }).setOrigin(0.5);
    overlay.add([dim, glow, ring, symbol, welcome, quip]);

    this.tweens.add({ targets: glow, scale: { from: 0.4, to: 1.35 }, alpha: { from: 0.45, to: 0.06 }, duration: 900, ease: 'Quad.Out' });
    this.tweens.add({ targets: [ring, symbol], scale: { from: 0.45, to: 1 }, angle: { from: -8, to: 0 }, duration: 520, ease: 'Back.Out' });

    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const spark = this.add.text(640, 318, '✦', {
        fontFamily: 'Arial, sans-serif', fontSize: `${12 + (i % 3) * 4}px`, color: i % 2 === 0 ? '#ffe384' : '#ffffff'
      }).setOrigin(0.5).setDepth(305);
      overlay.add(spark);
      this.tweens.add({
        targets: spark,
        x: 640 + Math.cos(angle) * (115 + (i % 3) * 16),
        y: 318 + Math.sin(angle) * (82 + (i % 4) * 12),
        alpha: 0,
        scale: { from: 0.6, to: 1.35 },
        duration: 900 + (i % 4) * 80,
        ease: 'Quad.Out'
      });
    }

    this.time.delayedCall(1650, () => {
      if (this.identityOverlay === overlay) this.identityOverlay = undefined;
      overlay.destroy(true);
      this.scene.restart();
    });
  }

  private addIdentitySectionLabel(container: Phaser.GameObjects.Container, x: number, y: number, copy: string): void {
    const label = this.add.text(x, y, copy, {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#a5b4fc', letterSpacing: 0.8
    });
    container.add(label);
  }

  private requestNameInput(current: string, onSave: (name: string) => void): void {
    this.destroyIdentityDom();
    const wrap = document.createElement('div');
    wrap.style.position = 'fixed';
    wrap.style.inset = '0';
    wrap.style.zIndex = '99999';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.background = 'rgba(2, 6, 23, 0.72)';

    const form = document.createElement('form');
    form.style.display = 'flex';
    form.style.gap = '10px';
    form.style.padding = '18px';
    form.style.border = '2px solid #d6ad54';
    form.style.borderRadius = '12px';
    form.style.background = '#0b1528';

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 18;
    input.value = current;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Askonaut name');
    input.style.width = '260px';
    input.style.fontSize = '20px';
    input.style.padding = '12px';
    input.style.borderRadius = '8px';
    input.style.border = '2px solid #7dd3fc';
    input.style.background = '#111d33';
    input.style.color = '#ffffff';
    input.style.outline = 'none';

    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = 'SAVE';
    save.style.fontSize = '16px';
    save.style.fontWeight = '700';
    save.style.padding = '10px 18px';
    save.style.borderRadius = '8px';
    save.style.border = '2px solid #c4b5fd';
    save.style.background = '#4338ca';
    save.style.color = '#ffffff';

    // P7.0: the parent screen says names stay on this device; say so here too,
    // and steer toward a nickname rather than a real full name.
    input.placeholder = 'Nickname';
    form.style.flexWrap = 'wrap';
    form.style.maxWidth = '420px';
    const note = document.createElement('p');
    note.textContent = 'Pick a fun nickname. It stays on this device.';
    note.style.margin = '0';
    note.style.width = '100%';
    note.style.color = '#cbd5e1';
    note.style.fontSize = '14px';
    note.style.fontFamily = 'Arial, sans-serif';

    form.append(input, save, note);
    wrap.appendChild(form);
    document.body.appendChild(wrap);
    this.identityDom = wrap;

    const commit = () => {
      const cleaned = input.value.trim().replace(/\s+/g, ' ').slice(0, 18) || 'EXPLORER';
      onSave(cleaned);
      this.destroyIdentityDom();
    };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      commit();
    });
    wrap.addEventListener('pointerdown', (event) => {
      if (event.target === wrap) this.destroyIdentityDom();
    });
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 30);
  }

  private destroyIdentityDom(): void {
    if (!this.identityDom) return;
    this.identityDom.remove();
    this.identityDom = undefined;
  }

  private createWelcome(name: string): void {
    const y=700;
    this.add.rectangle(660,y,470,26,0x07152e,0.94).setStrokeStyle(1,0xd6ad54,0.48).setDepth(7);
    this.add.text(660,y,`✦  WELCOME BACK, ${name}  •  TAP AROUND THE CLUBHOUSE TO EXPLORE`,{fontFamily:'Arial, sans-serif',fontSize:'10px',fontStyle:'bold',color:'#d9e6ff'}).setOrigin(0.5).setDepth(8);
  }


  private showBubble(x: number, y: number, speaker: string, copy: string, ms: number, accent: string, voiceSpeaker?: CharacterVoice, voiceLineId?: string): void {
    void x;
    void y;
    this.bubble?.destroy(true);
    // P6.3-HF2: one fixed, compact dialogue ribbon directly below the command bar.
    // It never covers Veya, Quip, Teyo, trophies, or the lower interaction zone.
    const safeX = 640;
    const safeY = 116;
    const c = this.add.container(safeX, safeY).setDepth(100);
    const width = Math.min(610, Math.max(360, copy.length * 4.1));
    const height = copy.includes('\n') ? 62 : 54;
    const accentColor = Phaser.Display.Color.HexStringToColor(accent).color;
    const bg = this.add.rectangle(0, 0, width, height, 0x06101f, 0.965)
      .setStrokeStyle(2, accentColor, 0.92);
    const label = this.add.text(-width / 2 + 16, -height / 2 + 10, speaker, {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: accent
    });
    const body = this.add.text(0, 8, copy, {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#ffffff', align: 'center', lineSpacing: 3,
      wordWrap: { width: width - 34 }
    }).setOrigin(0.5);
    c.add([bg, label, body]);
    c.setScale(0.96).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
    this.bubble = c;
    if (voiceSpeaker && voiceLineId) {
      this.voice.speak(voiceLineId, copy.replace(/\n/g, ' '), { speaker: voiceSpeaker, priority: 18 });
    }
    const wordCount = copy.trim().split(/\s+/).filter(Boolean).length;
    const readableMs = Phaser.Math.Clamp(3200 + wordCount * 320, 4500, 9000);
    const displayMs = Math.max(ms, readableMs);
    this.time.delayedCall(displayMs, () => {
      if (this.bubble !== c || !c.active) return;
      this.tweens.add({ targets: c, alpha: 0, y: safeY - 6, duration: 200, onComplete: () => { if (c.active) c.destroy(true); if (this.bubble === c) this.bubble = undefined; } });
    });
  }

}
