import type { PlayerProgress } from '../progress/PlayerProgressStore';

export type JournalEntryKind = 'discovery' | 'secret';

export type DiscoveryJournalEntry = {
  id: string;
  kind: JournalEntryKind;
  worldId: string;
  title: string;
  summary: string;
  science: string;
  replayPrompt: string;
};

type JournalDefinition = Omit<DiscoveryJournalEntry, 'worldId'>;

const SHADOW_DISCOVERIES: Record<string, JournalDefinition> = {
  first_interaction: {
    id: 'first_interaction', kind: 'discovery', title: 'FIRST CLUE',
    summary: 'You touched the Light Lab and started the mystery.',
    science: 'Scientists begin by observing and changing one thing at a time.',
    replayPrompt: 'Move Quip and watch the observation screen.'
  },
  quip_moved: {
    id: 'quip_moved', kind: 'discovery', title: 'QUIP ON THE MOVE',
    summary: 'Moving Quip changes where his shadow appears.',
    science: 'A shadow depends on where the object is compared with the light.',
    replayPrompt: 'Drag Quip to a new place and watch the shadow move.'
  },
  shadow_changed_after_quip: {
    id: 'shadow_changed_after_quip', kind: 'discovery', title: 'THE SHADOW FOLLOWS',
    summary: 'Quip moved — and his shadow changed too.',
    science: 'The shadow is made by Quip blocking some of the light.',
    replayPrompt: 'Move Quip slowly and compare his position with the shadow.'
  },
  light_moved: {
    id: 'light_moved', kind: 'discovery', title: 'MOVE THE LIGHT',
    summary: 'The lamp is part of the experiment too.',
    science: 'Changing the light source changes the path the light can travel.',
    replayPrompt: 'Move the lamp while Quip stays still.'
  },
  shadow_changed_after_light: {
    id: 'shadow_changed_after_light', kind: 'discovery', title: 'LIGHT CHANGES THE SHADOW',
    summary: 'The shadow changed even though Quip stayed put.',
    science: 'A shadow depends on the positions of the light, object, and screen.',
    replayPrompt: 'Change only the lamp position and watch the shadow.'
  },
  shadow_disappears_without_light: {
    id: 'shadow_disappears_without_light', kind: 'discovery', title: 'LIGHTS OUT',
    summary: 'When the lamp went off, Quip\'s shadow disappeared.',
    science: 'A visible shadow needs light to be blocked.',
    replayPrompt: 'Turn the lamp off while watching the screen.'
  },
  shadow_returns_with_light: {
    id: 'shadow_returns_with_light', kind: 'discovery', title: 'SHADOW RETURNS',
    summary: 'The shadow came back when the light came back.',
    science: 'Restoring the light restores the blocked-light pattern we call a shadow.',
    replayPrompt: 'Turn the lamp off, then on again.'
  },
  large_shadow: {
    id: 'large_shadow', kind: 'discovery', title: 'GIANT SHADOW',
    summary: 'Quip made a shadow much bigger than himself.',
    science: 'Moving an object closer to the light can make its shadow grow dramatically.',
    replayPrompt: 'Move Quip close to the lamp and make the biggest shadow you can.'
  },
  small_shadow: {
    id: 'small_shadow', kind: 'discovery', title: 'TINY SHADOW',
    summary: 'Quip also made his shadow much smaller.',
    science: 'Changing the object\'s distance from the light changes the shadow\'s size.',
    replayPrompt: 'Move Quip farther from the lamp and compare sizes.'
  },
  blocker_shadow: {
    id: 'blocker_shadow', kind: 'discovery', title: 'THE ROCK MAKES ONE TOO',
    summary: 'The rock made its own shadow when it entered the beam.',
    science: 'Any opaque object can block light and create a shadow.',
    replayPrompt: 'Drag the rock into the beam and watch the observation screen.'
  },
  evidence_confirmed: {
    id: 'evidence_confirmed', kind: 'discovery', title: 'EVIDENCE LOCKED',
    summary: 'You used the Question Compass to lock in the evidence.',
    science: 'Good explanations are built from observations that can be repeated.',
    replayPrompt: 'Repeat one experiment and see whether you get the same result.'
  },
  free_experimented: {
    id: 'free_experimented', kind: 'discovery', title: 'FREE EXPLORER',
    summary: 'You experimented without being told exactly what to do.',
    science: 'Open-ended experiments help us find patterns we were not expecting.',
    replayPrompt: 'Try changing two things and predict what will happen.'
  },
  giant_quip_secret: {
    id: 'giant_quip_secret', kind: 'discovery', title: 'TOO MUCH QUIP',
    summary: 'You found an extra-large Quip moment.',
    science: 'Extreme positions can reveal the limits of a system.',
    replayPrompt: 'Push the shadow-size experiment to the extreme.'
  },
  question_gate_entered: {
    id: 'question_gate_entered', kind: 'discovery', title: 'QUESTION GATE OPENED',
    summary: 'Your discoveries opened the way to another question.',
    science: 'One answer often leads to a better question.',
    replayPrompt: 'Revisit the Light Lab and see what else you can discover.'
  }
};

const SHADOW_SECRETS: Record<string, JournalDefinition> = {
  left_beam: {
    id: 'left_beam', kind: 'secret', title: 'OUTSIDE THE LIGHT',
    summary: 'Quip left the beam while the lamp stayed on — and his shadow vanished.',
    science: 'The lamp can be on without lighting Quip. Light has to actually reach him.',
    replayPrompt: 'Keep the lamp on and move Quip completely outside the beam.'
  },
  blocker_occlusion: {
    id: 'blocker_occlusion', kind: 'secret', title: 'ROCK BLOCK',
    summary: 'The rock blocked the light before it reached Quip.',
    science: 'One object can prevent light from reaching another object farther along the path.',
    replayPrompt: 'Put the rock directly between the lamp and Quip.'
  },
  giant_shadow: {
    id: 'giant_shadow', kind: 'secret', title: 'TOO MUCH QUIP!',
    summary: 'Quip\'s shadow grew so large it could not fit on the observation screen.',
    science: 'A nearby object can spread its shadow far beyond its own size.',
    replayPrompt: 'Move Quip very close to the lamp until the shadow fills the screen.'
  }
};

const REFLECTION_DISCOVERIES: Record<string, JournalDefinition> = {
  mirror_reflects: {
    id: 'mirror_reflects', kind: 'discovery', title: 'MIRROR BRIGHT',
    summary: 'The mirror sent a clear beam of light in a new direction.',
    science: 'Smooth shiny surfaces can reflect light in an organized direction.',
    replayPrompt: 'Select the mirror and watch where the reflected beam goes.'
  },
  rough_scatter: {
    id: 'rough_scatter', kind: 'discovery', title: 'ROUGH SCATTER',
    summary: 'The rough panel did not make a clear reflection.',
    science: 'Rough surfaces send reflected light in many directions, so images become unclear.',
    replayPrompt: 'Compare the mirror with the rough panel.'
  },
  angle_changes_reflection: {
    id: 'angle_changes_reflection', kind: 'discovery', title: 'ANGLE MATTERS',
    summary: 'Turning the mirror changed where the reflected light landed.',
    science: 'The direction of reflected light depends on the angle of the surface.',
    replayPrompt: 'Rotate the mirror and try to move the reflected spot across the target wall.'
  },
  curved_surface_changes_image: {
    id: 'curved_surface_changes_image', kind: 'discovery', title: 'CURVED REFLECTION',
    summary: 'The curved spoon changed the reflected image.',
    science: 'Curved reflective surfaces bend reflected rays differently from flat mirrors.',
    replayPrompt: 'Switch to the spoon and compare its reflection with the flat mirror.'
  }
};

const REFLECTION_SECRETS: Record<string, JournalDefinition> = {
  perfect_bounce: {
    id: 'perfect_bounce', kind: 'secret', title: 'CENTER BOUNCE',
    summary: 'You aimed the reflected beam onto the center target.',
    science: 'Changing the mirror angle changes the direction of the reflected ray.',
    replayPrompt: 'Use the Challenge Lab and hit the center target again.'
  },
  sky_bounce: {
    id: 'sky_bounce', kind: 'secret', title: 'SKY BOUNCE',
    summary: 'You aimed the reflected beam high on the target wall.',
    science: 'A small change in mirror angle can move the reflected beam a long distance.',
    replayPrompt: 'Use the Challenge Lab and aim for the high target.'
  },
  floor_bounce: {
    id: 'floor_bounce', kind: 'secret', title: 'FLOOR BOUNCE',
    summary: 'You aimed the reflected beam low on the target wall.',
    science: 'Reflection is predictable: surface angle controls where the outgoing light travels.',
    replayPrompt: 'Use the Challenge Lab and aim for the low target.'
  },
  triple_bounce: {
    id: 'triple_bounce', kind: 'secret', title: 'TRIPLE BOUNCE',
    summary: 'You hit all three Reflection Challenge targets.',
    science: 'Once you understand the angle pattern, you can deliberately steer reflected light.',
    replayPrompt: 'Try all three target positions again without guessing.'
  }
};



const SPOON_DISCOVERIES: Record<string, JournalDefinition> = {
  convex_upright_small: {
    id: 'convex_upright_small', kind: 'discovery', title: 'CONVEX: SMALL + UPRIGHT',
    summary: 'The outside of the spoon kept the reflection upright and made it look smaller.',
    science: 'A convex reflective surface spreads reflected rays outward, producing a smaller upright virtual image.',
    replayPrompt: 'Flip to the convex side and compare your reflection at different distances.'
  },
  concave_far_inverted: {
    id: 'concave_far_inverted', kind: 'discovery', title: 'CONCAVE: UPSIDE DOWN',
    summary: 'Farther from the inward-curved side, the reflection flipped upside down.',
    science: 'A concave surface can make reflected rays cross, creating an inverted image when the object is beyond the focal region.',
    replayPrompt: 'Use the concave side and move farther from the spoon.'
  },
  concave_near_upright: {
    id: 'concave_near_upright', kind: 'discovery', title: 'UPRIGHT AGAIN',
    summary: 'Very close to the concave side, the reflection turned upright again and grew larger.',
    science: 'Inside the focal distance, a concave reflector produces an upright magnified virtual image.',
    replayPrompt: 'Use the concave side and move very close to the spoon.'
  },
  distance_changes_image: {
    id: 'distance_changes_image', kind: 'discovery', title: 'DISTANCE CHANGES THE IMAGE',
    summary: 'Moving closer and farther changed the reflection even though the spoon stayed the same.',
    science: "The image depends on the object distance compared with the curved surface's focal distance.",
    replayPrompt: 'Keep the spoon on the concave side and move through near, middle, and far positions.'
  }
};

const SPOON_SECRETS: Record<string, JournalDefinition> = {
  flip_point: {
    id: 'flip_point', kind: 'secret', title: 'FLIP POINT',
    summary: 'You crossed the distance where the concave reflection changes from upright to inverted.',
    science: 'The focal region separates different image behaviors for a concave reflector.',
    replayPrompt: 'Move slowly between the near and middle positions and watch for the orientation change.'
  }
};


const FUNHOUSE_DISCOVERIES: Record<string, JournalDefinition> = {
  flat_same_shape: {
    id: 'flat_same_shape', kind: 'discovery', title: 'FLAT MIRROR',
    summary: 'The flat mirror kept the viewer close to the same proportions.',
    science: 'A flat mirror redirects reflected light without selectively magnifying one direction more than another.',
    replayPrompt: 'Choose the flat mirror and compare the reflection with the viewer.'
  },
  vertical_curve_stretches: {
    id: 'vertical_curve_stretches', kind: 'discovery', title: 'TALL STRETCH',
    summary: 'One curved mirror made the reflection look taller and narrower.',
    science: 'Curvature can change magnification differently in different directions, stretching one dimension more than another.',
    replayPrompt: 'Choose the tall mirror and compare height and width.'
  },
  horizontal_curve_squashes: {
    id: 'horizontal_curve_squashes', kind: 'discovery', title: 'WIDE SQUASH',
    summary: 'Another curved mirror made the reflection wider and shorter.',
    science: 'A differently oriented curve can increase sideways magnification while compressing the apparent height.',
    replayPrompt: 'Choose the wide mirror and compare the reflection with the same viewer.'
  },
  mixed_curve_warps: {
    id: 'mixed_curve_warps', kind: 'discovery', title: 'WAVY WARP',
    summary: 'Mixed curves warped different parts of the reflection by different amounts.',
    science: 'When curvature changes across a mirror, different reflected rays are redirected differently, producing a distorted image.',
    replayPrompt: 'Choose the wavy mirror and watch how several parts of the reflection change together.'
  }
};

const FUNHOUSE_SECRETS: Record<string, JournalDefinition> = {
  mirror_morph_master: {
    id: 'mirror_morph_master', kind: 'secret', title: 'MIRROR MORPH MASTER',
    summary: 'You tested all four mirror shapes and found the pattern behind the distortions.',
    science: 'The mirror shape controls how reflected light is redirected, so different curvatures create different image proportions.',
    replayPrompt: 'Cycle through all four mirrors and predict the reflection before selecting each one.'
  }
};

function fallbackEntry(id: string, kind: JournalEntryKind): JournalDefinition {
  const pretty = id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id,
    kind,
    title: pretty.toUpperCase(),
    summary: 'You discovered something worth remembering.',
    science: 'Try the experiment again and look closely for what changed.',
    replayPrompt: 'Return to the Discovery World and recreate this discovery.'
  };
}

export function buildDiscoveryJournal(progress: PlayerProgress): DiscoveryJournalEntry[] {
  const entries: DiscoveryJournalEntry[] = [];

  const addWorld = (
    worldId: string,
    discoveryDefinitions: Record<string, JournalDefinition>,
    secretDefinitions: Record<string, JournalDefinition>
  ) => {
    const world = progress.worldProgress[worldId];
    if (!world) return;
    for (const id of world.discoveries ?? []) {
      const definition = discoveryDefinitions[id] ?? fallbackEntry(id, 'discovery');
      entries.push({ ...definition, worldId });
    }
    for (const id of world.secrets ?? []) {
      const definition = secretDefinitions[id] ?? fallbackEntry(id, 'secret');
      entries.push({ ...definition, worldId });
    }
  };

  addWorld('shadow-chase', SHADOW_DISCOVERIES, SHADOW_SECRETS);
  addWorld('reflection-hunt', REFLECTION_DISCOVERIES, REFLECTION_SECRETS);
  addWorld('upside-down-spoon', SPOON_DISCOVERIES, SPOON_SECRETS);
  addWorld('funhouse-mirrors', FUNHOUSE_DISCOVERIES, FUNHOUSE_SECRETS);
  return entries;
}

export function countJournalSecrets(entries: readonly DiscoveryJournalEntry[]): number {
  return entries.filter((entry) => entry.kind === 'secret').length;
}
