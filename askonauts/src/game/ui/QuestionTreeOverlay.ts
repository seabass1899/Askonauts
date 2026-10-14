import Phaser from 'phaser';
import { buildQuestionTree } from '../questions/QuestionTree';
import type { QuestionTreeNode, QuestionNodeState } from '../questions/QuestionTree';
import { PlayerProgressStore } from '../progress/PlayerProgressStore';

const W = 1280;
const H = 720;

function sceneKeyForWorld(worldId: string): string {
  if (worldId === 'reflection-hunt') return 'ReflectionHuntScene';
  if (worldId === 'upside-down-spoon') return 'UpsideDownSpoonScene';
  if (worldId === 'funhouse-mirrors') return 'FunhouseMirrorsScene';
  return 'ShadowBoxScene';
}

/** Scene-independent Question Tree used by the P6.4B global shell. */
export class QuestionTreeOverlay {
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
    const nodes = buildQuestionTree(this.progressStore.getSnapshot());
    const overlay = this.scene.add.container(0, 0).setDepth(2390);
    this.overlay = overlay;

    const dim = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0.78).setInteractive();
    const panel = this.scene.add.rectangle(640, 360, 1080, 610, 0x091426, 0.99)
      .setStrokeStyle(4, 0xd6ad54, 0.95);
    const title = this.scene.add.text(640, 86, 'THE QUESTION TREE', {
      fontFamily: 'Arial, sans-serif', fontSize: '31px', fontStyle: 'bold', color: '#ffd966', stroke: '#17325d', strokeThickness: 3
    }).setOrigin(0.5);
    const subtitle = this.scene.add.text(640, 122, 'Every answer can grow a new question.', {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#cbd5e1'
    }).setOrigin(0.5);
    const closeBox = this.scene.add.rectangle(1110, 86, 82, 38, 0x102443, 1)
      .setStrokeStyle(2, 0xa78bfa, 0.95).setInteractive({ useHandCursor: true });
    const closeText = this.scene.add.text(1110, 86, 'CLOSE', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#e2e8f0'
    }).setOrigin(0.5);
    overlay.add([dim, panel, title, subtitle, closeBox, closeText]);
    closeBox.on('pointerdown', () => this.close());

    const positions: Record<string, { x: number; y: number }> = {
      'shadow-chase': { x: 640, y: 195 },
      'shadow-size': { x: 380, y: 340 },
      'reflection-hunt': { x: 850, y: 340 },
      'two-shadows': { x: 260, y: 500 },
      'spoon-reflection': { x: 825, y: 475 },
      'funhouse-mirrors': { x: 990, y: 585 }
    };

    const lines = this.scene.add.graphics();
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

    const detailBg = this.scene.add.rectangle(485, 615, 580, 46, 0x10192b, 0.96).setStrokeStyle(2, 0x334155, 0.9);
    const detail = this.scene.add.text(485, 615, 'Tap a question to see where curiosity leads.', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#dbeafe', align: 'center', wordWrap: { width: 540 }
    }).setOrigin(0.5);
    overlay.add([detailBg, detail]);

    nodes.forEach((node) => {
      const pos = positions[node.id];
      this.createNode(overlay, node, pos.x, pos.y, detail);
    });
  }

  public close(): void {
    this.overlay?.destroy(true);
    this.overlay = undefined;
  }

  private createNode(
    overlay: Phaser.GameObjects.Container,
    node: QuestionTreeNode,
    x: number,
    y: number,
    detail: Phaser.GameObjects.Text
  ): void {
    const style = this.nodeStyle(node.state);
    const box = this.scene.add.rectangle(x, y, 248, 102, style.fill, 0.98)
      .setStrokeStyle(node.state === 'mystery' ? 2 : 4, style.stroke, style.alpha)
      .setInteractive({ useHandCursor: true });
    const worldNode = Boolean(node.worldId);
    const stateText = worldNode && node.state === 'completed' ? 'COMPLETED • TAP TO REVISIT' : style.label;
    const stateLabel = this.scene.add.text(x, y - 34, stateText, {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', fontStyle: 'bold', color: style.text
    }).setOrigin(0.5);
    const title = this.scene.add.text(x, y - 10, node.state === 'mystery' ? '???' : node.title, {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: node.state === 'mystery' ? '#94a3b8' : '#ffffff'
    }).setOrigin(0.5);
    const question = this.scene.add.text(x, y + 22, node.state === 'mystery' ? 'A question is still hiding here.' : node.question, {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', color: node.state === 'mystery' ? '#64748b' : '#dbeafe',
      align: 'center', wordWrap: { width: 220 }
    }).setOrigin(0.5);
    overlay.add([box, stateLabel, title, question]);

    if (node.state === 'completed') {
      const spark = this.scene.add.text(x + 105, y - 42, '✦', { fontSize: '15px', color: '#ffe27c' }).setOrigin(0.5);
      overlay.add(spark);
      this.scene.tweens.add({ targets: spark, scale: { from: 0.85, to: 1.2 }, alpha: { from: 0.55, to: 1 }, duration: 800, yoyo: true, repeat: -1 });
    }

    box.on('pointerdown', () => {
      if (node.worldId && node.state !== 'mystery') {
        this.progressStore.setLastWorld(node.worldId);
        this.close();
        this.scene.scene.start(sceneKeyForWorld(node.worldId));
        return;
      }
      if (node.id === 'shadow-size' && node.state === 'completed') {
        detail.setText('You found that moving an object relative to the light changes shadow size. Revisit Shadow Chase to recreate it.');
        return;
      }
      if (node.state === 'completed') detail.setText(`${node.question} You found evidence for this while experimenting.`);
      else if (node.state === 'discovered') detail.setText(`${node.question} New question detected. Keep exploring to open its world.`);
      else if (node.state === 'available') detail.setText(`${node.question} This question is ready to investigate.`);
      else detail.setText('That question is still hiding. Discoveries elsewhere in the tree may reveal it.');
    });
  }

  private nodeStyle(state: QuestionNodeState): { fill: number; stroke: number; text: string; label: string; alpha: number } {
    if (state === 'completed') return { fill: 0x30254e, stroke: 0xf2c94c, text: '#ffe384', label: 'COMPLETED', alpha: 1 };
    if (state === 'available') return { fill: 0x132d45, stroke: 0x38bdf8, text: '#8bd3ff', label: 'READY TO EXPLORE', alpha: 1 };
    if (state === 'discovered') return { fill: 0x2d2350, stroke: 0xa78bfa, text: '#c4b5fd', label: 'NEW QUESTION', alpha: 1 };
    return { fill: 0x111827, stroke: 0x475569, text: '#94a3b8', label: 'MYSTERY', alpha: 0.72 };
  }
}
