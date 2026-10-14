import type { ReactionZone } from './ReactionSystem';
import { BUILD_ID } from '../../buildInfo';
import type { PlaytestContext } from '../../playtest/PlaytestContext';
import type {
  DiscoveryId,
  MissionSnapshot,
  MissionStageId,
  MissionUpdate
} from '../missions/types';

export type PlaytestObject = 'quip' | 'light' | 'blocker';
export type PlaytestWorldInteraction =
  | 'star_window'
  | 'prism'
  | 'telescope'
  | 'question_jar'
  | 'brass_dial'
  | 'pressure_plate'
  | 'quip_tap';
export type PlaytestEventType =
  | 'session_start'
  | 'first_interaction'
  | 'drag_start'
  | 'drag_end'
  | 'light_toggle'
  | 'zone_enter'
  | 'secret_discovered'
  | 'session_paused'
  | 'session_resumed'
  | 'session_reset'
  | 'parent_feedback'
  | 'mission_discovery'
  | 'mission_stage_change'
  | 'mission_sparks'
  | 'mission_hint'
  | 'compass_tap'
  | 'evidence_lock'
  | 'question_gate_revealed'
  | 'question_gate_choice_shown'
  | 'question_gate_explore_more'
  | 'question_gate_reopened'
  | 'question_gate_entered'
  | 'reflection_hunt_teaser_shown'
  | 'mission_completed'
  | 'delight_event'
  | 'world_interaction'
  | 'world_secret'
  | 'world_entered'
  | 'world_discovery'
  | 'world_completed';

export type PlaytestEvent = {
  type: PlaytestEventType;
  elapsedMs: number;
  object?: PlaytestObject;
  value?: string | number | boolean;
};

export type ParentFeedback = {
  helpNeeded: 'none' | 'a_little' | 'a_lot' | null;
  wantedMore: 'yes' | 'no' | 'not_sure' | null;
  reactedToQuip: 'yes' | 'no' | 'not_sure' | null;
  parentWouldAllowMore: 'yes' | 'no' | 'not_sure' | null;
  skipped: boolean;
};


export type MissionTelemetrySummary = {
  missionId: string;
  stageId: MissionStageId;
  completed: boolean;
  sparks: number;
  discoveries: DiscoveryId[];
  discoveryMs: Partial<Record<DiscoveryId, number>>;
  stageReachedMs: Partial<Record<MissionStageId, number>>;
  stageCompletedMs: Partial<Record<MissionStageId, number>>;
  hintCopyKeyByStage: Partial<Record<MissionStageId, string>>;
  freeExperimentInteractions: number;
};

/** P7.0: per-world activity, so every world (not only Shadow Chase) is measured. */
export type WorldTelemetry = {
  visits: number;
  activeMs: number;
  taps: number;
  firstEnteredMs: number;
  discoveries: string[];
  secrets: string[];
  completed: boolean;
  completedAtMs: number | null;
};

export type PlaytestSummary = {
  build: string;
  sessionId: string;
  startedAt: string;
  durationMs: number;
  activeGameplayMs: number;
  idleAfterLastEventMs: number;
  isPaused: boolean;
  context: PlaytestContext;
  device: {
    viewportWidth: number;
    viewportHeight: number;
    devicePixelRatio: number;
    maxTouchPoints: number;
  };
  firstInteractionMs: number | null;
  firstQuipDragMs: number | null;
  firstLightDragMs: number | null;
  firstBlockerDragMs: number | null;
  firstCompassTapMs: number | null;
  firstLightToggleMs: number | null;
  firstNearLightMs: number | null;
  firstNearWallMs: number | null;
  coreDiscoveryMs: number | null;
  lastGameplayEventMs: number | null;
  quipDragCount: number;
  lightDragCount: number;
  blockerDragCount: number;
  compassTapCount: number;
  lightToggleCount: number;
  interactionCount: number;
  delightEventCount: number;
  worldInteractionCount: number;
  uniqueWorldInteractions: PlaytestWorldInteraction[];
  worldSecretsFound: PlaytestWorldInteraction[];
  interactionsAfterCoreDiscovery: number;
  secondsAfterCoreDiscovery: number;
  continuedAfterCoreDiscovery: boolean;
  zonesVisited: ReactionZone[];
  minShadowScale: number | null;
  maxShadowScale: number | null;
  giantQuipDiscovered: boolean;
  evidenceLocked: boolean;
  evidenceLockedAtMs: number | null;
  questionGateRevealed: boolean;
  questionGateRevealedAtMs: number | null;
  firstQuestionGateChoiceMs: number | null;
  questionGateEntered: boolean;
  questionGateEnteredAtMs: number | null;
  questionGateDismissed: boolean;
  questionGateDismissedAtMs: number | null;
  questionGateExploreMoreCount: number;
  nextMissionPromptSeen: boolean;
  missionCompleted: boolean;
  missionCompletedAtMs: number | null;
  timeToQuestionGateMs: number | null;
  timeEvidenceLockToGateMs: number | null;
  timeGateRevealToEnterMs: number | null;
  parentFeedback: ParentFeedback | null;
  mission: MissionTelemetrySummary | null;
  /** P7.0: taps anywhere in the game, any world. */
  tapCount: number;
  currentWorld: string | null;
  worlds: Record<string, WorldTelemetry>;
  /** Events dropped to keep the session under the server's size limit. */
  eventsDropped: number;
  events: PlaytestEvent[];
};

/** A gap between two actions longer than this counts as idle, not play. */
const IDLE_CAP_MS = 60_000;
/** Saves (storage + network queue) happen at most this often. */
const PERSIST_INTERVAL_MS = 1_000;
/**
 * The server rejects events over 50,000 characters and the whole summary over
 * 70,000. About 60 characters per event: keep the first 100 (how the session
 * began) and the most recent 400.
 */
const EVENT_HEAD = 100;
const EVENT_TAIL = 400;

const STORAGE_KEY = 'askonauts-p1-current-session';

/**
 * First-party playtest telemetry. It stores only an anonymous random session ID,
 * age band, coarse device properties, and in-game interactions. It does not ask
 * for a child's name, birthday, email, photo, voice, or precise location.
 */
export class PlaytestTelemetry {
  private readonly startedAtPerf = performance.now();
  private readonly startedAtIso = new Date().toISOString();
  private readonly sessionId = this.makeSessionId();
  private readonly events: PlaytestEvent[] = [];
  private readonly zonesVisited = new Set<ReactionZone>();

  private firstInteractionMs: number | null = null;
  private firstQuipDragMs: number | null = null;
  private firstLightDragMs: number | null = null;
  private firstBlockerDragMs: number | null = null;
  private firstCompassTapMs: number | null = null;
  private firstLightToggleMs: number | null = null;
  private firstNearLightMs: number | null = null;
  private firstNearWallMs: number | null = null;
  private coreDiscoveryMs: number | null = null;
  private lastGameplayEventMs: number | null = null;

  private quipDragCount = 0;
  private lightDragCount = 0;
  private blockerDragCount = 0;
  private compassTapCount = 0;
  private lightToggleCount = 0;
  private interactionCount = 0;
  private delightEventCount = 0;
  private worldInteractionCount = 0;
  private readonly uniqueWorldInteractions = new Set<PlaytestWorldInteraction>();
  private readonly worldSecretsFound = new Set<PlaytestWorldInteraction>();
  private interactionsAfterCoreDiscovery = 0;
  private minShadowScale: number | null = null;
  private maxShadowScale: number | null = null;
  private giantQuipDiscovered = false;
  private evidenceLocked = false;
  private evidenceLockedAtMs: number | null = null;
  private questionGateRevealed = false;
  private questionGateRevealedAtMs: number | null = null;
  private firstQuestionGateChoiceMs: number | null = null;
  private questionGateEntered = false;
  private questionGateEnteredAtMs: number | null = null;
  private questionGateDismissed = false;
  private questionGateDismissedAtMs: number | null = null;
  private questionGateExploreMoreCount = 0;
  private nextMissionPromptSeen = false;
  private missionCompleted = false;
  private missionCompletedAtMs: number | null = null;
  private parentFeedback: ParentFeedback | null = null;
  private lastZone: ReactionZone = 'normal';

  private missionSnapshot: MissionSnapshot | null = null;
  private readonly missionDiscoveryMs: Partial<Record<DiscoveryId, number>> = {};
  private readonly missionStageReachedMs: Partial<Record<MissionStageId, number>> = {};
  private readonly missionStageCompletedMs: Partial<Record<MissionStageId, number>> = {};
  private readonly missionHintCopyKeyByStage: Partial<Record<MissionStageId, string>> = {};
  private lastMissionHintKey: string | null = null;

  private pausedAtPerf: number | null = null;
  private totalPausedMs = 0;

  /** P7.0 active-play clock: sums gaps between actions, each capped at IDLE_CAP_MS. */
  private activeMs = 0;
  private lastActivityPerf: number | null = null;
  private tapCount = 0;
  private currentWorld: string | null = null;
  private readonly worlds: Record<string, WorldTelemetry> = {};
  private eventsDropped = 0;
  private persistTimer: number | null = null;
  private lastPersistAt = 0;

  constructor(
    private readonly context: PlaytestContext,
    private readonly onPersist?: (summary: PlaytestSummary) => void
  ) {
    this.record('session_start', {}, false);
    this.persist();
  }

  public pause(): void {
    if (this.pausedAtPerf !== null) return;
    this.record('session_paused', {}, false);
    this.pausedAtPerf = performance.now();
    this.lastActivityPerf = null;
    this.flush();
  }

  public resume(): void {
    if (this.pausedAtPerf === null) return;
    this.totalPausedMs += performance.now() - this.pausedAtPerf;
    this.pausedAtPerf = null;
    this.record('session_resumed', {}, false);
    this.persist();
  }

  public isSessionPaused(): boolean {
    return this.pausedAtPerf !== null;
  }

  public noteInteraction(): void {
    if (this.isSessionPaused()) return;

    const elapsed = this.elapsedMs();
    this.interactionCount += 1;

    if (this.firstInteractionMs === null) {
      this.firstInteractionMs = elapsed;
      this.record('first_interaction');
    }

    if (this.coreDiscoveryMs !== null && elapsed > this.coreDiscoveryMs) {
      this.interactionsAfterCoreDiscovery += 1;
    }

    this.lastGameplayEventMs = elapsed;
    this.persist();
  }

  public noteDragStart(object: PlaytestObject): void {
    if (this.isSessionPaused()) return;

    const elapsed = this.elapsedMs();
    this.noteInteraction();

    if (object === 'quip') {
      this.quipDragCount += 1;
      this.firstQuipDragMs ??= elapsed;
    } else if (object === 'light') {
      this.lightDragCount += 1;
      this.firstLightDragMs ??= elapsed;
    } else {
      this.blockerDragCount += 1;
      this.firstBlockerDragMs ??= elapsed;
    }

    this.record('drag_start', { object });
    this.persist();
  }

  public noteDragEnd(object: PlaytestObject): void {
    if (this.isSessionPaused()) return;
    this.record('drag_end', { object });
    this.persist();
  }

  public noteCompassTap(): void {
    if (this.isSessionPaused()) return;

    const elapsed = this.elapsedMs();
    this.noteInteraction();
    this.compassTapCount += 1;
    this.firstCompassTapMs ??= elapsed;
    this.record('compass_tap');
    this.persist();
  }

  public noteEvidenceLock(): void {
    if (this.isSessionPaused() || this.evidenceLocked) return;

    this.evidenceLocked = true;
    this.evidenceLockedAtMs = this.elapsedMs();
    this.record('evidence_lock', {}, false);
    this.persist();
  }



  public noteQuestionGateRevealed(): void {
    if (this.isSessionPaused() || this.questionGateRevealed) return;
    const elapsed = this.elapsedMs();
    this.questionGateRevealed = true;
    this.questionGateRevealedAtMs = elapsed;
    this.record('question_gate_revealed', {}, false);
    this.persist();
  }

  public noteQuestionGateChoiceShown(): void {
    if (this.isSessionPaused()) return;
    const elapsed = this.elapsedMs();
    this.firstQuestionGateChoiceMs ??= elapsed;
    this.record('question_gate_choice_shown', {}, false);
    this.persist();
  }

  public noteQuestionGateExploreMore(): void {
    if (this.isSessionPaused()) return;
    const elapsed = this.elapsedMs();
    this.questionGateDismissed = true;
    this.questionGateDismissedAtMs = elapsed;
    this.questionGateExploreMoreCount += 1;
    this.record('question_gate_explore_more', { value: this.questionGateExploreMoreCount });
    this.persist();
  }

  public noteQuestionGateReopened(): void {
    if (this.isSessionPaused()) return;
    this.record('question_gate_reopened');
    this.persist();
  }

  public noteQuestionGateEntered(): void {
    if (this.isSessionPaused() || this.questionGateEntered) return;
    const elapsed = this.elapsedMs();
    this.questionGateEntered = true;
    this.questionGateEnteredAtMs = elapsed;
    this.record('question_gate_entered');
    this.persist();
  }

  public noteNextMissionPromptSeen(): void {
    if (this.isSessionPaused() || this.nextMissionPromptSeen) return;
    this.nextMissionPromptSeen = true;
    this.record('reflection_hunt_teaser_shown', {}, false);
    this.persist();
  }

  public noteMissionCompleted(): void {
    if (this.isSessionPaused() || this.missionCompleted) return;
    this.missionCompleted = true;
    this.missionCompletedAtMs = this.elapsedMs();
    this.record('mission_completed', {}, false);
    this.persist();
  }

  public noteLightToggle(enabled: boolean): void {
    if (this.isSessionPaused()) return;

    const elapsed = this.elapsedMs();
    this.noteInteraction();
    this.lightToggleCount += 1;
    this.firstLightToggleMs ??= elapsed;
    this.record('light_toggle', { value: enabled });
    this.persist();
  }

  public noteProjection(scale: number, visible: boolean): void {
    if (this.isSessionPaused()) return;
    if (!visible || !Number.isFinite(scale) || scale <= 0) return;

    this.minShadowScale = this.minShadowScale === null ? scale : Math.min(this.minShadowScale, scale);
    this.maxShadowScale = this.maxShadowScale === null ? scale : Math.max(this.maxShadowScale, scale);
  }

  public noteZone(zone: ReactionZone): void {
    if (this.isSessionPaused()) return;
    if (zone === this.lastZone) return;

    this.lastZone = zone;
    const elapsed = this.elapsedMs();
    this.zonesVisited.add(zone);
    this.record('zone_enter', { value: zone });

    if (zone === 'nearLight') this.firstNearLightMs ??= elapsed;
    if (zone === 'nearWall') this.firstNearWallMs ??= elapsed;

    if (this.coreDiscoveryMs === null && this.firstNearLightMs !== null && this.firstNearWallMs !== null) {
      this.coreDiscoveryMs = elapsed;
    }

    this.persist();
  }

  public noteSecret(): void {
    if (this.isSessionPaused()) return;
    if (this.giantQuipDiscovered) return;

    this.giantQuipDiscovered = true;
    this.record('secret_discovered');
    this.persist();
  }

  public noteMissionState(snapshot: MissionSnapshot): void {
    const elapsed = this.elapsedMs();
    this.missionSnapshot = this.cloneMissionSnapshot(snapshot);
    this.missionStageReachedMs[snapshot.stageId] ??= elapsed;
    this.captureMissionHint(snapshot);
    this.persist();
  }

  public noteMissionUpdate(update: MissionUpdate, snapshot: MissionSnapshot): void {
    const elapsed = this.elapsedMs();
    const previousFreeExperimentInteractions = this.missionSnapshot?.freeExperimentInteractions ?? 0;
    let changed = false;

    this.missionSnapshot = this.cloneMissionSnapshot(snapshot);

    for (const discovery of update.discoveriesAdded) {
      this.missionDiscoveryMs[discovery] ??= elapsed;
      this.record('mission_discovery', { value: discovery }, false);
      changed = true;
    }

    if (update.stageChanged) {
      this.missionStageCompletedMs[update.previousStageId] ??= elapsed;
      this.missionStageReachedMs[update.stageId] ??= elapsed;
      this.record(
        'mission_stage_change',
        { value: `${update.previousStageId}->${update.stageId}` },
        false
      );
      changed = true;
    }

    if (update.sparksAdded > 0) {
      this.record('mission_sparks', { value: update.sparksAdded }, false);
      changed = true;
    }

    if (snapshot.freeExperimentInteractions !== previousFreeExperimentInteractions) {
      changed = true;
    }

    if (this.captureMissionHint(snapshot)) {
      changed = true;
    }

    if (changed) this.persist();
  }

  public noteDelightEvent(value: string): void {
    if (this.isSessionPaused()) return;
    this.delightEventCount += 1;
    this.record('delight_event', { value }, false);
    this.persist();
  }

  public noteWorldInteraction(id: PlaytestWorldInteraction, secret = false): void {
    if (this.isSessionPaused()) return;

    this.worldInteractionCount += 1;
    this.uniqueWorldInteractions.add(id);
    this.record('world_interaction', { value: id });

    if (secret && !this.worldSecretsFound.has(id)) {
      this.worldSecretsFound.add(id);
      this.record('world_secret', { value: id }, false);
    }

    this.persist();
  }

  public setParentFeedback(feedback: ParentFeedback): void {
    this.parentFeedback = feedback;
    this.record('parent_feedback', { value: feedback.skipped ? 'skipped' : 'submitted' }, false);
    this.persist();
  }

  public getSummary(): PlaytestSummary {
    const durationMs = this.elapsedMs();
    const lastGameplayEventMs = this.lastGameplayEventMs;
    const activeGameplayMs = Math.round(this.activeMs);
    const idleAfterLastEventMs = lastGameplayEventMs === null
      ? durationMs
      : Math.max(0, durationMs - lastGameplayEventMs);

    const secondsAfterCoreDiscovery = this.coreDiscoveryMs === null
      ? 0
      : Math.max(0, Math.round(((lastGameplayEventMs ?? this.coreDiscoveryMs) - this.coreDiscoveryMs) / 1000));

    return {
      build: BUILD_ID,
      sessionId: this.sessionId,
      startedAt: this.startedAtIso,
      durationMs,
      activeGameplayMs,
      idleAfterLastEventMs,
      isPaused: this.isSessionPaused(),
      context: this.context,
      device: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        maxTouchPoints: navigator.maxTouchPoints || 0
      },
      firstInteractionMs: this.firstInteractionMs,
      firstQuipDragMs: this.firstQuipDragMs,
      firstLightDragMs: this.firstLightDragMs,
      firstBlockerDragMs: this.firstBlockerDragMs,
      firstCompassTapMs: this.firstCompassTapMs,
      firstLightToggleMs: this.firstLightToggleMs,
      firstNearLightMs: this.firstNearLightMs,
      firstNearWallMs: this.firstNearWallMs,
      coreDiscoveryMs: this.coreDiscoveryMs,
      lastGameplayEventMs,
      quipDragCount: this.quipDragCount,
      lightDragCount: this.lightDragCount,
      blockerDragCount: this.blockerDragCount,
      compassTapCount: this.compassTapCount,
      lightToggleCount: this.lightToggleCount,
      interactionCount: this.interactionCount,
      delightEventCount: this.delightEventCount,
      worldInteractionCount: this.worldInteractionCount,
      uniqueWorldInteractions: [...this.uniqueWorldInteractions],
      worldSecretsFound: [...this.worldSecretsFound],
      interactionsAfterCoreDiscovery: this.interactionsAfterCoreDiscovery,
      secondsAfterCoreDiscovery,
      continuedAfterCoreDiscovery:
        this.coreDiscoveryMs !== null && secondsAfterCoreDiscovery >= 20 && this.interactionsAfterCoreDiscovery >= 3,
      zonesVisited: [...this.zonesVisited],
      minShadowScale: this.minShadowScale === null ? null : Number(this.minShadowScale.toFixed(2)),
      maxShadowScale: this.maxShadowScale === null ? null : Number(this.maxShadowScale.toFixed(2)),
      giantQuipDiscovered: this.giantQuipDiscovered,
      evidenceLocked: this.evidenceLocked,
      evidenceLockedAtMs: this.evidenceLockedAtMs,
      questionGateRevealed: this.questionGateRevealed,
      questionGateRevealedAtMs: this.questionGateRevealedAtMs,
      firstQuestionGateChoiceMs: this.firstQuestionGateChoiceMs,
      questionGateEntered: this.questionGateEntered,
      questionGateEnteredAtMs: this.questionGateEnteredAtMs,
      questionGateDismissed: this.questionGateDismissed,
      questionGateDismissedAtMs: this.questionGateDismissedAtMs,
      questionGateExploreMoreCount: this.questionGateExploreMoreCount,
      nextMissionPromptSeen: this.nextMissionPromptSeen,
      missionCompleted: this.missionCompleted,
      missionCompletedAtMs: this.missionCompletedAtMs,
      timeToQuestionGateMs: this.questionGateRevealedAtMs,
      timeEvidenceLockToGateMs:
        this.questionGateRevealedAtMs !== null && this.evidenceLockedAtMs !== null
          ? Math.max(0, this.questionGateRevealedAtMs - this.evidenceLockedAtMs)
          : null,
      timeGateRevealToEnterMs:
        this.questionGateEnteredAtMs !== null && this.questionGateRevealedAtMs !== null
          ? Math.max(0, this.questionGateEnteredAtMs - this.questionGateRevealedAtMs)
          : null,
      parentFeedback: this.parentFeedback,
      mission: this.buildMissionSummary(),
      tapCount: this.tapCount,
      currentWorld: this.currentWorld,
      worlds: JSON.parse(JSON.stringify(this.worlds)) as Record<string, WorldTelemetry>,
      eventsDropped: this.eventsDropped,
      events: [...this.events]
    };
  }

  public syncSnapshot(): void {
    this.persist();
  }

  /** Save now, skipping the throttle (page hide, finishing a test). */
  public flush(): void {
    if (this.persistTimer !== null) {
      window.clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.writeNow();
  }

  public downloadJson(): void {
    const summary = this.getSummary();
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `askonauts-p1-${summary.sessionId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  public clearStoredSession(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  private buildMissionSummary(): MissionTelemetrySummary | null {
    if (!this.missionSnapshot) return null;

    return {
      missionId: this.missionSnapshot.missionId,
      stageId: this.missionSnapshot.stageId,
      completed: this.missionSnapshot.completed,
      sparks: this.missionSnapshot.sparks,
      discoveries: [...this.missionSnapshot.discoveries],
      discoveryMs: { ...this.missionDiscoveryMs },
      stageReachedMs: { ...this.missionStageReachedMs },
      stageCompletedMs: { ...this.missionStageCompletedMs },
      hintCopyKeyByStage: { ...this.missionHintCopyKeyByStage },
      freeExperimentInteractions: this.missionSnapshot.freeExperimentInteractions
    };
  }

  private captureMissionHint(snapshot: MissionSnapshot): boolean {
    const hint = snapshot.activeHint;
    if (!hint) {
      const changed = this.lastMissionHintKey !== null;
      this.lastMissionHintKey = null;
      return changed;
    }

    const key = `${snapshot.stageId}:${hint.copyKey}`;
    if (key === this.lastMissionHintKey) return false;

    this.lastMissionHintKey = key;
    this.missionHintCopyKeyByStage[snapshot.stageId] = hint.copyKey;
    this.record('mission_hint', { value: key }, false);
    return true;
  }

  private cloneMissionSnapshot(snapshot: MissionSnapshot): MissionSnapshot {
    return {
      ...snapshot,
      discoveries: [...snapshot.discoveries],
      activeHint: snapshot.activeHint ? { ...snapshot.activeHint } : null
    };
  }

  private record(
    type: PlaytestEventType,
    details: Partial<Pick<PlaytestEvent, 'object' | 'value'>> = {},
    gameplayEvent = true
  ): void {
    const elapsedMs = this.elapsedMs();
    this.events.push({ type, elapsedMs, ...details });
    if (this.events.length > EVENT_HEAD + EVENT_TAIL) {
      this.events.splice(EVENT_HEAD, 1);
      this.eventsDropped += 1;
    }
    if (gameplayEvent) {
      this.lastGameplayEventMs = elapsedMs;
      this.markActivity();
    }
  }

  /**
   * Adds the time since the previous action to the active-play clock, capped
   * so a tab left open (or hidden) for hours adds at most IDLE_CAP_MS.
   * P6.x reported "active play" as the time of the last event since the session
   * began, which counted hours of idle time.
   */
  private markActivity(): void {
    if (this.isSessionPaused()) return;
    const now = performance.now();
    if (this.lastActivityPerf !== null) {
      const gap = Math.min(IDLE_CAP_MS, Math.max(0, now - this.lastActivityPerf));
      this.activeMs += gap;
      if (this.currentWorld) this.world(this.currentWorld).activeMs += gap;
    }
    this.lastActivityPerf = now;
  }

  /** Call when the page is hidden: the next action starts a fresh activity run. */
  public noteHidden(): void {
    this.lastActivityPerf = null;
  }

  private world(worldId: string): WorldTelemetry {
    this.worlds[worldId] ??= {
      visits: 0,
      activeMs: 0,
      taps: 0,
      firstEnteredMs: this.elapsedMs(),
      discoveries: [],
      secrets: [],
      completed: false,
      completedAtMs: null
    };
    return this.worlds[worldId];
  }

  /** P7.0: every world reports entry, taps and progress through these. */
  public noteWorldEntered(worldId: string): void {
    if (this.currentWorld === worldId) return;
    this.currentWorld = worldId;
    this.world(worldId).visits += 1;
    this.record('world_entered', { value: worldId }, false);
    this.persist();
  }

  public noteTap(): void {
    if (this.isSessionPaused()) return;
    this.tapCount += 1;
    if (this.currentWorld) this.world(this.currentWorld).taps += 1;
    this.markActivity();
    this.persist();
  }

  public noteWorldProgress(worldId: string, kind: 'discovery' | 'secret' | 'complete', id = ''): void {
    const record = this.world(worldId);
    if (kind === 'discovery') {
      if (record.discoveries.includes(id)) return;
      record.discoveries.push(id);
      this.record('world_discovery', { value: `${worldId}:${id}` }, false);
    } else if (kind === 'secret') {
      if (record.secrets.includes(id)) return;
      record.secrets.push(id);
      this.record('world_secret', { value: `${worldId}:${id}` }, false);
    } else {
      if (record.completed) return;
      record.completed = true;
      record.completedAtMs = this.elapsedMs();
      this.record('world_completed', { value: worldId }, false);
    }
    this.persist();
  }

  public hasActivity(): boolean {
    return this.tapCount > 0 || this.interactionCount > 0;
  }

  /**
   * P7.0: throttled. P6.x saved the full summary to storage (and re-queued it
   * for upload) on every call, which during Free Experiment meant every frame.
   * Now at most once per PERSIST_INTERVAL_MS, always with the latest state.
   */
  private persist(): void {
    if (this.persistTimer !== null) return;
    const wait = Math.max(0, this.lastPersistAt + PERSIST_INTERVAL_MS - performance.now());
    if (wait === 0) {
      this.writeNow();
      return;
    }
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = null;
      this.writeNow();
    }, wait);
  }

  private writeNow(): void {
    this.lastPersistAt = performance.now();
    const summary = this.getSummary();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
    } catch {
      // Play continues if storage is unavailable/private-mode constrained.
    }
    this.onPersist?.(summary);
  }

  private elapsedMs(): number {
    const now = this.pausedAtPerf ?? performance.now();
    return Math.max(0, Math.round(now - this.startedAtPerf - this.totalPausedMs));
  }

  private makeSessionId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    const timePart = Date.now().toString(36);
    const entropyPart = Math.random().toString(36).slice(2, 10);
    return `${timePart}-${entropyPart}`;
  }
}
