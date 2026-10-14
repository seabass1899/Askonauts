export type WorldStatus = 'playable' | 'coming_soon';

export type AskonautWorldDefinition = {
  id: string;
  title: string;
  question: string;
  sceneKey: string;
  status: WorldStatus;
  theme: string;
  discoveryIds: readonly string[];
  secretIds: readonly string[];
  nextWorldIds: readonly string[];
};

export const ASKONAUT_WORLDS: readonly AskonautWorldDefinition[] = [
  {
    id: 'shadow-chase',
    title: 'Shadow Chase',
    question: 'Why do shadows follow us?',
    sceneKey: 'ShadowBoxScene',
    status: 'playable',
    theme: 'Light & Shadow',
    discoveryIds: [
      'shadow_changed_after_quip',
      'shadow_changed_after_light',
      'shadow_disappears_without_light',
      'shadow_returns_with_light',
      'large_shadow',
      'small_shadow',
      'blocker_shadow',
      'evidence_confirmed'
    ],
    secretIds: ['left_beam', 'blocker_occlusion', 'giant_shadow'],
    nextWorldIds: ['reflection-hunt']
  },
  {
    id: 'reflection-hunt',
    title: 'Reflection Hunt',
    question: 'Why can we see ourselves in some things?',
    sceneKey: 'ReflectionHuntScene',
    status: 'playable',
    theme: 'Reflection',
    discoveryIds: [
      'mirror_reflects',
      'rough_scatter',
      'angle_changes_reflection',
      'curved_surface_changes_image'
    ],
    secretIds: ['perfect_bounce', 'sky_bounce', 'floor_bounce', 'triple_bounce'],
    nextWorldIds: ['upside-down-spoon']
  },
  {
    id: 'upside-down-spoon',
    title: 'Upside-Down Spoon',
    question: 'Why does a spoon flip your reflection?',
    sceneKey: 'UpsideDownSpoonScene',
    status: 'playable',
    theme: 'Curved Reflection',
    discoveryIds: [
      'convex_upright_small',
      'concave_far_inverted',
      'concave_near_upright',
      'distance_changes_image'
    ],
    secretIds: ['flip_point'],
    nextWorldIds: ['funhouse-mirrors']
  },
  {
    id: 'funhouse-mirrors',
    title: 'Funhouse Mirrors',
    question: 'Why do funhouse mirrors stretch and squash us?',
    sceneKey: 'FunhouseMirrorsScene',
    status: 'playable',
    theme: 'Curved Reflection',
    discoveryIds: [
      'flat_same_shape',
      'vertical_curve_stretches',
      'horizontal_curve_squashes',
      'mixed_curve_warps'
    ],
    secretIds: ['mirror_morph_master'],
    nextWorldIds: []
  }
] as const;

export function getWorldDefinition(worldId: string): AskonautWorldDefinition | null {
  return ASKONAUT_WORLDS.find((world) => world.id === worldId) ?? null;
}

export function getPlayableWorlds(): AskonautWorldDefinition[] {
  return ASKONAUT_WORLDS.filter((world) => world.status === 'playable');
}
