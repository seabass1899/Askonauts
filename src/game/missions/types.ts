export type MissionStageId =
  | 'mystery'
  | 'shadow_follows'
  | 'light_matters'
  | 'lights_out'
  | 'size_hunt'
  | 'block_it'
  | 'evidence_lock'
  | 'free_experiment'
  | 'question_gate'
  | 'complete';

export type SandboxDiscoveryId =
  | 'left_beam'
  | 'blocker_occlusion'
  | 'giant_shadow';

export type DiscoveryId =
  | 'first_interaction'
  | 'quip_moved'
  | 'shadow_changed_after_quip'
  | 'light_moved'
  | 'shadow_changed_after_light'
  | 'shadow_disappears_without_light'
  | 'shadow_returns_with_light'
  | 'large_shadow'
  | 'small_shadow'
  | 'blocker_shadow'
  | 'evidence_confirmed'
  | 'free_experimented'
  | 'giant_quip_secret'
  | 'question_gate_entered'
  | 'sandbox_left_beam'
  | 'sandbox_blocker_occlusion'
  | 'sandbox_giant_shadow';

export type MissionObjectId = 'quip' | 'light' | 'blocker';

export type HintCue =
  | 'none'
  | 'pulse_quip'
  | 'pulse_light'
  | 'pulse_switch'
  | 'pulse_wall'
  | 'pulse_blocker'
  | 'pulse_compass'
  | 'pulse_gate'
  | 'character_nudge';

export type MissionSignal =
  | { type: 'interaction'; atMs: number }
  | {
      type: 'object_moved';
      object: MissionObjectId;
      atMs: number;
      x?: number;
      y?: number;
    }
  | { type: 'light_toggled'; enabled: boolean; atMs: number }
  | {
      type: 'shadow_observed';
      visible: boolean;
      scale: number | null;
      y?: number | null;
      atMs: number;
    }
  | {
      type: 'blocker_observed';
      blockerId: string;
      blocking: boolean;
      shadowVisible: boolean;
      atMs: number;
    }
  | { type: 'evidence_confirmed'; atMs: number }
  | { type: 'secret_discovered'; secretId: 'giant_quip'; atMs: number }
  | { type: 'question_gate_entered'; atMs: number }
  | { type: 'sandbox_discovery'; discoveryId: SandboxDiscoveryId; atMs: number }
  | { type: 'tick'; atMs: number };

export type StageHintDefinition = {
  afterMs: number;
  cue: HintCue;
  copyKey: string;
};

export type StageDefinition = {
  id: MissionStageId;
  title: string;
  objective: string;
  requiredDiscoveries: readonly DiscoveryId[];
  optionalDiscoveries?: readonly DiscoveryId[];
  sparks: number;
  hints: readonly StageHintDefinition[];
};

export type MissionDefinition = {
  id: string;
  title: string;
  scienceQuestion: string;
  coreIdea: string;
  stages: readonly StageDefinition[];
  thresholds: {
    meaningfulScaleDelta: number;
    meaningfulPositionDelta: number;
    largeShadowScaleMin: number;
    smallShadowScaleMax: number;
    causalWindowMs: number;
    freeExperimentInteractionCount: number;
    freeExperimentDiscoveryCount: number;
  };
};

export type MissionSnapshot = {
  missionId: string;
  stageId: MissionStageId;
  completed: boolean;
  sparks: number;
  discoveries: readonly DiscoveryId[];
  activeHint: StageHintDefinition | null;
  stageStartedAtMs: number;
  lastMeaningfulSignalAtMs: number;
  freeExperimentInteractions: number;
  sandboxDiscoveries: readonly SandboxDiscoveryId[];
};

export type MissionUpdate = {
  discoveriesAdded: DiscoveryId[];
  previousStageId: MissionStageId;
  stageId: MissionStageId;
  stageChanged: boolean;
  missionCompleted: boolean;
  sparksAdded: number;
  activeHint: StageHintDefinition | null;
};
