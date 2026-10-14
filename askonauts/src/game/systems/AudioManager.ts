import Phaser from 'phaser';
import { GameSettingsStore, type GameSettings } from '../settings/GameSettingsStore';
import { PrototypeAudio } from './PrototypeAudio';
import { VoiceDirector } from './VoiceDirector';

/**
 * Shared audio facade introduced in P6.4B.
 *
 * It gives the shell one authoritative master-mute path while preserving the
 * existing narration and prototype-SFX implementations underneath it.
 */
export class AudioManager {
  public readonly voice: VoiceDirector;
  public readonly sfx: PrototypeAudio;
  public readonly settings: GameSettingsStore;
  private unsubscribe?: () => void;

  constructor(scene: Phaser.Scene, settings = new GameSettingsStore()) {
    this.settings = settings;
    this.voice = new VoiceDirector(scene, { showToggle: false });
    this.sfx = new PrototypeAudio();
    this.apply(this.settings.getSnapshot());
    this.unsubscribe = this.settings.subscribe((snapshot) => this.apply(snapshot));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  public unlock(): void {
    this.voice.unlock();
    this.sfx.unlock();
  }

  public toggleMaster(): boolean {
    const current = this.settings.getSnapshot();
    const nextMuted = !current.masterMuted;
    this.settings.update({ masterMuted: nextMuted });
    return nextMuted;
  }

  public updateSettings(patch: Partial<GameSettings>): GameSettings {
    return this.settings.update(patch);
  }

  public getSettings(): GameSettings {
    return this.settings.getSnapshot();
  }

  public destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.voice.stop();
    this.sfx.destroy();
  }

  private apply(settings: GameSettings): void {
    this.voice.setMuted(settings.masterMuted || !settings.voiceEnabled);
    this.sfx.setMuted(settings.masterMuted || !settings.sfxEnabled);
  }
}
