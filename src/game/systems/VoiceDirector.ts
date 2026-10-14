import Phaser from 'phaser';

export type CharacterVoice = 'narrator' | 'veya' | 'teyo' | 'quip';

type VoiceDirectorConfig = {
  toggleX?: number;
  toggleY?: number;
  showToggle?: boolean;
};

type VoiceOptions = {
  interrupt?: boolean;
  rate?: number;
  pitch?: number;
  /** Higher values win when narration is already active. */
  priority?: number;
  /** While active, lower-priority lines are not allowed to interrupt. */
  exclusive?: boolean;
  /** Character persona used to choose voice/pacing. */
  speaker?: CharacterVoice;
};

/**
 * Child-facing voice layer with simple narration arbitration.
 *
 * Priorities prevent incidental hints/reactions from cutting off important
 * evidence or cinematic dialogue. Stable line IDs remain compatible with a
 * later swap from browser TTS to recorded ElevenLabs assets.
 */
export class VoiceDirector {
  private readonly synth: SpeechSynthesis | null;
  private readonly toggleButton?: Phaser.GameObjects.Rectangle;
  private readonly toggleLabel?: Phaser.GameObjects.Text;
  private muted = false;
  private lastLineId: string | null = null;
  private lastSpokenAt = 0;
  private activePriority = 0;
  private activeExclusive = false;
  private activeToken = 0;

  constructor(scene: Phaser.Scene, config: VoiceDirectorConfig = {}) {
    this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;

    try {
      this.muted = localStorage.getItem('askonauts-voice-muted') === '1';
    } catch {
      this.muted = false;
    }

    if (config.showToggle !== false) {
      const toggleX = config.toggleX ?? 1086;
      const toggleY = config.toggleY ?? 30;

      this.toggleButton = scene.add
        .rectangle(toggleX, toggleY, 54, 32, 0x1e293b, 0.58)
        .setStrokeStyle(1.5, 0x64748b, 0.55)
        .setInteractive({ useHandCursor: true })
        .setDepth(1600);

      this.toggleLabel = scene.add
        .text(toggleX, toggleY, this.muted ? '🔇' : '🔊', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          color: '#e2e8f0'
        })
        .setOrigin(0.5)
        .setDepth(1601);

      this.toggleButton.on('pointerdown', () => this.toggle());
      this.toggleButton.on('pointerover', () => {
        this.toggleButton?.setFillStyle(0x1e293b, 0.92).setStrokeStyle(1.5, 0x94a3b8, 0.9);
      });
      this.toggleButton.on('pointerout', () => {
        this.toggleButton?.setFillStyle(0x1e293b, 0.58).setStrokeStyle(1.5, 0x64748b, 0.55);
      });
    }

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stop());
  }

  public unlock(): void {
    // Stable hook for platforms that require a user gesture before audio.
  }

  public speak(lineId: string, text: string, options: VoiceOptions = {}): void {
    if (this.muted || !this.synth || !text.trim()) return;

    const now = performance.now();
    if (lineId === this.lastLineId && now - this.lastSpokenAt < 2600) return;

    const priority = options.priority ?? 10;
    if (this.activeExclusive && priority < this.activePriority) return;

    if (this.synth.speaking) {
      if (!options.interrupt) return;
      if (priority < this.activePriority) return;
      this.synth.cancel();
    }

    const utterance = this.createUtterance(text, options);
    const token = ++this.activeToken;
    this.activePriority = priority;
    this.activeExclusive = options.exclusive ?? false;

    const finish = () => this.finishToken(token);
    utterance.onend = finish;
    utterance.onerror = finish;

    this.lastLineId = lineId;
    this.lastSpokenAt = now;
    this.synth.speak(utterance);
  }

  public speakAndWait(lineId: string, text: string, options: VoiceOptions = {}): Promise<void> {
    return new Promise((resolve) => {
      if (this.muted || !this.synth || !text.trim()) {
        resolve();
        return;
      }

      const now = performance.now();
      if (lineId === this.lastLineId && now - this.lastSpokenAt < 2600) {
        resolve();
        return;
      }

      const priority = options.priority ?? 10;
      if (this.activeExclusive && priority < this.activePriority) {
        resolve();
        return;
      }

      if (this.synth.speaking) {
        if (!options.interrupt || priority < this.activePriority) {
          resolve();
          return;
        }
        this.synth.cancel();
      }

      const utterance = this.createUtterance(text, options);
      const token = ++this.activeToken;
      this.activePriority = priority;
      this.activeExclusive = options.exclusive ?? false;

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        this.finishToken(token);
        resolve();
      };

      utterance.onend = finish;
      utterance.onerror = finish;

      // Guard against browsers that occasionally omit the end event.
      window.setTimeout(finish, Math.max(5000, Math.min(15000, text.length * 110)));

      this.lastLineId = lineId;
      this.lastSpokenAt = now;
      this.synth.speak(utterance);
    });
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.toggleLabel?.setText(this.muted ? '🔇' : '🔊');
    if (this.muted) this.stop();
    try {
      localStorage.setItem('askonauts-voice-muted', this.muted ? '1' : '0');
    } catch {
      // Storage is optional.
    }
  }

  public stop(): void {
    this.activeToken += 1;
    this.activePriority = 0;
    this.activeExclusive = false;
    this.synth?.cancel();
  }

  private createUtterance(text: string, options: VoiceOptions): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';

    const speaker = options.speaker ?? 'narrator';
    const persona = {
      narrator: { rate: 1.03, pitch: 1.08, names: /aria|jenny|samantha|zira|guy|david|daniel/i },
      veya: { rate: 1.02, pitch: 1.16, names: /aria|jenny|samantha|zira|victoria|ava|female/i },
      teyo: { rate: 1.00, pitch: 0.96, names: /guy|david|daniel|aaron|fred|mark|male/i },
      quip: { rate: 1.08, pitch: 1.32, names: /aria|jenny|zira|guy|david|daniel/i }
    }[speaker];

    utterance.rate = options.rate ?? persona.rate;
    utterance.pitch = options.pitch ?? persona.pitch;
    utterance.volume = 0.95;

    const voices = this.synth?.getVoices() ?? [];
    const english = voices.filter((voice) => /en-US/i.test(voice.lang));
    const preferred = english.find((voice) => persona.names.test(voice.name))
      ?? english[0]
      ?? voices.find((voice) => /^en/i.test(voice.lang));
    if (preferred) utterance.voice = preferred;
    return utterance;
  }

  private finishToken(token: number): void {
    // Ignore end/error events from speech that was superseded by a newer line.
    if (token !== this.activeToken) return;
    this.activePriority = 0;
    this.activeExclusive = false;
  }

  private toggle(): void {
    this.muted = !this.muted;
    this.toggleLabel?.setText(this.muted ? '🔇' : '🔊');
    if (this.muted) this.stop();
    try {
      localStorage.setItem('askonauts-voice-muted', this.muted ? '1' : '0');
    } catch {
      // Storage is optional.
    }
  }
}
