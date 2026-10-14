import type { SandboxDiscoveryId } from '../missions/types';

export type SandboxObservation = {
  lightEnabled: boolean;
  quipInsideBeam: boolean;
  quipOccludedByBlocker: boolean;
  shadowVisible: boolean;
  shadowScale: number;
};

/**
 * P1.3D semantic discovery detector for the free-experiment stage.
 *
 * This system knows about observable light/shadow state only. It does not know
 * about MissionDirector stages, Sparks, Phaser rendering, or UI. The scene
 * decides when free experiment is active and forwards only new semantic
 * discoveries to MissionDirector.
 */
export class SandboxDiscoverySystem {
  private active = false;
  private previousInsideBeam = false;
  private previousOccluded = false;
  private previousGiant = false;
  private readonly discovered = new Set<SandboxDiscoveryId>();

  constructor(private readonly giantShadowScale = 3.35) {}

  public begin(observation: SandboxObservation): void {
    this.active = true;
    this.discovered.clear();
    this.previousInsideBeam = observation.quipInsideBeam;
    this.previousOccluded = observation.quipOccludedByBlocker;
    this.previousGiant = this.isGiant(observation);
  }

  public end(): void {
    this.active = false;
  }

  public update(observation: SandboxObservation): SandboxDiscoveryId[] {
    if (!this.active) return [];

    const added: SandboxDiscoveryId[] = [];
    const giant = this.isGiant(observation);

    // Discovery 1: Quip deliberately leaves the beam while the lamp remains on.
    if (
      observation.lightEnabled &&
      this.previousInsideBeam &&
      !observation.quipInsideBeam
    ) {
      this.addOnce('left_beam', added);
    }

    // Discovery 2: the rock blocks the direct lamp-to-Quip path.
    if (
      observation.lightEnabled &&
      observation.quipInsideBeam &&
      observation.quipOccludedByBlocker &&
      !this.previousOccluded
    ) {
      this.addOnce('blocker_occlusion', added);
    }

    // Discovery 3: cross into the GIANT shadow state during free experiment.
    if (giant && !this.previousGiant) {
      this.addOnce('giant_shadow', added);
    }

    this.previousInsideBeam = observation.quipInsideBeam;
    this.previousOccluded = observation.quipOccludedByBlocker;
    this.previousGiant = giant;

    return added;
  }

  public getDiscoveries(): readonly SandboxDiscoveryId[] {
    return [...this.discovered];
  }

  private isGiant(observation: SandboxObservation): boolean {
    return (
      observation.lightEnabled &&
      observation.shadowVisible &&
      Number.isFinite(observation.shadowScale) &&
      observation.shadowScale >= this.giantShadowScale
    );
  }

  private addOnce(id: SandboxDiscoveryId, added: SandboxDiscoveryId[]): void {
    if (this.discovered.has(id)) return;
    this.discovered.add(id);
    added.push(id);
  }
}
