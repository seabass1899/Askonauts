import Phaser from 'phaser';
import { LightSource } from '../objects/LightSource';
import { QuipCharacter } from '../objects/QuipCharacter';
import { BlockerObject } from '../objects/BlockerObject';
import { QuestionCompass } from '../objects/QuestionCompass';
import { QuestionGate } from '../objects/QuestionGate';
import { DebugOverlay } from '../systems/DebugOverlay';
import { ReactionSystem } from '../systems/ReactionSystem';
import { SecretSystem } from '../systems/SecretSystem';
import type { PlaytestTelemetry } from '../systems/PlaytestTelemetry';
import { ShadowSystem } from '../systems/ShadowSystem';
import { BlockerShadowSystem } from '../systems/BlockerShadowSystem';
import { FreeExperimentHud } from '../systems/FreeExperimentHud';
import { LightLabEnvironment } from '../systems/LightLabEnvironment';
import { DelightSystem } from '../systems/DelightSystem';
import { DiscoveryFxSystem } from '../systems/DiscoveryFxSystem';
import { InteractiveWorldSystem } from '../systems/InteractiveWorldSystem';
import { CinematicDiscoverySystem } from '../systems/CinematicDiscoverySystem';
import { VoiceDirector } from '../systems/VoiceDirector';
import { AudioManager } from '../systems/AudioManager';
import { GlobalGameUI } from '../ui/GlobalGameUI';
import { LightConeSystem } from '../systems/LightConeSystem';
import { SandboxDiscoverySystem } from '../systems/SandboxDiscoverySystem';
import { getPlaytestSession } from '../../playtest/PlaytestSession';
import { MissionDirector } from '../missions/MissionDirector';
import { SHADOW_CHASE_MISSION } from '../missions/ShadowChaseMission';
import type { HintCue, MissionSignal, MissionStageId, SandboxDiscoveryId } from '../missions/types';
import { PlayerProgressStore } from '../progress/PlayerProgressStore';
import { BUILD_ID } from '../../buildInfo';

export class ShadowBoxScene extends Phaser.Scene {
  private light!: LightSource;
  private quip!: QuipCharacter;
  private blocker!: BlockerObject;
  private questionCompass!: QuestionCompass;
  private questionGate!: QuestionGate;
  private quipDragZone!: Phaser.GameObjects.Zone;
  private lightDragZone!: Phaser.GameObjects.Zone;
  private blockerDragZone!: Phaser.GameObjects.Zone;
  private shadowSystem!: ShadowSystem;
  private blockerShadowSystem!: BlockerShadowSystem;
  private reactionSystem!: ReactionSystem;
  private secretSystem!: SecretSystem;
  private debugOverlay!: DebugOverlay;
  private playtestTelemetry!: PlaytestTelemetry;
  private missionDirector!: MissionDirector;
  private freeExperimentHud!: FreeExperimentHud;
  private lightLabEnvironment!: LightLabEnvironment;
  private delightSystem!: DelightSystem;
  private discoveryFxSystem!: DiscoveryFxSystem;
  private interactiveWorld!: InteractiveWorldSystem;
  private cinematicDiscoverySystem!: CinematicDiscoverySystem;
  private audio!: AudioManager;
  private voice!: VoiceDirector;
  private lightCone!: LightConeSystem;
  private sandboxDiscoverySystem!: SandboxDiscoverySystem;
  private readonly progressStore = new PlayerProgressStore();

  private missionStartedAtPerf = 0;
  private missionDragObject: 'quip' | 'light' | 'blocker' | null = null;
  private missionDragStartX = 0;
  private missionDragStartY = 0;
  private missionMoveReported = false;
  private lastSandboxDiscoveryCount = 0;
  private latestShadowScale = 1;
  private latestShadowVisible = false;

  private beam!: Phaser.GameObjects.Graphics;
  private hasInteracted = false;
  private activeDragObject: Phaser.GameObjects.GameObject | null = null;
  private touchAffordances: Phaser.GameObjects.Arc[] = [];
  private idleInvitationEvent: Phaser.Time.TimerEvent | null = null;
  private fallbackHintEvent: Phaser.Time.TimerEvent | null = null;
  private ghostHintObjects: Phaser.GameObjects.GameObject[] = [];
  private quipTapStart: { x: number; y: number; at: number } | null = null;
  private lastPresentedHintKey: string | null = null;
  private evidenceRevealEvent: Phaser.Time.TimerEvent | null = null;

  private readonly wallX = 1100;
  private readonly wallBounds = new Phaser.Geom.Rectangle(982, 108, 225, 424);
  private readonly floorY = 548;
  private readonly beamCenterYAtWall = 372;
  private readonly beamHalfHeightAtWall = 138;

  constructor() {
    super('ShadowBoxScene');
  }

  preload(): void {
    this.load.image('quip-idle', '/assets/characters/quip/quip-idle.webp');
    this.load.image('quip-shadow-core-p12ahf1', '/assets/characters/quip/quip-shadow-core-p12ahf1.webp');
    this.load.image('quip-shadow-soft-p12ahf1', '/assets/characters/quip/quip-shadow-soft-p12ahf1.webp');
    this.load.image('light-lab-production-p12a', '/assets/environment/light-lab-production-p12a.webp');
    this.load.image('prop-telescope-p12bhf1', '/assets/props/telescope-p12bhf1.webp');
    this.load.image('prop-prism-p12bhf1', '/assets/props/prism-p12bhf1.webp');
    this.load.image('prop-question-jar-p12bhf1', '/assets/props/question-jar-p12bhf1.webp');
    this.load.image('prop-brass-dial-p12bhf1', '/assets/props/brass-dial-p12bhf1.webp');
    this.load.image('prop-rock-p12chf1', '/assets/props/rock-p12chf1.webp');
  }

  create(): void {
    this.createRoom();
    this.missionStartedAtPerf = performance.now();
    this.progressStore.setLastWorld('shadow-chase');

    this.light = new LightSource(this, 240, 405).setDepth(20);
    // P7.0: x=720 gives a medium opening shadow (~1.84x). At x=800 (P1.3A) the
    // opening shadow was 1.56x, already under the old 1.6x "tiny" threshold,
    // so the Size Hunt half-completed before the child touched anything.
    this.quip = new QuipCharacter(this, 720, 448).setDepth(20);
    this.blocker = new BlockerObject(this, 830, 310).setDepth(20);
    this.questionCompass = new QuestionCompass(this);
    this.questionGate = new QuestionGate(this);

    // Use a dedicated Zone for the lamp body as well. The lamp Container has
    // nested interactive children (especially the ON/OFF switch), and dragging
    // the Container itself can be less forgiving on a scaled touch canvas.
    // The zone deliberately stops above the switch so taps on ON/OFF remain taps.
    this.light.disableInteractive();
    this.lightDragZone = this.add
      .zone(this.light.x, this.light.y + 4, 220, 170)
      .setOrigin(0.5)
      .setInteractive()
      .setDepth(19);
    this.input.setDraggable(this.lightDragZone);
    // Use a dedicated Zone as Quip's touch/drag target. On mobile, dragging the
    // interactive Container itself can be inconsistent, especially after canvas
    // scaling. The Zone gives Quip one large, simple rectangular hit target.
    this.quip.disableInteractive();
    this.quipDragZone = this.add
      .zone(this.quip.x, this.quip.y, 280, 280)
      .setOrigin(0.5)
      .setInteractive()
      .setDepth(19);
    this.input.setDraggable(this.quipDragZone);

    // The blocker uses the same forgiving touch strategy. It begins hidden and
    // non-interactive, then unlocks only when the mission reaches block_it.
    this.blockerDragZone = this.add
      .zone(this.blocker.x, this.blocker.y, 190, 180)
      .setOrigin(0.5)
      .setDepth(19.5)
      .setVisible(false);

    this.beam = this.add.graphics().setDepth(1).setBlendMode(Phaser.BlendModes.ADD);

    // P7.0: the shared session for the whole visit (see PlaytestSession.ts),
    // instead of a new session every time this scene starts.
    this.playtestTelemetry = getPlaytestSession().telemetry;
    this.missionDirector = new MissionDirector(SHADOW_CHASE_MISSION, 0);
    this.audio = new AudioManager(this);
    this.voice = this.audio.voice;
    this.lightCone = new LightConeSystem(
      this.wallX,
      this.beamCenterYAtWall,
      this.beamHalfHeightAtWall
    );
    this.sandboxDiscoverySystem = new SandboxDiscoverySystem(3.35);
    this.playtestTelemetry.noteMissionState(this.missionDirector.getSnapshot());
    this.shadowSystem = new ShadowSystem(this, this.light, this.quip, this.wallX, this.wallBounds);
    this.blockerShadowSystem = new BlockerShadowSystem(
      this,
      this.light,
      this.blocker,
      this.wallX,
      this.wallBounds
    );
    this.reactionSystem = new ReactionSystem(this.quip, this.audio.sfx);
    this.secretSystem = new SecretSystem();
    this.freeExperimentHud = new FreeExperimentHud(
      this,
      3,
      SHADOW_CHASE_MISSION.thresholds.freeExperimentDiscoveryCount
    );
    this.delightSystem = new DelightSystem(this);
    this.discoveryFxSystem = new DiscoveryFxSystem(this);
    this.cinematicDiscoverySystem = new CinematicDiscoverySystem(this);
    this.interactiveWorld = new InteractiveWorldSystem(this, (event) => {
      this.audio.unlock();
      this.acknowledgeInteraction();
      this.playtestTelemetry.noteInteraction();
      this.playtestTelemetry.noteWorldInteraction(event.id, event.secret);
      this.playtestTelemetry.noteDelightEvent(`world:${event.id}`);
      this.audio.sfx.playWorldInteraction(event.id);
      this.quip.showReaction(event.reaction, event.quipCopy, event.secret ? 1850 : 1450);

      if (event.firstTime && event.secret && event.rewardCopy) {
        this.quip.celebrate();
        this.delightSystem.celebrateSecret(event.rewardCopy, event.x, event.y);
      }
    });
    this.delightSystem.showStage(
      this.missionDirector.getSnapshot().stageId,
      this.missionDirector.getSnapshot().sparks
    );

    this.questionCompass.on('compass-tapped', () => {
      this.audio.unlock();
      this.voice.unlock();
      this.voice.speak('compass.lock', 'Let’s lock the clues together.', { interrupt: true });
      this.audio.sfx.playCompassWake();
      this.playtestTelemetry.noteCompassTap();
    });
    this.questionCompass.on('evidence-confirmed', () => {
      this.voice.speak('evidence.locked', 'Evidence locked. Nice work, Askonaut.', { interrupt: true });
      this.audio.sfx.playEvidenceLock();
      this.playtestTelemetry.noteEvidenceLock();
      this.handleMissionSignal({
        type: 'evidence_confirmed',
        atMs: this.missionElapsedMs()
      });
    });

    this.questionGate.on('gate-revealed', () => {
      this.voice.speak('gate.reveal', 'Uh oh. I think we found another question.', { interrupt: true });
      this.audio.sfx.playGateWake();
      this.playtestTelemetry.noteQuestionGateRevealed();
      this.quip.showReaction('surprised', 'UH...\nWHAT IS THAT?!', 1700);
    });
    this.questionGate.on('choice-shown', () => {
      this.playtestTelemetry.noteQuestionGateChoiceShown();
      this.voice.speak('gate.choice', 'I see something shiny in there!');
      this.quip.showReaction('joy', 'I SEE SOMETHING\nSHINY IN THERE!', 1500);
    });
    this.questionGate.on('explore-more', () => {
      this.playtestTelemetry.noteQuestionGateExploreMore();
      this.voice.speak('gate.explore', 'More experiments? Excellent.');
      this.quip.showReaction('joy', 'MORE EXPERIMENTS?\nEXCELLENT.', 1500);

      const snapshot = this.missionDirector.getSnapshot();
      if ((snapshot.stageId === 'question_gate' || snapshot.stageId === 'complete') && snapshot.sandboxDiscoveries.length < 3) {
        this.freeExperimentHud.show();
        snapshot.sandboxDiscoveries.forEach((id) => this.freeExperimentHud.revealDiscovery(id));
      }
    });
    this.questionGate.on('gate-reopened', () => {
      this.playtestTelemetry.noteQuestionGateReopened();
      this.freeExperimentHud.hide();
    });
    this.questionGate.on('enter-gate', () => {
      this.voice.speak('gate.enter', 'Yes! Let’s go in!', { interrupt: true });
      this.audio.sfx.playGateEnter();
      this.playtestTelemetry.noteQuestionGateEntered();
      this.quip.showReaction('joy', 'YES! YES!\nLET’S GO IN!', 1500);
      this.handleMissionSignal({
        type: 'question_gate_entered',
        atMs: this.missionElapsedMs()
      });
    });
    this.questionGate.on('teaser-shown', () => {
      this.playtestTelemetry.noteNextMissionPromptSeen();
      this.voice.speak('gate.teaser', 'A spoon? Why is it doing that?', { interrupt: true });
      this.quip.showReaction('surprised', 'A SPOON?!\nWHY IS IT DOING THAT?', 1800);
    });
    this.questionGate.on('play-again', () => {
      this.progressStore.recordMissionSnapshot('shadow-chase', this.missionDirector.getSnapshot());
      this.scene.restart();
    });
    this.questionGate.on('return-clubhouse', () => {
      this.returnToClubhouse();
    });
    this.debugOverlay = new DebugOverlay(this);

    this.createTouchAffordances();
    this.configureInput();
    this.configureQuipTapEasterEgg();
    this.configureDebugToggle();
    new GlobalGameUI(this, this.progressStore, this.audio, {
      renderButtons: true, compact: true, startX: 1034, y: 41, showClubhouse: true
    });
    this.scheduleInteractionAffordances();
    this.time.addEvent({
      delay: 5200,
      loop: true,
      callback: () => {
        if (!this.activeDragObject && !this.playtestTelemetry.isSessionPaused()) {
          this.quip.playAmbientBeat();
        }
      }
    });

    this.time.addEvent({
      delay: 10000,
      loop: true,
      callback: () => this.playtestTelemetry.syncSnapshot()
    });
  }

  update(time: number): void {
    this.drawBeam();
    this.updateTouchAffordances();

    const quipIlluminated = this.isQuipIlluminated();
    const projection = this.shadowSystem.update(quipIlluminated);
    this.latestShadowScale = projection.scale;
    this.latestShadowVisible = projection.visible;
    this.playtestTelemetry.noteProjection(projection.scale, projection.visible);
    this.handleMissionSignal({
      type: 'shadow_observed',
      visible: projection.visible,
      scale: projection.visible ? projection.scale : null,
      y: projection.visible ? projection.y : null,
      atMs: this.missionElapsedMs()
    });

    const blockerBlocking = this.isBlockerInBeam();
    const blockerProjection = this.blockerShadowSystem.update(blockerBlocking);
    if (this.blocker.visible) {
      this.handleMissionSignal({
        type: 'blocker_observed',
        blockerId: 'rock',
        blocking: blockerBlocking,
        shadowVisible: blockerProjection.visible,
        atMs: this.missionElapsedMs()
      });
    }

    const sandboxStage = this.missionDirector.getSnapshot().stageId;
    if (sandboxStage === 'free_experiment' || sandboxStage === 'question_gate' || sandboxStage === 'complete') {
      const sandboxDiscoveries = this.sandboxDiscoverySystem.update(this.getSandboxObservation());
      for (const discoveryId of sandboxDiscoveries) {
        this.handleMissionSignal({
          type: 'sandbox_discovery',
          discoveryId,
          atMs: this.missionElapsedMs()
        });
      }
    }

    const reactionZone = this.reactionSystem.update({
      lightEnabled: this.light.enabled,
      shadowVisible: projection.visible,
      shadowScale: projection.scale
    });

    this.playtestTelemetry.noteZone(reactionZone);
    this.interactiveWorld.update({
      x: this.blocker.x,
      y: this.blocker.y,
      visible: this.blocker.visible
    });
    this.updateObjectDepths();

    if (
      this.secretSystem.update(time, this.light.enabled, projection.visible, projection.scale)
    ) {
      this.playtestTelemetry.noteSecret();
      this.handleMissionSignal({
        type: 'secret_discovered',
        secretId: 'giant_quip',
        atMs: this.missionElapsedMs()
      });
      this.playGiantQuipSecret();
      this.delightSystem.celebrateSecret('SECRET: GIANT QUIP!  ✦✦', this.quip.x, this.quip.y - 30);
      this.playtestTelemetry.noteDelightEvent('giant_quip_secret');
    }

    this.debugOverlay.update({
      shadowScale: projection.scale,
      shadowVisible: projection.visible,
      lightEnabled: this.light.enabled,
      lightX: this.light.x,
      lightY: this.light.y,
      quipX: this.quip.x,
      quipY: this.quip.y,
      zone: reactionZone,
      secretTriggered: this.secretSystem.isGiantTriggered()
    });
  }

  private createRoom(): void {
    this.lightLabEnvironment = new LightLabEnvironment(
      this,
      this.wallBounds,
      this.wallX,
      this.floorY
    );

    // P6.4F production chrome: keep the Light Lab artwork immersive while giving
    // Shadow Chase the same strong information hierarchy as the other finished worlds.
    this.add.rectangle(640, 41, 1268, 74, 0x06162f, 0.985)
      .setStrokeStyle(2, 0xd6ad54, 0.88)
      .setScrollFactor(0)
      .setDepth(1500);

    this.add.text(38, 18, '✦ ASKONAUTS', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '27px',
      fontStyle: 'bold',
      color: '#ffe384',
      stroke: '#253b67',
      strokeThickness: 4
    }).setScrollFactor(0).setDepth(1501);

    this.add.text(40, 53, `LIGHT LAB  •  SHADOW CHASE  •  ${BUILD_ID}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#67e8f9',
      letterSpacing: 0.6
    }).setScrollFactor(0).setDepth(1501);

    const identity = this.progressStore.getIdentity();
    const badge = (x: number, width: number, title: string, subtitle: string, stroke: number) => {
      this.add.rectangle(x, 41, width, 48, 0x091a31, 0.98)
        .setStrokeStyle(2, stroke, 0.88)
        .setScrollFactor(0)
        .setDepth(1501);
      this.add.text(x, 32, title, {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1502);
      this.add.text(x, 51, subtitle, {
        fontFamily: 'Arial, sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#93c5fd'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1502);
    };

    badge(570, 150, 'MASTER ASKONAUT', 'LIGHT & SHADOW', 0xd6ad54);
    badge(730, 142, identity.name || 'ASKONAUT', 'MY ASKONAUT', 0xa78bfa);
  }

  private createTouchAffordances(): void {
    const makeRing = (x: number, y: number, radius: number, color: number) => {
      const ring = this.add
        .circle(x, y, radius, color, 0)
        .setStrokeStyle(3, color, 0.34)
        .setAlpha(0.34)
        .setDepth(80);

      this.tweens.add({
        targets: ring,
        scaleX: 1.10,
        scaleY: 1.10,
        alpha: { from: 0.34, to: 0.10 },
        duration: 1350,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });

      this.touchAffordances.push(ring);
      return ring;
    };

    makeRing(this.light.x, this.light.y + 8, 64, 0xfde68a);
    makeRing(this.quip.x, this.quip.y + 4, 82, 0xc4b5fd);
  }

  private updateTouchAffordances(): void {
    if (this.hasInteracted || this.touchAffordances.length < 2) return;

    this.touchAffordances[0].setPosition(this.light.x, this.light.y + 8);
    this.touchAffordances[1].setPosition(this.quip.x, this.quip.y + 4);
  }

  private configureInput(): void {
    this.input.on('pointerdown', () => {
      this.audio.unlock();
      this.voice.unlock();
    });

    this.light.on('light-toggled', (enabled: boolean) => {
      this.audio.unlock();
      this.audio.sfx.playLampToggle(enabled);
      this.playtestTelemetry.noteLightToggle(enabled);
      this.lightLabEnvironment.setLightEnabled(enabled);
      this.handleMissionSignal({
        type: 'light_toggled',
        enabled,
        atMs: this.missionElapsedMs()
      });
      this.acknowledgeInteraction();
    });

    this.input.on(
      'dragstart',
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
        // P0.4 intentionally allows one active drag at a time. That is more
        // predictable for young players and prevents accidental two-finger chaos.
        if (this.activeDragObject && this.activeDragObject !== gameObject) return;

        this.activeDragObject = gameObject;
        this.audio.unlock();
        this.acknowledgeInteraction();

        if (gameObject === this.quip || gameObject === this.quipDragZone) {
          this.playtestTelemetry.noteDragStart('quip');
          this.beginMissionDrag('quip', this.quip.x, this.quip.y);
          this.quip.setGrabbed(true);
        }
        if (gameObject === this.light || gameObject === this.lightDragZone) {
          this.playtestTelemetry.noteDragStart('light');
          this.beginMissionDrag('light', this.light.x, this.light.y);
          this.light.setGrabbed(true);
        }
        if (gameObject === this.blockerDragZone && this.blocker.visible) {
          this.playtestTelemetry.noteDragStart('blocker');
          this.beginMissionDrag('blocker', this.blocker.x, this.blocker.y);
          this.blocker.setGrabbed(true);
        }
      }
    );

    this.input.on(
      'drag',
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number
      ) => {
        if (this.activeDragObject !== gameObject) return;

        if (gameObject === this.quip || gameObject === this.quipDragZone) {
          const minX = this.light.x + 125;
          const maxX = this.wallBounds.left - 88;
          const nextX = Phaser.Math.Clamp(dragX, minX, maxX);
          const nextY = Phaser.Math.Clamp(dragY, 300, this.floorY - 48);
          this.quip.setPosition(nextX, nextY);
          this.quipDragZone.setPosition(nextX, nextY);
          this.maybeReportMissionMove('quip', nextX, nextY);
        }

        if (gameObject === this.light || gameObject === this.lightDragZone) {
          const maxX = this.quip.x - 125;
          const nextX = Phaser.Math.Clamp(dragX, 120, maxX);
          const nextY = Phaser.Math.Clamp(dragY - 4, 225, this.floorY - 58);
          const deltaX = nextX - this.light.x;
          this.light.setPosition(nextX, nextY);
          this.light.noteDragged(deltaX);
          this.lightDragZone.setPosition(nextX, nextY + 4);
          this.maybeReportMissionMove('light', nextX, nextY);
        }

        if (gameObject === this.blockerDragZone && this.blocker.visible) {
          const emitter = this.light.getEmitterPoint();
          const minX = Math.max(390, emitter.x + 115);
          const maxX = this.wallBounds.left - 72;
          const nextX = Phaser.Math.Clamp(dragX, minX, maxX);
          const nextY = Phaser.Math.Clamp(dragY, 235, this.floorY - 38);
          const deltaX = nextX - this.blocker.x;
          this.blocker.setPosition(nextX, nextY);
          this.blocker.rollBy(deltaX);
          this.blockerDragZone.setPosition(nextX, nextY);
          this.maybeReportMissionMove('blocker', nextX, nextY);
        }
      }
    );

    this.input.on(
      'dragend',
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
        if (gameObject === this.quip || gameObject === this.quipDragZone) {
          this.playtestTelemetry.noteDragEnd('quip');
          this.quip.setGrabbed(false);
        }
        if (gameObject === this.light || gameObject === this.lightDragZone) {
          this.playtestTelemetry.noteDragEnd('light');
          this.light.setGrabbed(false);
        }
        if (gameObject === this.blockerDragZone && this.blocker.visible) {
          this.playtestTelemetry.noteDragEnd('blocker');
          this.blocker.setGrabbed(false);
        }
        this.endMissionDrag();
        if (this.activeDragObject === gameObject) this.activeDragObject = null;
      }
    );

    this.input.on('pointerup', () => {
      if (this.activeDragObject === this.quip || this.activeDragObject === this.quipDragZone) {
        this.quip.setGrabbed(false);
      }
      if (this.activeDragObject === this.light || this.activeDragObject === this.lightDragZone) {
        this.light.setGrabbed(false);
      }
      if (this.activeDragObject === this.blockerDragZone) {
        this.blocker.setGrabbed(false);
      }
      this.endMissionDrag();
      this.activeDragObject = null;
    });
  }

  private beginMissionDrag(object: 'quip' | 'light' | 'blocker', x: number, y: number): void {
    this.missionDragObject = object;
    this.missionDragStartX = x;
    this.missionDragStartY = y;
    this.missionMoveReported = false;
  }

  private maybeReportMissionMove(object: 'quip' | 'light' | 'blocker', x: number, y: number): void {
    if (this.missionDragObject !== object || this.missionMoveReported) return;

    const distance = Phaser.Math.Distance.Between(
      this.missionDragStartX,
      this.missionDragStartY,
      x,
      y
    );
    if (distance < 8) return;

    this.missionMoveReported = true;
    this.handleMissionSignal({
      type: 'object_moved',
      object,
      x,
      y,
      atMs: this.missionElapsedMs()
    });
  }

  private endMissionDrag(): void {
    this.missionDragObject = null;
    this.missionMoveReported = false;
  }

  private handleMissionSignal(signal: MissionSignal): void {
    const update = this.missionDirector.handle(signal);
    const snapshot = this.missionDirector.getSnapshot();
    this.playtestTelemetry.noteMissionUpdate(update, snapshot);
    this.progressStore.recordMissionSnapshot('shadow-chase', snapshot);
    this.presentMissionHint(update.activeHint, snapshot.stageId);

    if (update.discoveriesAdded.length > 0) {
      const heroDiscovery = this.discoveryFxSystem.celebrateDiscoveries(
        update.discoveriesAdded,
        {
          quipX: this.quip.x,
          quipY: this.quip.y,
          lightX: this.light.x,
          lightY: this.light.y,
          blockerX: this.blocker.x,
          blockerY: this.blocker.y,
          wallX: this.wallX,
          wallCenterY: this.wallBounds.centerY
        }
      );
      if (heroDiscovery) {
        this.audio.sfx.playDiscoveryFx(heroDiscovery);
        this.playtestTelemetry.noteDelightEvent(`discovery_fx:${heroDiscovery}`);
        const cinematicPlayed = this.cinematicDiscoverySystem.playDiscovery(
          heroDiscovery,
          {
            quipX: this.quip.x,
            quipY: this.quip.y,
            lightX: this.light.x,
            lightY: this.light.y,
            blockerX: this.blocker.x,
            blockerY: this.blocker.y,
            wallX: this.wallX,
            wallCenterY: this.wallBounds.centerY
          },
          this.discoveryFxSystem.getCompassAnchor(),
          () => this.discoveryFxSystem.pulseCompass()
        );
        if (cinematicPlayed) {
          this.audio.sfx.playCinematicCapture();
          this.playtestTelemetry.noteDelightEvent(`cinematic_discovery:${heroDiscovery}`);
        }
      }
    }

    if (update.stageChanged) {
      this.discoveryFxSystem.noteStageComplete(update.previousStageId);
      this.delightSystem.celebrateStage(
        update.previousStageId,
        update.sparksAdded,
        this.quip.x,
        this.quip.y - 30
      );
      this.delightSystem.hideForCinematicTransition();
      const transitionPlayed = this.cinematicDiscoverySystem.playStageTransition(
        update.previousStageId,
        snapshot.stageId,
        this.quip.x,
        this.quip.y - 10
      );
      const stageRevealDelay = transitionPlayed ? 760 : 0;
      this.time.delayedCall(stageRevealDelay, () => {
        const current = this.missionDirector.getSnapshot();
        if (current.stageId === snapshot.stageId) {
          this.delightSystem.showStage(snapshot.stageId, snapshot.sparks);
        }
      });
      this.lightLabEnvironment.pulseDiscovery();
      this.quip.celebrate();
      // Block It flows directly into a spoken evidence explanation. Keep the
      // visual reaction, but suppress the redundant stage voice so the evidence
      // narration gets a clean, uninterrupted turn.
      const suppressStageVoice =
        update.previousStageId === 'block_it' && snapshot.stageId === 'evidence_lock';
      this.playStageQuipLine(update.previousStageId, suppressStageVoice);
      this.audio.sfx.playDiscoveryReward(update.sparksAdded);
      this.playtestTelemetry.noteDelightEvent(`stage_complete:${update.previousStageId}`);
    } else if (update.sparksAdded > 0) {
      this.delightSystem.setSparks(snapshot.sparks);
    }

    if (snapshot.stageId === 'block_it' && !this.blocker.visible) {
      this.unlockBlocker();
    }

    if (update.stageChanged && snapshot.stageId === 'evidence_lock') {
      this.scheduleEvidenceReveal();
    }

    if (update.previousStageId === 'evidence_lock' && snapshot.stageId === 'free_experiment') {
      this.evidenceRevealEvent?.remove(false);
      this.evidenceRevealEvent = null;
      this.lastSandboxDiscoveryCount = 0;
      this.sandboxDiscoverySystem.begin(this.getSandboxObservation());
      this.questionGate.setLabSecretsProgress(0, 3);
      this.questionCompass.dismiss(() => {
        this.freeExperimentHud.show();
        this.quip.showReaction('joy', 'FIND TWO\nLIGHT SECRETS!', 1700);
        this.voice.speak(
          'free.start',
          'Can you find two new things light can do?',
          { priority: 20 }
        );
      });
    }

    if (signal.type === 'sandbox_discovery') {
      const sandboxCount = snapshot.sandboxDiscoveries.length;
      if (sandboxCount > this.lastSandboxDiscoveryCount) {
        this.lastSandboxDiscoveryCount = sandboxCount;
        this.freeExperimentHud.revealDiscovery(signal.discoveryId);
        this.audio.sfx.playCuriositySpark(sandboxCount);
        this.playSandboxDiscoveryReaction(signal.discoveryId, sandboxCount);
        this.questionGate.setLabSecretsProgress(sandboxCount, 3);
        this.playtestTelemetry.noteDelightEvent(`sandbox_discovery:${signal.discoveryId}`);
        if (sandboxCount >= 3) this.sandboxDiscoverySystem.end();
      }
    }

    if (update.previousStageId === 'free_experiment' && snapshot.stageId === 'question_gate') {
      this.questionGate.setLabSecretsProgress(snapshot.sandboxDiscoveries.length, 3);
      this.freeExperimentHud.complete();
      this.voice.speak('gate.detected', 'Oh! A new question!', { interrupt: true });
      this.audio.sfx.playQuestionDetected();
      this.quip.showReaction('joy', 'OOOH...\nA NEW QUESTION!', 1900);
      this.time.delayedCall(2200, () => {
        const current = this.missionDirector.getSnapshot();
        if (current.stageId === 'question_gate') this.questionGate.awaken();
      });
    }

    if (update.missionCompleted && snapshot.stageId === 'complete') {
      if (snapshot.sandboxDiscoveries.length >= 3) this.sandboxDiscoverySystem.end();
      this.playtestTelemetry.noteMissionCompleted();
    }
  }


  private scheduleEvidenceReveal(): void {
    this.evidenceRevealEvent?.remove(false);

    // Give the child a moment to see the rock shadow before Quip explains it.
    this.evidenceRevealEvent = this.time.delayedCall(900, () => {
      this.evidenceRevealEvent = null;
      const current = this.missionDirector.getSnapshot();
      if (current.stageId !== 'evidence_lock') return;

      void this.voice
        .speakAndWait(
          'evidence.observe',
          'Look at the rock’s shadow. We made that happen by blocking the light.',
          { interrupt: true, priority: 100, exclusive: true }
        )
        .then(() => {
          const afterVoice = this.missionDirector.getSnapshot();
          if (afterVoice.stageId !== 'evidence_lock') return;

          // Preserve a short reflective beat after the explanation so the
          // Compass feels like the next thought, not an interruption.
          this.evidenceRevealEvent = this.time.delayedCall(650, () => {
            this.evidenceRevealEvent = null;
            const beforeCompass = this.missionDirector.getSnapshot();
            if (beforeCompass.stageId === 'evidence_lock') {
              this.questionCompass.showEvidence();
            }
          });
        });
    });
  }

  private presentMissionHint(
    hint: { cue: HintCue; copyKey: string } | null,
    stageId: MissionStageId
  ): void {
    if (!hint || hint.cue === 'none') {
      this.lastPresentedHintKey = null;
      return;
    }

    const hintKey = `${stageId}:${hint.cue}:${hint.copyKey}`;
    if (hintKey === this.lastPresentedHintKey) return;
    this.lastPresentedHintKey = hintKey;

    switch (hint.cue) {
      case 'pulse_quip':
        this.quip.playIdleInvitation();
        this.pulseHintRing(this.quip.x, this.quip.y, 86, 0xc4b5fd);
        break;
      case 'pulse_light':
        this.light.playIdleInvitation();
        this.pulseHintRing(this.light.x, this.light.y, 82, 0xfde68a);
        break;
      case 'pulse_switch':
        // LightSource's switch sits low on the lamp body. Highlight the actual
        // control instead of merely recording the hint in telemetry.
        this.pulseHintRing(this.light.x, this.light.y + 121, 44, 0xfacc15);
        this.light.playIdleInvitation();
        break;
      case 'pulse_wall':
        this.pulseWallHint();
        break;
      case 'pulse_blocker':
        if (this.blocker.visible) {
          this.pulseHintRing(this.blocker.x, this.blocker.y, 72, 0xe2e8f0);
          this.tweens.add({
            targets: this.blocker,
            scaleX: 1.07,
            scaleY: 1.07,
            duration: 260,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.InOut'
          });
        }
        break;
      case 'pulse_compass':
        this.discoveryFxSystem.pulseCompass();
        break;
      case 'pulse_gate':
        this.pulseHintRing(838, 350, 138, 0xa78bfa);
        break;
      case 'character_nudge':
        this.showCharacterNudge(stageId);
        break;
    }
  }

  private pulseHintRing(x: number, y: number, radius: number, color: number): void {
    const ring = this.add
      .circle(x, y, radius, color, 0)
      .setStrokeStyle(5, color, 0.78)
      .setDepth(1700)
      .setAlpha(0.92);

    this.tweens.add({
      targets: ring,
      scaleX: 1.28,
      scaleY: 1.28,
      alpha: 0,
      duration: 680,
      repeat: 2,
      ease: 'Sine.Out',
      onComplete: () => ring.destroy()
    });
  }

  private pulseWallHint(): void {
    const frame = this.add
      .rectangle(
        this.wallBounds.centerX,
        this.wallBounds.centerY,
        this.wallBounds.width,
        this.wallBounds.height,
        0x7dd3fc,
        0
      )
      .setStrokeStyle(5, 0x7dd3fc, 0.72)
      .setDepth(1700);

    this.tweens.add({
      targets: frame,
      alpha: { from: 0.9, to: 0.08 },
      duration: 520,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.InOut',
      onComplete: () => frame.destroy()
    });
  }

  private showCharacterNudge(stageId: MissionStageId): void {
    const copy: Partial<Record<MissionStageId, string>> = {
      mystery: 'TRY MOVING ME.\nWHAT DOES IT DO?',
      shadow_follows: 'WHAT ELSE CAN\nCHANGE THE SHADOW?',
      light_matters: 'WHAT IF THE\nLIGHT CHANGES?',
      lights_out: 'TRY THE SWITCH.\nWHAT HAPPENS?',
      size_hunt: 'TRY NEAR...\nTHEN FAR.',
      block_it: 'WHAT CAN BLOCK\nTHE LIGHT?',
      evidence_lock: 'THE COMPASS\nIS WAITING.',
      free_experiment: 'CHANGE ONE THING.\nWHAT HAPPENS?',
      question_gate: 'THE GATE\nIS CALLING.'
    };
    const bubble = copy[stageId] ?? 'WHAT SHOULD WE\nTRY NEXT?';
    this.quip.showReaction('skeptical', bubble, 1800);

    const spoken: Partial<Record<MissionStageId, string>> = {
      mystery: 'Try moving me. What does my shadow do?',
      shadow_follows: 'What else can change the shadow?',
      light_matters: 'What if the light changes?',
      lights_out: 'Hmm. What happens if the light is not on?',
      size_hunt: 'Try near, then far. Watch the shadow.',
      block_it: 'What can block the light?',
      evidence_lock: 'The Question Compass is waiting.',
      free_experiment: 'Change one thing. What happens?',
      question_gate: 'The Gate is calling.'
    };
    this.voice.speak(`hint.${stageId}`, spoken[stageId] ?? 'What should we try next?');
  }


  private playStageQuipLine(stageId: MissionStageId, suppressVoice = false): void {
    const lines: Partial<Record<MissionStageId, { reaction: 'skeptical' | 'joy' | 'surprised'; bubble: string; spoken: string; ms: number }>> = {
      mystery: { reaction: 'skeptical', bubble: 'WAIT…\nIT MOVED WITH ME.', spoken: 'Wait. It moved with me.', ms: 1450 },
      shadow_follows: { reaction: 'joy', bubble: 'HA!\nIT REALLY FOLLOWS!', spoken: 'Ha! It really follows!', ms: 1450 },
      light_matters: { reaction: 'surprised', bubble: 'THE LIGHT\nMOVED IT TOO!', spoken: 'The light moved it too!', ms: 1500 },
      lights_out: { reaction: 'skeptical', bubble: 'NO LIGHT…\nNO SHADOW.', spoken: 'No light, no shadow.', ms: 1450 },
      size_hunt: { reaction: 'joy', bubble: 'TINY! HUGE!\nTHAT IS RIDICULOUS.', spoken: 'Tiny, huge! That is ridiculous!', ms: 1600 },
      block_it: { reaction: 'surprised', bubble: 'THE ROCK\nMADE ONE TOO!', spoken: 'The rock made a shadow too!', ms: 1550 },
      evidence_lock: { reaction: 'joy', bubble: 'CLUES LOCKED!\nNICE WORK, ASKONAUT.', spoken: 'Clues locked. Nice work, Askonaut.', ms: 1600 }
    };

    const line = lines[stageId];
    if (!line) return;
    this.quip.showReaction(line.reaction, line.bubble, line.ms);
    if (!suppressVoice) {
      this.voice.speak(`stage.${stageId}`, line.spoken, { interrupt: true, priority: 30 });
    }
  }

  private playSandboxDiscoveryReaction(id: SandboxDiscoveryId, count: number): void {
    const lines: Record<SandboxDiscoveryId, { reaction: 'skeptical' | 'joy' | 'surprised'; bubble: string; spoken: string }> = {
      left_beam: {
        reaction: 'surprised',
        bubble: 'HEY!\nMY SHADOW VANISHED!',
        spoken: 'Hey! My shadow disappeared, and the lamp is still on!'
      },
      blocker_occlusion: {
        reaction: 'skeptical',
        bubble: 'THE ROCK\nBLOCKED MY LIGHT!',
        spoken: 'The rock blocked the light before it reached me!'
      },
      giant_shadow: {
        reaction: 'joy',
        bubble: 'I DON’T EVEN\nFIT ON THE SCREEN!',
        spoken: 'Whoa! I do not even fit on the screen!'
      }
    };

    const line = lines[id];
    this.quip.showReaction(line.reaction, line.bubble, 1750);
    this.voice.speak(`sandbox.${id}`, line.spoken, { priority: 35 });

    if (count >= SHADOW_CHASE_MISSION.thresholds.freeExperimentDiscoveryCount) {
      this.time.delayedCall(900, () => {
        const current = this.missionDirector.getSnapshot();
        if (current.stageId === 'question_gate') return;
        this.quip.showReaction('joy', 'TWO SECRETS!\nWHAT ELSE IS HERE?', 1600);
      });
    }
  }


  private unlockBlocker(): void {
    // P7.0: the rock must appear OUT of the light, so the child has to place it.
    // In P6.5 it always appeared at (830, 310), inside the beam, which awarded
    // "Two Shadows" instantly. The beam moves with the lamp, so pick the first
    // spot that is clear of the beam and of Quip at the moment it appears.
    const spawn = this.pickBlockerSpawn();
    this.blocker.setPosition(spawn.x, spawn.y);
    this.blocker.unlock();
    this.blockerDragZone
      .setPosition(this.blocker.x, this.blocker.y)
      .setVisible(true)
      .setInteractive();
    this.input.setDraggable(this.blockerDragZone);

    // A small world-state change makes progression visible without giving away
    // the solution. The child still has to discover where to place the rock.
    const shelf = this.add
      .rectangle(this.blocker.x, this.blocker.y + 58, 150, 10, 0x475569, 0.85)
      .setDepth(8)
      .setAlpha(0);
    this.tweens.add({
      targets: shelf,
      alpha: 1,
      duration: 260,
      ease: 'Sine.Out'
    });
  }

  private pickBlockerSpawn(): { x: number; y: number } {
    const emitter = this.light.getEmitterPoint();
    const candidates = [
      { x: 830, y: 252 },
      { x: 560, y: 252 },
      { x: 860, y: 500 },
      { x: 560, y: 500 },
      { x: 700, y: 252 },
      { x: 700, y: 500 }
    ];
    // Clear of the beam by the rock's radius plus a margin, and far enough
    // from Quip that the two touch targets don't overlap.
    const clear = candidates.find((spot) => {
      const inBeam = this.lightCone.containsCircle(emitter, spot, 38 + 24);
      const nearQuip = Phaser.Math.Distance.Between(spot.x, spot.y, this.quip.x, this.quip.y) < 175;
      return !inBeam && !nearQuip;
    });
    return clear ?? candidates.find((spot) => !this.lightCone.containsCircle(emitter, spot, 38)) ?? candidates[0];
  }

  private isBlockerInBeam(): boolean {
    if (!this.blocker.visible || !this.light.enabled) return false;
    const emitter = this.light.getEmitterPoint();
    return this.lightCone.containsCircle(
      emitter,
      { x: this.blocker.x, y: this.blocker.y },
      38
    );
  }

  private isQuipInsideBeam(): boolean {
    if (!this.light.enabled) return false;
    const emitter = this.light.getEmitterPoint();
    return this.lightCone.containsCircle(
      emitter,
      { x: this.quip.x, y: this.quip.y },
      54
    );
  }

  private isQuipOccludedByBlocker(): boolean {
    if (!this.light.enabled || !this.blocker.visible || !this.isBlockerInBeam()) return false;
    if (!this.isQuipInsideBeam()) return false;

    const emitter = this.light.getEmitterPoint();
    return this.lightCone.blockerOccludesTarget(
      emitter,
      { x: this.quip.x, y: this.quip.y },
      { x: this.blocker.x, y: this.blocker.y },
      46
    );
  }

  private isQuipIlluminated(): boolean {
    return this.isQuipInsideBeam() && !this.isQuipOccludedByBlocker();
  }

  private getSandboxObservation() {
    return {
      lightEnabled: this.light.enabled,
      quipInsideBeam: this.isQuipInsideBeam(),
      quipOccludedByBlocker: this.isQuipOccludedByBlocker(),
      shadowVisible: this.latestShadowVisible,
      shadowScale: this.latestShadowScale
    };
  }

  private missionElapsedMs(): number {
    return Math.max(0, Math.round(performance.now() - this.missionStartedAtPerf));
  }

  private scheduleInteractionAffordances(): void {
    this.idleInvitationEvent?.remove(false);
    this.fallbackHintEvent?.remove(false);

    this.idleInvitationEvent = this.time.delayedCall(2600, () => {
      this.idleInvitationEvent = null;
      if (this.hasInteracted) return;

      this.quip.playIdleInvitation();
      this.voice.speak('intro.invite', 'Try moving me. What happens to my shadow?');
      this.time.delayedCall(480, () => {
        if (!this.hasInteracted) this.light.playIdleInvitation();
      });
    });

    this.fallbackHintEvent = this.time.delayedCall(8500, () => {
      this.fallbackHintEvent = null;
      if (!this.hasInteracted) this.showGhostDragHint();
    });
  }

  private showGhostDragHint(): void {
    if (this.hasInteracted) return;
    this.clearGhostDragHint();

    this.playGhostDragCue(this.quip.x, this.quip.y - 18, 56, 0xc4b5fd, () => {
      if (!this.hasInteracted) {
        this.playGhostDragCue(this.light.x, this.light.y - 4, 48, 0xfde68a);
      }
    });
  }

  private playGhostDragCue(
    x: number,
    y: number,
    distance: number,
    color: number,
    onComplete?: () => void
  ): void {
    if (this.hasInteracted) return;

    const trail = this.add.graphics().setDepth(1500).setAlpha(0.42);
    trail.lineStyle(3, color, 0.72);
    trail.lineBetween(x - distance, y, x + distance, y);

    const touch = this.add
      .circle(x - distance, y, 14, 0xffffff, 0.78)
      .setStrokeStyle(3, color, 0.95)
      .setDepth(1501);
    const center = this.add.circle(x - distance, y, 5, color, 0.92).setDepth(1502);

    const cueObjects: Phaser.GameObjects.GameObject[] = [trail, touch, center];
    this.ghostHintObjects.push(...cueObjects);

    this.tweens.add({
      targets: [touch, center],
      x: x + distance,
      duration: 640,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.InOut',
      onComplete: () => {
        if (this.hasInteracted) {
          this.clearGhostDragHint();
          return;
        }

        this.tweens.add({
          targets: cueObjects,
          alpha: 0,
          duration: 180,
          ease: 'Sine.Out',
          onComplete: () => {
            for (const object of cueObjects) object.destroy();
            this.ghostHintObjects = this.ghostHintObjects.filter(
              (object) => !cueObjects.includes(object)
            );
            onComplete?.();
          }
        });
      }
    });
  }

  private clearGhostDragHint(): void {
    for (const object of this.ghostHintObjects) {
      this.tweens.killTweensOf(object);
      object.destroy();
    }
    this.ghostHintObjects = [];
  }

  private updateObjectDepths(): void {
    // Production composition: whichever movable object is lower on the floor
    // reads in front. This prevents the blocker/cart from looking pasted over
    // Quip when their drag paths cross without changing any gameplay bounds.
    const blockerFront = this.blocker.visible && this.blocker.y > this.quip.y + 18;
    this.blocker.setDepth(blockerFront ? 24 : 18);
    this.quip.setDepth(blockerFront ? 20 : 24);
    this.quipDragZone.setDepth(blockerFront ? 19.5 : 23.5);
    // Input priority is independent from visual stacking: when the rock and
    // Quip touch targets overlap, the smaller rock target must always win.
    this.blockerDragZone.setDepth(this.quipDragZone.depth + 1);
  }


  private configureQuipTapEasterEgg(): void {
    this.quipDragZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.quipTapStart = { x: pointer.x, y: pointer.y, at: performance.now() };
    });

    this.quipDragZone.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const start = this.quipTapStart;
      this.quipTapStart = null;
      if (!start) return;

      const distance = Phaser.Math.Distance.Between(start.x, start.y, pointer.x, pointer.y);
      const elapsed = performance.now() - start.at;
      if (distance <= 12 && elapsed <= 520) {
        this.interactiveWorld.handleQuipTap();
      }
    });

    this.quipDragZone.on('pointerout', () => {
      this.quipTapStart = null;
    });
  }

  private configureDebugToggle(): void {
    this.input.keyboard?.on('keydown-D', () => {
      this.debugOverlay.toggle();
    });
  }


  private returnToClubhouse(): void {
    this.progressStore.recordMissionSnapshot('shadow-chase', this.missionDirector.getSnapshot());
    this.voice.stop();
    this.scene.start('ClubhouseScene');
  }

  private acknowledgeInteraction(): void {
    if (this.hasInteracted) return;
    this.hasInteracted = true;

    this.idleInvitationEvent?.remove(false);
    this.idleInvitationEvent = null;
    this.fallbackHintEvent?.remove(false);
    this.fallbackHintEvent = null;
    this.quip.stopIdleInvitation();
    this.light.stopIdleInvitation();
    this.clearGhostDragHint();

    for (const ring of this.touchAffordances) {
      this.tweens.killTweensOf(ring);
      this.tweens.add({
        targets: ring,
        alpha: 0,
        scaleX: 1.45,
        scaleY: 1.45,
        duration: 260,
        ease: 'Cubic.Out',
        onComplete: () => ring.destroy()
      });
    }

    this.touchAffordances = [];
  }

  private drawBeam(): void {
    this.beam.clear();

    if (!this.light.enabled) return;

    const emitter = this.light.getEmitterPoint();
    const startX = emitter.x;
    const startY = Phaser.Math.Clamp(emitter.y, 78, this.floorY);
    const centerYAtWall = this.beamCenterYAtWall;

    const drawCone = (halfHeight: number, alpha: number, color: number) => {
      const topY = Phaser.Math.Clamp(centerYAtWall - halfHeight, 78, this.floorY);
      const bottomY = Phaser.Math.Clamp(centerYAtWall + halfHeight, 78, this.floorY);

      this.beam.fillStyle(color, alpha);
      this.beam.beginPath();
      this.beam.moveTo(startX, startY);
      this.beam.lineTo(this.wallX, topY);
      this.beam.lineTo(this.wallX, bottomY);
      this.beam.closePath();
      this.beam.fillPath();
    };

    // P1.3C: the beam no longer aims at Quip. Its direction belongs to the
    // lamp/world, so Quip can genuinely step into and out of illumination.
    drawCone(175, 0.026, 0xfff7d6);
    drawCone(this.beamHalfHeightAtWall, 0.040, 0xfef3c7);
    drawCone(102, 0.060, 0xfde68a);

    this.beam.lineStyle(1.25, 0xfacc15, 0.20);
    this.beam.lineBetween(startX, startY, this.wallX, centerYAtWall);
  }

  private playGiantQuipSecret(): void {
    this.audio.sfx.playSecret();
    this.quip.showReaction('joy', 'BEHOLD...\nGIANT QUIP!', 2200);

    // P7.0: the separate "SECRET DISCOVERED" banner was removed; the reward
    // banner ("SECRET: GIANT QUIP!") already announces it through the lane.

    const ring = this.add
      .circle(this.quip.x, this.quip.y, 72, 0xfacc15, 0)
      .setStrokeStyle(4, 0xfacc15, 0.9)
      .setDepth(60);

    this.tweens.add({
      targets: ring,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 0,
      duration: 720,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy()
    });

    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12;
      const radius = Phaser.Math.Between(55, 88);
      const startX = this.quip.x + Math.cos(angle) * radius;
      const startY = this.quip.y + Math.sin(angle) * radius * 0.7;
      const star = this.add
        .text(startX, startY, index % 2 === 0 ? '✦' : '✨', {
          fontFamily: 'Arial, sans-serif',
          fontSize: `${Phaser.Math.Between(15, 24)}px`,
          color: index % 3 === 0 ? '#fef3c7' : '#fde047'
        })
        .setOrigin(0.5)
        .setDepth(170);

      this.tweens.add({
        targets: star,
        x: startX + Math.cos(angle) * Phaser.Math.Between(25, 55),
        y: startY + Math.sin(angle) * Phaser.Math.Between(20, 42) - 18,
        alpha: 0,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: Phaser.Math.Between(620, 920),
        ease: 'Cubic.Out',
        onComplete: () => star.destroy()
      });
    }
  }
}
