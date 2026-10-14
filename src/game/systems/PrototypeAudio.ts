import type { DiscoveryId } from '../missions/types';

export type PrototypeReactionSound = 'surprised' | 'skeptical' | 'joy';

/**
 * Tiny synthesized sound palette for P0.3.
 *
 * Using Web Audio keeps this prototype self-contained: no licensed or placeholder
 * audio files are required. If the vertical slice survives playtesting, these
 * sounds can be replaced by final ASKONAUTS SFX without changing gameplay code.
 */
export class PrototypeAudio {
  private context: AudioContext | null = null;
  private unlocked = false;
  private muted = false;

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public destroy(): void {
    this.unlocked = false;
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') {
      void context.close().catch(() => {
        // Audio teardown must never block a scene transition.
      });
    }
  }

  public unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
    }

    if (this.context.state === 'suspended') {
      void this.context.resume();
    }

    this.unlocked = true;
  }

  public playLampToggle(enabled: boolean): void {
    if (!this.canPlay()) return;

    // Mechanical click.
    this.tone(180, 0.055, 'square', 0.028);

    // A tiny electrical lift/drop so ON and OFF feel different.
    if (enabled) {
      this.tone(420, 0.09, 'sine', 0.035, 0.035);
      this.tone(620, 0.11, 'sine', 0.024, 0.10);
    } else {
      this.tone(300, 0.08, 'sine', 0.03, 0.03);
      this.tone(190, 0.12, 'sine', 0.022, 0.085);
    }
  }

  public playReaction(kind: PrototypeReactionSound): void {
    if (!this.canPlay()) return;

    if (kind === 'surprised') {
      this.tone(520, 0.07, 'triangle', 0.035);
      this.tone(760, 0.10, 'triangle', 0.03, 0.055);
    } else if (kind === 'skeptical') {
      this.tone(310, 0.11, 'sine', 0.025);
      this.tone(270, 0.13, 'sine', 0.022, 0.08);
    } else {
      this.tone(540, 0.06, 'triangle', 0.03);
      this.tone(690, 0.07, 'triangle', 0.03, 0.055);
      this.tone(860, 0.10, 'triangle', 0.026, 0.11);
    }
  }

  public playCompassWake(): void {
    if (!this.canPlay()) return;

    this.tone(392, 0.10, 'sine', 0.025);
    this.tone(523, 0.12, 'triangle', 0.024, 0.07);
    this.tone(659, 0.14, 'triangle', 0.022, 0.14);
  }

  public playEvidenceLock(): void {
    if (!this.canPlay()) return;

    this.tone(523, 0.11, 'triangle', 0.03);
    this.tone(659, 0.13, 'triangle', 0.03, 0.08);
    this.tone(784, 0.16, 'triangle', 0.028, 0.16);
    this.tone(1047, 0.20, 'sine', 0.022, 0.25);
  }


  public playCuriositySpark(step: number): void {
    if (!this.canPlay()) return;

    const base = 520 + Math.min(5, Math.max(1, step)) * 55;
    this.tone(base, 0.08, 'triangle', 0.024);
    this.tone(base * 1.25, 0.10, 'sine', 0.018, 0.055);
  }

  public playQuestionDetected(): void {
    if (!this.canPlay()) return;

    const notes = [440, 554, 659, 880];
    notes.forEach((frequency, index) => {
      this.tone(frequency, 0.16, index < 3 ? 'triangle' : 'sine', 0.028, index * 0.075);
    });
  }



  public playGateWake(): void {
    if (!this.canPlay()) return;

    const notes = [330, 440, 554, 740];
    notes.forEach((frequency, index) => {
      this.tone(frequency, 0.22, index < 2 ? 'sine' : 'triangle', 0.024, index * 0.09);
    });
  }

  public playGateEnter(): void {
    if (!this.canPlay()) return;

    const notes = [392, 523, 659, 784, 1047];
    notes.forEach((frequency, index) => {
      this.tone(frequency, 0.18, index < 4 ? 'triangle' : 'sine', 0.029, index * 0.07);
    });
  }




  public playCinematicCapture(): void {
    if (!this.canPlay()) return;

    // Short, glassy evidence-capture signature: upward question energy,
    // followed by a small resolved chime as the Compass receives the clue.
    this.tone(494, 0.07, 'triangle', 0.018);
    this.tone(659, 0.10, 'sine', 0.020, 0.055);
    this.tone(880, 0.12, 'sine', 0.018, 0.115);
    this.tone(1175, 0.14, 'sine', 0.014, 0.185);
  }

  public playWorldInteraction(id: string): void {
    if (!this.canPlay()) return;

    switch (id) {
      case 'prism':
        // Glass ping + a fast spectral sweep.
        this.tone(1320, 0.045, 'sine', 0.014);
        [523, 659, 784, 988, 1175, 1397].forEach((frequency, index) => {
          this.tone(frequency, 0.12, index < 3 ? 'triangle' : 'sine', 0.019, 0.035 + index * 0.042);
        });
        break;
      case 'telescope':
        // Brass focus click followed by a distant star-scan shimmer.
        this.tone(170, 0.045, 'square', 0.018);
        this.tone(330, 0.08, 'triangle', 0.022, 0.035);
        this.tone(660, 0.12, 'sine', 0.019, 0.095);
        this.tone(990, 0.14, 'sine', 0.017, 0.16);
        this.tone(1320, 0.17, 'sine', 0.012, 0.23);
        break;
      case 'question_jar':
        // Tiny glass rattle, lid pop, then a rising question sparkle.
        this.tone(220, 0.045, 'square', 0.012);
        this.tone(285, 0.055, 'triangle', 0.016, 0.035);
        this.tone(420, 0.08, 'triangle', 0.020, 0.085);
        this.tone(630, 0.10, 'sine', 0.019, 0.145);
        this.tone(945, 0.13, 'sine', 0.015, 0.215);
        break;
      case 'brass_dial':
        // Mechanical ratchet + resonant lab-energy response.
        this.tone(130, 0.045, 'square', 0.022);
        this.tone(165, 0.045, 'square', 0.018, 0.055);
        this.tone(220, 0.055, 'square', 0.016, 0.11);
        this.tone(330, 0.13, 'triangle', 0.021, 0.15);
        this.tone(660, 0.20, 'sine', 0.014, 0.22);
        break;
      case 'pressure_plate':
        this.tone(180, 0.07, 'square', 0.022);
        this.tone(440, 0.11, 'triangle', 0.024, 0.07);
        this.tone(659, 0.14, 'triangle', 0.022, 0.14);
        this.tone(988, 0.16, 'sine', 0.018, 0.21);
        break;
      case 'quip_tap':
        this.tone(720, 0.045, 'triangle', 0.016);
        break;
      case 'star_window':
        this.playLabSecret();
        break;
      default:
        this.tone(440, 0.07, 'triangle', 0.016);
        break;
    }
  }

  public playDiscoveryFx(discovery: DiscoveryId): void {
    if (!this.canPlay()) return;

    switch (discovery) {
      case 'shadow_changed_after_quip':
        this.tone(420, 0.08, 'triangle', 0.02);
        this.tone(560, 0.10, 'sine', 0.018, 0.05);
        break;
      case 'shadow_changed_after_light':
        this.tone(480, 0.07, 'triangle', 0.022);
        this.tone(720, 0.12, 'sine', 0.02, 0.05);
        break;
      case 'shadow_disappears_without_light':
        this.tone(320, 0.11, 'sine', 0.018);
        this.tone(210, 0.18, 'sine', 0.015, 0.07);
        break;
      case 'shadow_returns_with_light':
        this.tone(520, 0.08, 'triangle', 0.022);
        this.tone(780, 0.12, 'triangle', 0.019, 0.06);
        break;
      case 'large_shadow':
        this.tone(260, 0.09, 'square', 0.018);
        this.tone(390, 0.13, 'triangle', 0.022, 0.05);
        break;
      case 'small_shadow':
        this.tone(820, 0.07, 'triangle', 0.02);
        this.tone(1100, 0.09, 'sine', 0.017, 0.045);
        break;
      case 'blocker_shadow':
        this.tone(410, 0.08, 'square', 0.018);
        this.tone(620, 0.11, 'triangle', 0.021, 0.05);
        this.tone(830, 0.13, 'sine', 0.017, 0.10);
        break;
      case 'evidence_confirmed':
      case 'free_experimented':
      case 'question_gate_entered':
        this.playDiscoveryReward(2);
        break;
      default:
        break;
    }
  }

  public playDiscoveryReward(sparksAdded = 1): void {
    if (!this.canPlay()) return;

    const lift = Math.min(3, Math.max(1, sparksAdded));
    const notes = [523, 659, 784, 1047 + lift * 40];
    notes.forEach((frequency, index) => {
      this.tone(frequency, 0.13 + index * 0.015, index < 3 ? 'triangle' : 'sine', 0.03, index * 0.055);
    });
  }

  public playChallengeReveal(): void {
    if (!this.canPlay()) return;
    this.tone(392, 0.08, 'sine', 0.018);
    this.tone(523, 0.10, 'triangle', 0.018, 0.05);
  }

  public playLabSecret(): void {
    if (!this.canPlay()) return;
    const notes = [659, 988, 1319, 1568];
    notes.forEach((frequency, index) => {
      this.tone(frequency, 0.11, 'sine', 0.024, index * 0.065);
    });
  }

  public playSecret(): void {
    if (!this.canPlay()) return;

    const notes = [523, 659, 784, 1047];
    notes.forEach((frequency, index) => {
      this.tone(frequency, 0.16, 'triangle', 0.03, index * 0.08);
    });
  }

  private canPlay(): boolean {
    return !this.muted && this.unlocked && this.context !== null;
  }

  private tone(
    frequency: number,
    durationSeconds: number,
    type: OscillatorType,
    peakGain: number,
    delaySeconds = 0
  ): void {
    if (!this.context) return;

    const now = this.context.currentTime + delaySeconds;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peakGain), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

    oscillator.connect(gain);
    gain.connect(this.context.destination);

    oscillator.start(now);
    oscillator.stop(now + durationSeconds + 0.02);
  }
}
