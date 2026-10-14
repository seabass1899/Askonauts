import Phaser from 'phaser';
import type { LightSource } from '../objects/LightSource';
import type { QuipCharacter } from '../objects/QuipCharacter';
import { projectOntoVerticalWall, type ShadowProjection } from '../math/optics';

/** P1.3A: preserve true projection scale and crop only at the observation-screen edges. */
export class ShadowSystem {
  private readonly softShadow: Phaser.GameObjects.Image;
  private readonly coreShadow: Phaser.GameObjects.Image;
  private readonly wallBounds: Phaser.Geom.Rectangle;
  private readonly baseWidth = 132;
  private readonly baseHeight = 158;

  constructor(
    scene: Phaser.Scene,
    private readonly light: LightSource,
    private readonly caster: QuipCharacter,
    private readonly wallX: number,
    wallBounds: Phaser.Geom.Rectangle
  ) {
    this.wallBounds = new Phaser.Geom.Rectangle(wallBounds.x, wallBounds.y, wallBounds.width, wallBounds.height);


    this.softShadow = scene.add
      .image(wallX, caster.y, 'quip-shadow-soft-p12ahf1')
      .setAlpha(0.18)
      .setDepth(2);

    this.coreShadow = scene.add
      .image(wallX, caster.y, 'quip-shadow-core-p12ahf1')
      .setAlpha(0.38)
      .setDepth(3);
  }

  public update(illuminated = this.light.enabled): ShadowProjection {
    const emitter = this.light.getEmitterPoint();
    const projection = projectOntoVerticalWall(
      emitter,
      { x: this.caster.x, y: this.caster.y },
      this.wallX,
      this.light.enabled && illuminated
    );

    this.softShadow.setVisible(projection.visible);
    this.coreShadow.setVisible(projection.visible);
    if (!projection.visible) return projection;

    // Render the real mathematical scale. A near-light shadow is allowed to
    // become larger than the observation screen; the screen edge crops it.
    // This keeps what the child sees aligned with the values MissionDirector
    // and telemetry are already using.
    const visualScale = Math.max(0.55, projection.scale);
    const scaleProgress = Phaser.Math.Clamp((visualScale - 0.7) / 3.8, 0, 1);
    const width = this.baseWidth * visualScale;
    const height = this.baseHeight * visualScale;
    const y = projection.y;

    const softExpansion = Phaser.Math.Linear(1.03, 1.10, scaleProgress);
    const softOffset = Phaser.Math.Linear(2, 6, scaleProgress);
    const softWidth = width * softExpansion;
    const softHeight = height * softExpansion;
    const softX = this.wallBounds.centerX + softOffset;
    const softY = y + softOffset * 0.35;

    this.softShadow
      .setPosition(softX, softY)
      .setDisplaySize(softWidth, softHeight)
      .setAlpha(Phaser.Math.Linear(0.12, 0.19, scaleProgress));
    this.applyWallCrop(this.softShadow, softX, softY, softWidth, softHeight);

    this.coreShadow
      .setPosition(this.wallBounds.centerX, y)
      .setDisplaySize(width, height)
      .setAlpha(Phaser.Math.Linear(0.40, 0.31, scaleProgress));
    this.applyWallCrop(this.coreShadow, this.wallBounds.centerX, y, width, height);

    return projection;
  }

  private applyWallCrop(
    image: Phaser.GameObjects.Image,
    centerX: number,
    centerY: number,
    displayWidth: number,
    displayHeight: number
  ): void {
    const left = centerX - displayWidth * 0.5;
    const top = centerY - displayHeight * 0.5;
    const right = left + displayWidth;
    const bottom = top + displayHeight;

    const visibleLeft = Math.max(left, this.wallBounds.left);
    const visibleTop = Math.max(top, this.wallBounds.top);
    const visibleRight = Math.min(right, this.wallBounds.right);
    const visibleBottom = Math.min(bottom, this.wallBounds.bottom);

    if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) {
      image.setVisible(false);
      return;
    }

    const sourceWidth = image.width;
    const sourceHeight = image.height;
    const cropX = ((visibleLeft - left) / displayWidth) * sourceWidth;
    const cropY = ((visibleTop - top) / displayHeight) * sourceHeight;
    const cropWidth = ((visibleRight - visibleLeft) / displayWidth) * sourceWidth;
    const cropHeight = ((visibleBottom - visibleTop) / displayHeight) * sourceHeight;

    image.setCrop(cropX, cropY, cropWidth, cropHeight);
  }
}
