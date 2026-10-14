export type GameSettings = {
  masterMuted: boolean;
  voiceEnabled: boolean;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  captionsEnabled: boolean;
  reducedMotion: boolean;
  textScale: number;
};

const STORAGE_KEY = 'askonauts.game-settings.v1';

const DEFAULT_SETTINGS: GameSettings = {
  masterMuted: false,
  voiceEnabled: true,
  sfxEnabled: true,
  // Music infrastructure is intentionally reserved for a later audio-production pass.
  musicEnabled: false,
  captionsEnabled: true,
  reducedMotion: false,
  textScale: 1
};

/**
 * Cross-world accessibility helper used by animation-heavy systems.
 * The saved ASKONAUTS preference wins alongside the operating-system setting.
 */
export function shouldReduceMotion(): boolean {
  let saved = false;
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameSettings>;
        saved = Boolean(parsed.reducedMotion);
      }
    } catch {
      saved = false;
    }
  }
  const system = typeof window !== 'undefined'
    ? (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
    : false;
  return saved || system;
}


export class GameSettingsStore {
  private settings: GameSettings;
  private listeners = new Set<(settings: GameSettings) => void>();

  constructor() {
    this.settings = this.load();
  }

  public getSnapshot(): GameSettings {
    return { ...this.settings };
  }

  public update(patch: Partial<GameSettings>): GameSettings {
    this.settings = {
      ...this.settings,
      ...patch,
      textScale: patch.textScale === undefined
        ? this.settings.textScale
        : Math.max(1, Math.min(1.25, patch.textScale))
    };
    this.save();
    this.emit();
    return this.getSnapshot();
  }

  public reset(): GameSettings {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    this.emit();
    return this.getSnapshot();
  }

  public subscribe(listener: (settings: GameSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private load(): GameSettings {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // Respect the legacy narration mute key during migration.
        const legacyVoiceMuted = localStorage.getItem('askonauts-voice-muted') === '1';
        return { ...DEFAULT_SETTINGS, masterMuted: legacyVoiceMuted };
      }
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        textScale: Math.max(1, Math.min(1.25, Number(parsed.textScale ?? 1)))
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private save(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      // Keep the legacy voice key synchronized while older scenes still use VoiceDirector directly.
      localStorage.setItem('askonauts-voice-muted', this.settings.masterMuted || !this.settings.voiceEnabled ? '1' : '0');
    } catch {
      // Settings persistence must never block play.
    }
  }
}
