import type { MissionDefinition } from './types';

/**
 * ASKONAUTS P1.0 — Shadow Chase mission definition.
 *
 * The mission is intentionally discovery-led rather than tutorial-led. A child
 * may discover behaviors out of order; MissionDirector retains those discoveries
 * and advances once the current stage's evidence is satisfied.
 */
export const SHADOW_CHASE_MISSION: MissionDefinition = {
  id: 'shadow-chase',
  title: 'Shadow Chase',
  scienceQuestion: 'Why do shadows follow us?',
  coreIdea: 'A shadow forms when an object blocks light. Changing the positions of the light and object changes the shadow.',
  thresholds: {
    meaningfulScaleDelta: 0.08,
    meaningfulPositionDelta: 8,
    largeShadowScaleMin: 2.8,
    // P7.0: Quip starts at ~1.84x, so "tiny" (<=1.45x) and "huge" (>=2.8x)
    // both need a deliberate move. 1.6 was above the old 1.56x starting size.
    smallShadowScaleMax: 1.45,
    causalWindowMs: 1500,
    freeExperimentInteractionCount: 5,
    freeExperimentDiscoveryCount: 2
  },
  stages: [
    {
      id: 'mystery',
      title: 'Something Is Following Quip',
      objective: 'Invite the child to touch the world without explaining the solution.',
      requiredDiscoveries: ['first_interaction'],
      sparks: 1,
      hints: [
        { afterMs: 12000, cue: 'pulse_quip', copyKey: 'shadow_chase.mystery.soft' },
        { afterMs: 25000, cue: 'character_nudge', copyKey: 'shadow_chase.mystery.nudge' }
      ]
    },
    {
      id: 'shadow_follows',
      title: 'Does It Really Follow?',
      objective: 'Discover that moving Quip changes the shadow.',
      requiredDiscoveries: ['quip_moved', 'shadow_changed_after_quip'],
      sparks: 2,
      hints: [
        { afterMs: 12000, cue: 'pulse_quip', copyKey: 'shadow_chase.shadow_follows.soft' },
        { afterMs: 28000, cue: 'pulse_wall', copyKey: 'shadow_chase.shadow_follows.nudge' }
      ]
    },
    {
      id: 'light_matters',
      title: 'What About the Light?',
      objective: 'Discover that moving the light changes the shadow too.',
      requiredDiscoveries: ['light_moved', 'shadow_changed_after_light'],
      sparks: 2,
      hints: [
        { afterMs: 12000, cue: 'pulse_light', copyKey: 'shadow_chase.light_matters.soft' },
        { afterMs: 28000, cue: 'pulse_wall', copyKey: 'shadow_chase.light_matters.nudge' }
      ]
    },
    {
      id: 'lights_out',
      title: 'Can a Shadow Exist Without Light?',
      objective: 'Turn the lamp off and back on; observe the shadow disappear and return.',
      requiredDiscoveries: ['shadow_disappears_without_light', 'shadow_returns_with_light'],
      sparks: 2,
      hints: [
        { afterMs: 12000, cue: 'pulse_switch', copyKey: 'shadow_chase.lights_out.soft' },
        { afterMs: 28000, cue: 'character_nudge', copyKey: 'shadow_chase.lights_out.nudge' }
      ]
    },
    {
      id: 'size_hunt',
      title: 'Big Shadow, Small Shadow',
      objective: 'Create both a very large and a very small shadow.',
      requiredDiscoveries: ['large_shadow', 'small_shadow'],
      sparks: 3,
      hints: [
        { afterMs: 15000, cue: 'pulse_quip', copyKey: 'shadow_chase.size_hunt.soft' },
        { afterMs: 30000, cue: 'pulse_light', copyKey: 'shadow_chase.size_hunt.nudge' }
      ]
    },
    {
      id: 'block_it',
      title: 'Block the Beam',
      objective: 'Place another object in the light path and create a second shadow.',
      requiredDiscoveries: ['blocker_shadow'],
      sparks: 3,
      hints: [
        { afterMs: 15000, cue: 'pulse_blocker', copyKey: 'shadow_chase.block_it.soft' },
        { afterMs: 32000, cue: 'character_nudge', copyKey: 'shadow_chase.block_it.nudge' }
      ]
    },
    {
      id: 'evidence_lock',
      title: 'Lock In the Discovery',
      objective: 'Use the Question Compass to capture the evidence discovered in the room.',
      requiredDiscoveries: ['evidence_confirmed'],
      sparks: 2,
      hints: [
        { afterMs: 12000, cue: 'pulse_compass', copyKey: 'shadow_chase.evidence_lock.soft' }
      ]
    },
    {
      id: 'free_experiment',
      title: 'What Else Can You Make Happen?',
      objective: 'Give the child an unstructured moment to experiment after understanding the core idea.',
      requiredDiscoveries: ['free_experimented'],
      optionalDiscoveries: ['giant_quip_secret'],
      sparks: 0,
      hints: [
        { afterMs: 14000, cue: 'pulse_quip', copyKey: 'shadow_chase.free_experiment.soft' },
        { afterMs: 28000, cue: 'character_nudge', copyKey: 'shadow_chase.free_experiment.nudge' }
      ]
    },
    {
      id: 'question_gate',
      title: 'A New Question Opens',
      objective: 'Enter the Question Gate and transition toward Reflection Hunt.',
      requiredDiscoveries: ['question_gate_entered'],
      sparks: 3,
      hints: [
        { afterMs: 15000, cue: 'pulse_gate', copyKey: 'shadow_chase.question_gate.soft' }
      ]
    }
  ]
};
