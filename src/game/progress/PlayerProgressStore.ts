import type { MissionSnapshot } from '../missions/types';

const STORAGE_KEY = 'askonauts.player-progress.v1';
const SCHEMA_VERSION = 2;

export type AskonautAvatarId = 'star' | 'gear' | 'comet';
export type AskonautAccentId = 'violet' | 'gold' | 'cyan' | 'rose';

export type AskonautIdentity = {
  name: string;
  avatarId: AskonautAvatarId;
  accentId: AskonautAccentId;
  complete: boolean;
  ageBand?: string | null;
};

export type WorldProgressRecord = {
  sparks: number;
  discoveries: string[];
  secrets: string[];
  completed: boolean;
  completedAt?: string;
};

export type PlayerProgress = {
  schemaVersion: number;
  askonautName: string;
  avatarId: AskonautAvatarId;
  accentId: AskonautAccentId;
  identityComplete: boolean;
  ageBand?: string | null;
  worldProgress: Record<string, WorldProgressRecord>;
  unlockedWorldIds: string[];
  lastWorldId: string | null;
  updatedAt: string;
};

function makeDefaultProgress(): PlayerProgress {
  return {
    schemaVersion: SCHEMA_VERSION,
    askonautName: 'ASKONAUT',
    avatarId: 'star',
    accentId: 'violet',
    identityComplete: false,
    ageBand: null,
    worldProgress: {},
    unlockedWorldIds: ['shadow-chase'],
    lastWorldId: null,
    updatedAt: new Date().toISOString()
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function cleanName(value: unknown): string {
  if (typeof value !== 'string') return 'ASKONAUT';
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'ASKONAUT';
  return trimmed.slice(0, 18);
}

function isAvatarId(value: unknown): value is AskonautAvatarId {
  return value === 'star' || value === 'gear' || value === 'comet';
}

function isAccentId(value: unknown): value is AskonautAccentId {
  return value === 'violet' || value === 'gold' || value === 'cyan' || value === 'rose';
}

/**
 * P7.0: one place every world's progress passes through, so playtest telemetry
 * can record discoveries, secrets and completions for ALL worlds without each
 * scene wiring telemetry itself.
 */
export type ProgressEvent = {
  worldId: string;
  kind: 'discovery' | 'secret' | 'complete';
  id: string;
};
const progressListeners = new Set<(event: ProgressEvent) => void>();
export function onProgressEvent(listener: (event: ProgressEvent) => void): () => void {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}
function emitProgress(event: ProgressEvent): void {
  for (const listener of progressListeners) {
    try {
      listener(event);
    } catch {
      // Telemetry must never interrupt play.
    }
  }
}

export class PlayerProgressStore {
  private progress: PlayerProgress;

  constructor() {
    this.progress = this.load();
  }

  public getSnapshot(): PlayerProgress {
    return JSON.parse(JSON.stringify(this.progress)) as PlayerProgress;
  }

  public getIdentity(): AskonautIdentity {
    return {
      name: this.progress.askonautName,
      avatarId: this.progress.avatarId,
      accentId: this.progress.accentId,
      complete: this.progress.identityComplete,
      ageBand: this.progress.ageBand ?? null
    };
  }

  public setIdentity(identity: Partial<Omit<AskonautIdentity, 'complete'>> & { complete?: boolean }): void {
    if (identity.name !== undefined) this.progress.askonautName = cleanName(identity.name);
    if (identity.avatarId && isAvatarId(identity.avatarId)) this.progress.avatarId = identity.avatarId;
    if (identity.accentId && isAccentId(identity.accentId)) this.progress.accentId = identity.accentId;
    if (identity.complete !== undefined) this.progress.identityComplete = identity.complete;
    if (identity.ageBand !== undefined) this.progress.ageBand = identity.ageBand;
    this.save();
  }

  public getWorldProgress(worldId: string): WorldProgressRecord {
    return this.progress.worldProgress[worldId] ?? {
      sparks: 0,
      discoveries: [],
      secrets: [],
      completed: false
    };
  }

  public getTotalSparks(): number {
    return Object.values(this.progress.worldProgress).reduce(
      (total, world) => total + Math.max(0, world.sparks || 0),
      0
    );
  }

  public setLastWorld(worldId: string): void {
    this.progress.lastWorldId = worldId;
    this.save();
  }

  public recordMissionSnapshot(worldId: string, snapshot: MissionSnapshot): void {
    const previous = this.getWorldProgress(worldId);
    const completed = previous.completed || snapshot.completed;
    const record: WorldProgressRecord = {
      sparks: Math.max(previous.sparks, snapshot.sparks),
      discoveries: unique([...previous.discoveries, ...snapshot.discoveries]),
      secrets: unique([...previous.secrets, ...snapshot.sandboxDiscoveries]),
      completed
    };

    if (completed) record.completedAt = previous.completedAt ?? new Date().toISOString();

    // P7.0: Shadow Chase calls this for every mission signal, which is every
    // frame. Only write when something actually changed (P6.x wrote to storage
    // one to two times per frame).
    const unchanged =
      record.sparks === previous.sparks &&
      record.completed === previous.completed &&
      record.discoveries.length === previous.discoveries.length &&
      record.secrets.length === previous.secrets.length &&
      this.progress.lastWorldId === worldId;
    if (unchanged) return;

    for (const id of record.discoveries) {
      if (!previous.discoveries.includes(id)) emitProgress({ worldId, kind: 'discovery', id });
    }
    for (const id of record.secrets) {
      if (!previous.secrets.includes(id)) emitProgress({ worldId, kind: 'secret', id });
    }
    if (completed && !previous.completed) emitProgress({ worldId, kind: 'complete', id: worldId });

    this.progress.worldProgress[worldId] = record;
    this.progress.lastWorldId = worldId;

    if (completed && worldId === 'shadow-chase') {
      this.progress.unlockedWorldIds = unique([
        ...this.progress.unlockedWorldIds,
        'reflection-hunt'
      ]);
    }

    this.save();
  }

  public recordWorldDiscovery(worldId: string, discoveryId: string, sparkAward = 1): boolean {
    const previous = this.getWorldProgress(worldId);
    if (previous.discoveries.includes(discoveryId)) return false;

    this.progress.worldProgress[worldId] = {
      ...previous,
      sparks: previous.sparks + Math.max(0, sparkAward),
      discoveries: unique([...previous.discoveries, discoveryId])
    };
    this.progress.lastWorldId = worldId;
    this.save();
    emitProgress({ worldId, kind: 'discovery', id: discoveryId });
    return true;
  }

  public recordWorldSecret(worldId: string, secretId: string, sparkAward = 1): boolean {
    const previous = this.getWorldProgress(worldId);
    if (previous.secrets.includes(secretId)) return false;

    this.progress.worldProgress[worldId] = {
      ...previous,
      sparks: previous.sparks + Math.max(0, sparkAward),
      secrets: unique([...previous.secrets, secretId])
    };
    this.progress.lastWorldId = worldId;
    this.save();
    emitProgress({ worldId, kind: 'secret', id: secretId });
    return true;
  }

  public resetAll(): void {
    this.progress = makeDefaultProgress();
    this.save();
  }

  public completeWorld(worldId: string, unlockWorldIds: readonly string[] = []): void {
    const previous = this.getWorldProgress(worldId);
    if (!previous.completed) emitProgress({ worldId, kind: 'complete', id: worldId });
    this.progress.worldProgress[worldId] = {
      ...previous,
      completed: true,
      completedAt: previous.completedAt ?? new Date().toISOString()
    };
    this.progress.unlockedWorldIds = unique([
      ...this.progress.unlockedWorldIds,
      ...unlockWorldIds
    ]);
    this.progress.lastWorldId = worldId;
    this.save();
  }

  private load(): PlayerProgress {
    if (typeof localStorage === 'undefined') return makeDefaultProgress();

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return makeDefaultProgress();
      const parsed = JSON.parse(raw) as Partial<PlayerProgress> & { schemaVersion?: number };

      // P2.1 migrates the existing v1 progress in place instead of resetting it.
      if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== SCHEMA_VERSION) {
        return makeDefaultProgress();
      }

      const legacyName = cleanName(parsed.askonautName);
      const migratedFromV1 = parsed.schemaVersion === 1;

      const progress: PlayerProgress = {
        schemaVersion: SCHEMA_VERSION,
        askonautName: legacyName,
        avatarId: isAvatarId(parsed.avatarId) ? parsed.avatarId : 'star',
        accentId: isAccentId(parsed.accentId) ? parsed.accentId : 'violet',
        // Existing users should see the identity setup once. If they already had
        // a non-default name from a future/experimental build, preserve it but
        // still let them confirm the rest of the identity.
        identityComplete: migratedFromV1 ? false : Boolean(parsed.identityComplete),
        ageBand: typeof parsed.ageBand === 'string' ? parsed.ageBand : null,
        worldProgress: parsed.worldProgress ?? {},
        unlockedWorldIds: unique(parsed.unlockedWorldIds ?? ['shadow-chase']),
        lastWorldId: parsed.lastWorldId ?? null,
        updatedAt: parsed.updatedAt ?? new Date().toISOString()
      };

      this.progress = progress;
      this.save();
      return progress;
    } catch {
      return makeDefaultProgress();
    }
  }

  private save(): void {
    this.progress.schemaVersion = SCHEMA_VERSION;
    this.progress.updatedAt = new Date().toISOString();
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
    } catch {
      // Progress persistence must never prevent gameplay.
    }
  }
}
