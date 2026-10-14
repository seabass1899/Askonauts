export type BeamPoint = {
  x: number;
  y: number;
};

export type LightConeGeometry = {
  emitter: BeamPoint;
  wallX: number;
  centerYAtWall: number;
  halfHeightAtWall: number;
};

/**
 * P1.3C real-light geometry helper.
 *
 * The cone is independent of Quip. Rendering and gameplay can both ask the
 * same geometry whether an object is illuminated without teaching the mission
 * engine anything about Phaser or beam polygons.
 */
export class LightConeSystem {
  constructor(
    private readonly wallX: number,
    private readonly centerYAtWall: number,
    private readonly halfHeightAtWall: number
  ) {}

  public geometry(emitter: BeamPoint): LightConeGeometry {
    return {
      emitter,
      wallX: this.wallX,
      centerYAtWall: this.centerYAtWall,
      halfHeightAtWall: this.halfHeightAtWall
    };
  }

  public centerYAtX(emitter: BeamPoint, x: number): number {
    const span = this.wallX - emitter.x;
    if (span <= 1) return emitter.y;
    const t = this.clamp01((x - emitter.x) / span);
    return emitter.y + (this.centerYAtWall - emitter.y) * t;
  }

  public halfHeightAtX(emitter: BeamPoint, x: number): number {
    const span = this.wallX - emitter.x;
    if (span <= 1) return 0;
    const t = this.clamp01((x - emitter.x) / span);
    return this.halfHeightAtWall * t;
  }

  public containsCircle(emitter: BeamPoint, point: BeamPoint, radius = 0): boolean {
    if (point.x <= emitter.x + 12 || point.x >= this.wallX) return false;
    const centerY = this.centerYAtX(emitter, point.x);
    const halfHeight = this.halfHeightAtX(emitter, point.x);
    return Math.abs(point.y - centerY) <= halfHeight + Math.max(0, radius);
  }

  /**
   * Approximate whether a circular blocker sits on the direct light ray from
   * emitter to target. This is intentionally forgiving: the goal is a child-
   * legible occlusion experiment, not pixel-perfect rigid-body optics.
   */
  public blockerOccludesTarget(
    emitter: BeamPoint,
    target: BeamPoint,
    blocker: BeamPoint,
    blockerRadius = 42
  ): boolean {
    if (blocker.x <= emitter.x + 12 || blocker.x >= target.x - 12) return false;
    const targetDx = target.x - emitter.x;
    if (targetDx <= 1) return false;

    const t = (blocker.x - emitter.x) / targetDx;
    const rayY = emitter.y + (target.y - emitter.y) * t;
    return Math.abs(blocker.y - rayY) <= blockerRadius;
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
