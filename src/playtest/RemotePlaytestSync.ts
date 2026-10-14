import type { PlaytestContext } from './PlaytestContext';
import type { ParentFeedback, PlaytestSummary } from '../game/systems/PlaytestTelemetry';

export type RemoteSyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

type SyncPayload = {
  context: PlaytestContext;
  summary: PlaytestSummary;
  status: 'in_progress' | 'completed';
  feedback: ParentFeedback | null;
  clientUpdatedAt: number;
};

type PendingMap = Record<string, SyncPayload>;

const PENDING_KEY = 'askonauts-p052-pending-sync';

/**
 * Best-effort first-party telemetry sync.
 * Gameplay never blocks on network availability. Failed submissions remain in
 * localStorage and retry when the browser is online again. Multiple unsent
 * sessions can coexist on one device without overwriting each other.
 */
/** Upload the latest session state at most this often during play. */
const SEND_INTERVAL_MS = 5_000;

export class RemotePlaytestSync {
  private timer: number | null = null;
  private latest: SyncPayload | null = null;
  private state: RemoteSyncState = 'idle';
  private readonly listeners = new Set<(state: RemoteSyncState) => void>();
  private completed = false;

  constructor(private readonly context: PlaytestContext) {
    window.addEventListener('online', () => void this.retryPending());
    window.addEventListener('pagehide', () => this.flushBeacon());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flushBeacon();
    });
    void this.retryPending();
  }

  public subscribe(listener: (state: RemoteSyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public queue(
    summary: PlaytestSummary,
    status: 'in_progress' | 'completed' = 'in_progress',
    feedback: ParentFeedback | null = null,
    immediate = false
  ): void {
    if (this.completed && status === 'in_progress') return;

    // P7.0: a session nobody has touched yet is not sent or stored. P6.x created
    // a database row on page load, which left empty sessions in the dashboard.
    const untouched = (summary.tapCount ?? 0) === 0 && summary.interactionCount === 0;
    if (status === 'in_progress' && untouched) return;

    this.latest = this.makePayload(summary, status, feedback);
    this.storePending(this.latest);

    if (immediate) {
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = null;
      void this.flushLatest();
      return;
    }

    // P7.0: throttle, not debounce. P6.x reset a 900 ms timer on every call, so
    // while saves kept arriving (every frame in Free Experiment) nothing was
    // ever sent. Now the latest state goes out at most every SEND_INTERVAL_MS.
    if (this.timer !== null) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.flushLatest();
    }, SEND_INTERVAL_MS);
  }

  public async complete(summary: PlaytestSummary, feedback: ParentFeedback): Promise<boolean> {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.completed = true;
    this.latest = this.makePayload(summary, 'completed', feedback);
    this.storePending(this.latest);
    return this.flushLatest();
  }

  public getState(): RemoteSyncState {
    return this.state;
  }

  private makePayload(
    summary: PlaytestSummary,
    status: 'in_progress' | 'completed',
    feedback: ParentFeedback | null
  ): SyncPayload {
    return {
      context: this.context,
      summary,
      status,
      feedback,
      clientUpdatedAt: Date.now()
    };
  }

  private async flushLatest(): Promise<boolean> {
    if (!this.latest) return true;
    return this.sendPayload(this.latest, true);
  }

  private async sendPayload(payload: SyncPayload, updateUi: boolean): Promise<boolean> {
    if (!navigator.onLine) {
      if (updateUi) this.setState('offline');
      return false;
    }

    if (updateUi) this.setState('saving');

    try {
      const response = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });

      // P7.0: a 400/413 means the server will never accept this payload (for
      // example an over-size P6.x session). Retrying it on every page load
      // forever helps nobody, so drop it instead of keeping it pending.
      if (response.status === 400 || response.status === 413) {
        this.removePendingIfNotNewer(payload);
        if (updateUi) this.setState('error');
        return false;
      }
      if (!response.ok) throw new Error(`Telemetry endpoint returned ${response.status}`);

      this.removePendingIfNotNewer(payload);
      if (updateUi) this.setState('saved');
      return true;
    } catch {
      this.storePending(payload);
      if (updateUi) this.setState(navigator.onLine ? 'error' : 'offline');
      return false;
    }
  }

  private flushBeacon(): void {
    if (!this.latest || !navigator.sendBeacon) return;
    try {
      const body = new Blob([JSON.stringify(this.latest)], { type: 'application/json' });
      navigator.sendBeacon('/api/telemetry', body);
    } catch {
      // Pending storage is the fallback.
    }
  }

  private async retryPending(): Promise<void> {
    const pending = this.readPendingMap();
    const payloads = Object.values(pending).sort((a, b) => a.clientUpdatedAt - b.clientUpdatedAt);
    for (const payload of payloads) {
      await this.sendPayload(payload, false);
    }
  }

  private storePending(payload: SyncPayload): void {
    try {
      const pending = this.readPendingMap();
      const existing = pending[payload.summary.sessionId];
      if (!existing || existing.clientUpdatedAt <= payload.clientUpdatedAt) {
        pending[payload.summary.sessionId] = payload;
        localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      }
    } catch {
      // Gameplay continues even when browser storage is unavailable.
    }
  }

  private removePendingIfNotNewer(payload: SyncPayload): void {
    try {
      const pending = this.readPendingMap();
      const existing = pending[payload.summary.sessionId];
      if (existing && existing.clientUpdatedAt <= payload.clientUpdatedAt) {
        delete pending[payload.summary.sessionId];
        if (Object.keys(pending).length) {
          localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        } else {
          localStorage.removeItem(PENDING_KEY);
        }
      }
    } catch {
      // A later retry can clean it up.
    }
  }

  private readPendingMap(): PendingMap {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as PendingMap | SyncPayload;

      // Migrate the single-payload shape used during early P0.5.2 development.
      if (this.isSyncPayload(parsed)) {
        return { [parsed.summary.sessionId]: parsed };
      }
      return parsed as PendingMap;
    } catch {
      return {};
    }
  }

  private isSyncPayload(value: unknown): value is SyncPayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

    const candidate = value as Partial<SyncPayload>;
    const summary = candidate.summary as Partial<PlaytestSummary> | undefined;

    return Boolean(
      summary &&
      typeof summary === 'object' &&
      typeof summary.sessionId === 'string' &&
      summary.sessionId.length > 0 &&
      typeof candidate.clientUpdatedAt === 'number'
    );
  }

  private setState(value: RemoteSyncState): void {
    this.state = value;
    for (const listener of this.listeners) listener(value);
  }
}
