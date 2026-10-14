export type Point = {
  x: number;
  y: number;
};

export type ShadowProjection = {
  x: number;
  y: number;
  scale: number;
  visible: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Projects the shadow-caster center point onto a vertical wall plane.
 *
 * A ray starts at the light and passes through the caster center:
 *   P(t) = L + t(Q - L)
 * We solve for t where P.x === wallX.
 *
 * The same similar-triangle ratio gives us an intuitive shadow scale.
 */
export function projectOntoVerticalWall(
  light: Point,
  object: Point,
  wallX: number,
  lightEnabled: boolean
): ShadowProjection {
  if (!lightEnabled) {
    return { x: wallX, y: object.y, scale: 1, visible: false };
  }

  const dx = object.x - light.x;
  const distanceLightToWall = wallX - light.x;

  // P0 assumes light -> caster -> wall, all from left to right.
  if (dx <= 20 || distanceLightToWall <= dx) {
    return { x: wallX, y: object.y, scale: 1, visible: false };
  }

  const t = distanceLightToWall / dx;
  const y = light.y + t * (object.y - light.y);

  return {
    x: wallX,
    y,
    scale: clamp(t, 0.55, 3.75),
    visible: true
  };
}
