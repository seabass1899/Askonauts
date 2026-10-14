import type {
  DiscoveryId,
  MissionDefinition,
  MissionSignal,
  MissionSnapshot,
  MissionStageId,
  MissionUpdate,
  SandboxDiscoveryId,
  StageDefinition,
  StageHintDefinition
} from './types';

type ShadowObservation = {
  visible: boolean;
  scale: number | null;
  y: number | null;
  atMs: number;
};

type PendingCausalMove = {
  object: 'quip' | 'light';
  atMs: number;
  baseline: ShadowObservation | null;
};

/**
 * Pure TypeScript mission state engine.
 *
 * Phaser (or any future renderer) sends semantic observations to this class.
 * The director owns discovery state, stage progression, hint escalation and
 * Curiosity Spark accounting. It has no rendering, audio or physics dependency.
 */
export class MissionDirector {
  private readonly discoveries = new Set<DiscoveryId>();
  private stageIndex = 0;
  private sparks = 0;
  private stageStartedAtMs = 0;
  private lastMeaningfulSignalAtMs = 0;
  private activeHint: StageHintDefinition | null = null;
  private lastShadow: ShadowObservation | null = null;
  private pendingMove: PendingCausalMove | null = null;
  private lightEnabled = true;
  private sawShadowDisappearWithLightOff = false;
  private freeExperimentInteractions = 0;
  /**
   * P7.0: evidence must come from the child. Size discoveries only count after
   * the child has moved Quip or the lamp at least once, and the rock's shadow
   * only counts after the child has moved the rock or the light (or toggled
   * it) while the rock is on screen. Without these guards, the starting layout
   * could award "tiny shadow" and "two shadows" with no input at all.
   */
  private childMovedShadowCaster = false;
  private blockerSeen = false;
  private childActedOnBlocker = false;
  private readonly sandboxDiscoveries = new Set<SandboxDiscoveryId>();

  constructor(private readonly definition: MissionDefinition, startAtMs = 0) {
    this.stageStartedAtMs = startAtMs;
    this.lastMeaningfulSignalAtMs = startAtMs;
  }

  public handle(signal: MissionSignal): MissionUpdate {
    const previousStageId = this.getStageId();
    const discoveriesAdded: DiscoveryId[] = [];
    const beforeSparks = this.sparks;

    const addDiscovery = (id: DiscoveryId): void => {
      if (this.discoveries.has(id)) return;
      this.discoveries.add(id);
      discoveriesAdded.push(id);
      this.lastMeaningfulSignalAtMs = signal.atMs;
    };

    switch (signal.type) {
      case 'interaction':
        addDiscovery('first_interaction');
        this.noteFreeExperimentInteraction();
        break;

      case 'object_moved':
        addDiscovery('first_interaction');
        if (signal.object === 'quip' || signal.object === 'light') {
          this.childMovedShadowCaster = true;
        }
        if (this.blockerSeen) this.childActedOnBlocker = true;
        if (signal.object === 'quip') {
          addDiscovery('quip_moved');
          this.pendingMove = {
            object: 'quip',
            atMs: signal.atMs,
            baseline: this.lastShadow
          };
        } else if (signal.object === 'light') {
          addDiscovery('light_moved');
          this.pendingMove = {
            object: 'light',
            atMs: signal.atMs,
            baseline: this.lastShadow
          };
        }
        this.noteFreeExperimentInteraction();
        break;

      case 'light_toggled':
        addDiscovery('first_interaction');
        this.lightEnabled = signal.enabled;
        this.lastMeaningfulSignalAtMs = signal.atMs;
        if (this.blockerSeen) this.childActedOnBlocker = true;
        this.noteFreeExperimentInteraction();
        break;

      case 'shadow_observed':
        this.processShadowObservation(signal, addDiscovery);
        break;

      case 'blocker_observed':
        // Arrives every frame while the rock is visible. It must never count as
        // a free-play interaction (P6.x counted frames here, which inflated the
        // dashboard and rewrote telemetry storage on every frame).
        this.blockerSeen = true;
        if (signal.blocking && signal.shadowVisible && this.childActedOnBlocker) {
          addDiscovery('blocker_shadow');
        }
        break;

      case 'evidence_confirmed':
        addDiscovery('evidence_confirmed');
        break;

      case 'secret_discovered':
        if (signal.secretId === 'giant_quip') addDiscovery('giant_quip_secret');
        break;

      case 'question_gate_entered':
        addDiscovery('question_gate_entered');
        break;

      case 'sandbox_discovery':
        this.noteSandboxDiscovery(signal.discoveryId, addDiscovery);
        break;

      case 'tick':
        break;
    }

    this.advanceStages(signal.atMs);
    const sparksAdded = this.sparks - beforeSparks;
    this.updateHint(signal.atMs);

    const stageId = this.getStageId();
    return {
      discoveriesAdded,
      previousStageId,
      stageId,
      stageChanged: previousStageId !== stageId,
      missionCompleted: stageId === 'complete',
      sparksAdded,
      activeHint: this.activeHint
    };
  }

  public getSnapshot(): MissionSnapshot {
    return {
      missionId: this.definition.id,
      stageId: this.getStageId(),
      completed: this.getStageId() === 'complete',
      sparks: this.sparks,
      discoveries: [...this.discoveries],
      activeHint: this.activeHint,
      stageStartedAtMs: this.stageStartedAtMs,
      lastMeaningfulSignalAtMs: this.lastMeaningfulSignalAtMs,
      freeExperimentInteractions: this.freeExperimentInteractions,
      sandboxDiscoveries: [...this.sandboxDiscoveries]
    };
  }

  public hasDiscovery(id: DiscoveryId): boolean {
    return this.discoveries.has(id);
  }

  public getCurrentStage(): StageDefinition | null {
    return this.definition.stages[this.stageIndex] ?? null;
  }

  private getStageId(): MissionStageId {
    return this.getCurrentStage()?.id ?? 'complete';
  }

  private processShadowObservation(
    observation: Extract<MissionSignal, { type: 'shadow_observed' }>,
    addDiscovery: (id: DiscoveryId) => void
  ): void {
    const current: ShadowObservation = {
      visible: observation.visible,
      scale: observation.scale,
      y: observation.y ?? null,
      atMs: observation.atMs
    };

    if (!this.lightEnabled && !current.visible) {
      addDiscovery('shadow_disappears_without_light');
      this.sawShadowDisappearWithLightOff = true;
    }

    if (this.lightEnabled && this.sawShadowDisappearWithLightOff && current.visible) {
      addDiscovery('shadow_returns_with_light');
    }

    if (
      this.childMovedShadowCaster &&
      current.visible &&
      current.scale !== null &&
      Number.isFinite(current.scale)
    ) {
      if (current.scale >= this.definition.thresholds.largeShadowScaleMin) {
        addDiscovery('large_shadow');
      }
      if (current.scale <= this.definition.thresholds.smallShadowScaleMax) {
        addDiscovery('small_shadow');
      }
    }

    if (this.pendingMove) {
      const age = current.atMs - this.pendingMove.atMs;
      if (age >= 0 && age <= this.definition.thresholds.causalWindowMs) {
        const baseline = this.pendingMove.baseline;
        if (baseline && this.shadowMeaningfullyChanged(baseline, current)) {
          addDiscovery(
            this.pendingMove.object === 'quip'
              ? 'shadow_changed_after_quip'
              : 'shadow_changed_after_light'
          );
          this.pendingMove = null;
        }
      } else if (age > this.definition.thresholds.causalWindowMs) {
        this.pendingMove = null;
      }
    }

    this.lastShadow = current;
  }

  private shadowMeaningfullyChanged(a: ShadowObservation, b: ShadowObservation): boolean {
    if (a.visible !== b.visible) return true;
    if (!a.visible || !b.visible) return false;
    const scaleChanged =
      a.scale !== null &&
      b.scale !== null &&
      Math.abs(a.scale - b.scale) >= this.definition.thresholds.meaningfulScaleDelta;

    const positionChanged =
      a.y !== null &&
      b.y !== null &&
      Math.abs(a.y - b.y) >= this.definition.thresholds.meaningfulPositionDelta;

    return scaleChanged || positionChanged;
  }

  private noteFreeExperimentInteraction(): void {
    if (this.getStageId() !== 'free_experiment') return;
    this.freeExperimentInteractions += 1;
  }

  private noteSandboxDiscovery(
    discoveryId: SandboxDiscoveryId,
    addDiscovery: (id: DiscoveryId) => void
  ): void {
    const stageId = this.getStageId();
    if (stageId !== 'free_experiment' && stageId !== 'question_gate' && stageId !== 'complete') return;
    if (this.sandboxDiscoveries.has(discoveryId)) return;

    this.sandboxDiscoveries.add(discoveryId);
    this.sparks += 1;

    const missionDiscovery: Record<SandboxDiscoveryId, DiscoveryId> = {
      left_beam: 'sandbox_left_beam',
      blocker_occlusion: 'sandbox_blocker_occlusion',
      giant_shadow: 'sandbox_giant_shadow'
    };
    addDiscovery(missionDiscovery[discoveryId]);

    if (
      stageId === 'free_experiment' &&
      this.sandboxDiscoveries.size >= this.definition.thresholds.freeExperimentDiscoveryCount
    ) {
      addDiscovery('free_experimented');
    }
  }

  private advanceStages(nowMs: number): void {
    // A child may discover later-stage behaviors early. The set retains them,
    // so multiple stages can resolve in one pass without forcing repetition.
    while (true) {
      const stage = this.getCurrentStage();
      if (!stage) return;
      const complete = stage.requiredDiscoveries.every((id) => this.discoveries.has(id));
      if (!complete) return;

      this.sparks += stage.sparks;
      this.stageIndex += 1;
      this.stageStartedAtMs = nowMs;
      this.lastMeaningfulSignalAtMs = nowMs;
      this.activeHint = null;

      if (this.getStageId() === 'free_experiment') {
        this.freeExperimentInteractions = 0;
        this.sandboxDiscoveries.clear();
      }
    }
  }

  private updateHint(nowMs: number): void {
    const stage = this.getCurrentStage();
    if (!stage || stage.hints.length === 0) {
      this.activeHint = null;
      return;
    }

    const idleMs = Math.max(0, nowMs - this.lastMeaningfulSignalAtMs);
    let next: StageHintDefinition | null = null;
    for (const hint of stage.hints) {
      if (idleMs >= hint.afterMs) next = hint;
    }
    this.activeHint = next;
  }
}
