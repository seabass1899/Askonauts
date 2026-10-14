import type { QuipCharacter, QuipReaction } from '../objects/QuipCharacter';
import type { PrototypeAudio } from './PrototypeAudio';

export type ReactionZone = 'normal' | 'nearLight' | 'nearWall' | 'lightOff';

export type ReactionUpdate = {
  lightEnabled: boolean;
  shadowVisible: boolean;
  shadowScale: number;
};

/**
 * Fires character reactions on zone transitions only. This keeps Quip playful
 * without repeatedly spamming the same reaction every frame.
 */
export class ReactionSystem {
  private zone: ReactionZone = 'normal';
  private everObservedLightOff = false;

  constructor(
    private readonly quip: QuipCharacter,
    private readonly audio: PrototypeAudio
  ) {}

  public update(input: ReactionUpdate): ReactionZone {
    const next = this.getZone(input);

    if (next === this.zone) {
      return next;
    }

    const previous = this.zone;
    this.zone = next;

    if (next === 'lightOff') {
      this.everObservedLightOff = true;
      this.react('surprised', 'WHO UNPLUGGED\nTHE UNIVERSE?', 1650);
      return next;
    }

    if (previous === 'lightOff' && this.everObservedLightOff) {
      this.react('joy', 'OH. THERE IT IS.', 1250);
      return next;
    }

    if (next === 'nearLight') {
      this.react('surprised', "WHOA! I'M HUGE!", 1300);
    } else if (next === 'nearWall') {
      this.react('skeptical', 'WHERE DID THE\nREST OF ME GO?', 1550);
    } else {
      this.quip.clearReactionAfter(250);
    }

    return next;
  }

  public getCurrentZone(): ReactionZone {
    return this.zone;
  }

  private getZone(input: ReactionUpdate): ReactionZone {
    if (!input.lightEnabled || !input.shadowVisible) {
      return 'lightOff';
    }

    if (input.shadowScale >= 2.75) {
      return 'nearLight';
    }

    if (input.shadowScale <= 1.38) {
      return 'nearWall';
    }

    return 'normal';
  }

  private react(reaction: QuipReaction, caption: string, durationMs: number): void {
    this.quip.showReaction(reaction, caption, durationMs);

    if (reaction === 'surprised') {
      this.audio.playReaction('surprised');
    } else if (reaction === 'skeptical') {
      this.audio.playReaction('skeptical');
    } else if (reaction === 'joy') {
      this.audio.playReaction('joy');
    }
  }
}
