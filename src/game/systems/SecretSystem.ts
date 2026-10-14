export class SecretSystem {
  private giantStartTime: number | null = null;
  private giantTriggered = false;

  /**
   * Returns true exactly once when the player holds a giant shadow long enough.
   */
  public update(
    time: number,
    lightEnabled: boolean,
    shadowVisible: boolean,
    shadowScale: number
  ): boolean {
    if (this.giantTriggered) {
      return false;
    }

    const giantCondition = lightEnabled && shadowVisible && shadowScale >= 3.35;

    if (!giantCondition) {
      this.giantStartTime = null;
      return false;
    }

    if (this.giantStartTime === null) {
      this.giantStartTime = time;
      return false;
    }

    if (time - this.giantStartTime >= 2000) {
      this.giantTriggered = true;
      return true;
    }

    return false;
  }

  public isGiantTriggered(): boolean {
    return this.giantTriggered;
  }
}
