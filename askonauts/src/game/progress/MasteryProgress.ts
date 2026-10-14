export type MissionMasteryId = 'shadow-quest' | 'light-rescue' | 'spoon-sprint' | 'mirror-mission';
export type AskonautRankId = 'explorer' | 'investigator' | 'discoverer' | 'master-askonaut';

export type MasterySnapshot = {
  completedMissions: MissionMasteryId[];
  completedCount: number;
  totalMissions: number;
  rankId: AskonautRankId;
  rankLabel: string;
  rankIndex: number;
  nextRankLabel?: string;
  missionsToNextRank: number;
};

type StoredMastery = {
  completedMissions: MissionMasteryId[];
  celebratedRankIndex: number;
};

const STORAGE_KEY = 'askonauts.mastery.v1';
const ALL_MISSIONS: MissionMasteryId[] = ['shadow-quest', 'light-rescue', 'spoon-sprint', 'mirror-mission'];

const RANKS: Array<{ id: AskonautRankId; label: string; minCompleted: number }> = [
  { id: 'explorer', label: 'EXPLORER', minCompleted: 0 },
  { id: 'investigator', label: 'INVESTIGATOR', minCompleted: 1 },
  { id: 'discoverer', label: 'DISCOVERER', minCompleted: 2 },
  { id: 'master-askonaut', label: 'MASTER ASKONAUT', minCompleted: 4 }
];

export class MasteryProgress {
  private data: StoredMastery;

  constructor() {
    this.data = this.load();
  }

  getSnapshot(): MasterySnapshot {
    const completedMissions = ALL_MISSIONS.filter((id) => this.data.completedMissions.includes(id));
    const completedCount = completedMissions.length;
    let rankIndex = 0;
    for (let i = 0; i < RANKS.length; i += 1) {
      if (completedCount >= RANKS[i].minCompleted) rankIndex = i;
    }
    const rank = RANKS[rankIndex];
    const next = RANKS[rankIndex + 1];
    return {
      completedMissions,
      completedCount,
      totalMissions: ALL_MISSIONS.length,
      rankId: rank.id,
      rankLabel: rank.label,
      rankIndex,
      nextRankLabel: next?.label,
      missionsToNextRank: next ? Math.max(0, next.minCompleted - completedCount) : 0
    };
  }

  isMissionComplete(id: MissionMasteryId): boolean {
    return this.data.completedMissions.includes(id);
  }

  markMissionComplete(id: MissionMasteryId): boolean {
    if (this.data.completedMissions.includes(id)) return false;
    this.data.completedMissions.push(id);
    this.save();
    return true;
  }

  syncShadowQuestComplete(complete: boolean): void {
    if (complete) this.markMissionComplete('shadow-quest');
  }

  hasUncelebratedRankUp(): boolean {
    const snapshot = this.getSnapshot();
    return snapshot.rankIndex > 0 && snapshot.rankIndex > this.data.celebratedRankIndex;
  }

  acknowledgeCurrentRank(): void {
    this.data.celebratedRankIndex = this.getSnapshot().rankIndex;
    this.save();
  }

  private load(): StoredMastery {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { completedMissions: [], celebratedRankIndex: 0 };
      const parsed = JSON.parse(raw) as Partial<StoredMastery>;
      const completedMissions = Array.isArray(parsed.completedMissions)
        ? parsed.completedMissions.filter((id): id is MissionMasteryId => ALL_MISSIONS.includes(id as MissionMasteryId))
        : [];
      const celebratedRankIndex = typeof parsed.celebratedRankIndex === 'number'
        ? Math.max(0, Math.min(RANKS.length - 1, Math.floor(parsed.celebratedRankIndex)))
        : 0;
      return { completedMissions, celebratedRankIndex };
    } catch {
      return { completedMissions: [], celebratedRankIndex: 0 };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // The game still works if storage is unavailable; mastery simply won't persist.
    }
  }
}
