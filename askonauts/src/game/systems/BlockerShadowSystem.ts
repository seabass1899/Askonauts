import Phaser from 'phaser';
import type { LightSource } from '../objects/LightSource';
import type { BlockerObject } from '../objects/BlockerObject';
import { projectOntoVerticalWall, type ShadowProjection } from '../math/optics';

/** Renders the Block It shadow strictly inside the observation surface. */
export class BlockerShadowSystem {
  private readonly softShadow: Phaser.GameObjects.Image;
  private readonly coreShadow: Phaser.GameObjects.Image;
  private readonly wallBounds: Phaser.Geom.Rectangle;
  private readonly baseWidth = 92;
  private readonly baseHeight = 84;

  constructor(
    scene: Phaser.Scene,
    private readonly light: LightSource,
    private readonly blocker: BlockerObject,
    private readonly wallX: number,
    wallBounds: Phaser.Geom.Rectangle
  ) {
    this.wallBounds = new Phaser.Geom.Rectangle(wallBounds.x, wallBounds.y, wallBounds.width, wallBounds.height);


    this.softShadow = scene.add
      .image(wallX, blocker.y, 'prop-rock-p12chf1')
      .setTint(0x202124)
      .setDepth(2.2)
      .setVisible(false);

    this.coreShadow = scene.add
      .image(wallX, blocker.y, 'prop-rock-p12chf1')
      .setTint(0x17181b)
      .setDepth(3.2)
      .setVisible(false);
  }

  public update(blocking: boolean): ShadowProjection {
    const emitter = this.light.getEmitterPoint();
    const projection = projectOntoVerticalWall(
      emitter,
      { x: this.blocker.x, y: this.blocker.y },
      this.wallX,
      this.light.enabled && this.blocker.visible && blocking
    );

    this.softShadow.setVisible(projection.visible);
    this.coreShadow.setVisible(projection.visible);
    if (!projection.visible) return projection;

    const maxFitScale = Math.min(
      (this.wallBounds.width * 0.82) / this.baseWidth,
      (this.wallBounds.height * 0.45) / this.baseHeight
    );
    const visualScale = Phaser.Math.Clamp(projection.scale, 0.68, maxFitScale);
    const width = this.baseWidth * visualScale;
    const height = this.baseHeight * visualScale;
    const y = Phaser.Math.Clamp(
      projection.y,
      this.wallBounds.top + height / 2 + 4,
      this.wallBounds.bottom - height / 2 - 4
    );

    const softWidth = width * 1.075;
    const softHeight = height * 1.075;
    const softX = this.wallBounds.centerX + 3;
    const softY = y + 3;

    this.softShadow
      .setPosition(softX, softY)
      .setDisplaySize(softWidth, softHeight)
      .setAlpha(0.10);
    this.applyWallCrop(this.softShadow, softX, softY, softWidth, softHeight);

    this.coreShadow
      .setPosition(this.wallBounds.centerX, y)
      .setDisplaySize(width, height)
      .setAlpha(0.33);
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

    const cropX = ((visibleLeft - left) / displayWidth) * image.width;
    const cropY = ((visibleTop - top) / displayHeight) * image.height;
    const cropWidth = ((visibleRight - visibleLeft) / displayWidth) * image.width;
    const cropHeight = ((visibleBottom - visibleTop) / displayHeight) * image.height;
    image.setCrop(cropX, cropY, cropWidth, cropHeight);
  }
}
