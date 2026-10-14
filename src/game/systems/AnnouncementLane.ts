import Phaser from 'phaser';

/**
 * P7.0 — one announcement lane per scene.
 *
 * In P6.5 a single discovery could put four labels on screen at once (the
 * reward banner, a discovery label, a streak label and a "NEXT •" plate), all
 * stacked over Quip and his speech bubble. Every transient label now asks this
 * lane for a turn: one label at a time, each shown for at least MIN_SLOT_MS.
 * A label still waiting after MAX_WAIT_MS is dropped rather than shown late,
 * because a label about something that happened seconds ago only confuses.
 */
const MIN_SLOT_MS = 1200;
const GAP_MS = 120;
const MAX_WAIT_MS = 3000;

type Request = {
  key: string;
  show: () => void;
  durationMs: number;
  queuedAt: number;
  important: boolean;
};

class AnnouncementLane {
  private readonly queue: Request[] = [];
  private busyUntil = 0;
  private timer: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.queue.length = 0;
      this.timer?.remove(false);
      this.timer = null;
    });
  }

  /**
   * @param key   identical keys waiting in the queue are merged
   * @param show  draws the label; it animates itself out as before
   * @param durationMs how long the label stays up (raised to MIN_SLOT_MS)
   * @param important never dropped for waiting too long (rewards)
   */
  public request(key: string, show: () => void, durationMs: number, important = false): void {
    if (this.queue.some((item) => item.key === key)) return;
    this.queue.push({ key, show, durationMs, queuedAt: this.scene.time.now, important });
    this.pump();
  }

  private pump(): void {
    const now = this.scene.time.now;
    if (now < this.busyUntil) {
      this.schedule(this.busyUntil - now);
      return;
    }

    while (this.queue.length) {
      const next = this.queue.shift()!;
      if (!next.important && now - next.queuedAt > MAX_WAIT_MS) continue;
      next.show();
      this.busyUntil = now + Math.max(MIN_SLOT_MS, next.durationMs) + GAP_MS;
      if (this.queue.length) this.schedule(this.busyUntil - now);
      return;
    }
  }

  private schedule(delay: number): void {
    if (this.timer) return;
    this.timer = this.scene.time.delayedCall(delay, () => {
      this.timer = null;
      this.pump();
    });
  }
}

const lanes = new WeakMap<Phaser.Scene, AnnouncementLane>();

export function announcementLane(scene: Phaser.Scene): AnnouncementLane {
  let lane = lanes.get(scene);
  if (!lane) {
    lane = new AnnouncementLane(scene);
    lanes.set(scene, lane);
    // A restarted scene gets a fresh lane.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => lanes.delete(scene));
  }
  return lane;
}
