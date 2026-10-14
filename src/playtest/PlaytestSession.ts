import { PlaytestTelemetry } from '../game/systems/PlaytestTelemetry';
import { RemotePlaytestSync } from './RemotePlaytestSync';
import { getPlaytestContext } from './PlaytestContext';
import { onProgressEvent } from '../game/progress/PlayerProgressStore';

/**
 * P7.0: ONE playtest session for the whole visit, shared by every world.
 *
 * In P6.x, Shadow Chase created a new telemetry session (and a new upload
 * queue with its own page listeners) every time the scene started, so a child
 * who went Clubhouse -> Shadow Chase -> Clubhouse -> Shadow Chase produced
 * several partial sessions, and the other worlds recorded nothing.
 */
export type PlaytestSession = {
  telemetry: PlaytestTelemetry;
  sync: RemotePlaytestSync;
};

let session: PlaytestSession | null = null;

export function getPlaytestSession(): PlaytestSession {
  if (session) return session;

  const context = getPlaytestContext();
  let sync: RemotePlaytestSync | null = null;

  // Registered BEFORE the upload queue's own page-hide listener, so the
  // telemetry flushes its latest state into the queue first and the queue's
  // beacon sends that, not a state up to one second old.
  const flushOnHide = () => {
    if (!session) return;
    session.telemetry.noteHidden();
    session.telemetry.flush();
  };
  window.addEventListener('pagehide', flushOnHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnHide();
  });

  const telemetry = new PlaytestTelemetry(context, (summary) => sync?.queue(summary));
  sync = new RemotePlaytestSync(context);
  session = { telemetry, sync };

  onProgressEvent((event) => {
    telemetry.noteWorldProgress(event.worldId, event.kind, event.id);
  });

  return session;
}

/** Scene key -> world id used in telemetry and the dashboard. */
export const SCENE_WORLD_IDS: Record<string, string> = {
  ClubhouseScene: 'clubhouse',
  ShadowBoxScene: 'shadow-chase',
  ReflectionHuntScene: 'reflection-hunt',
  UpsideDownSpoonScene: 'upside-down-spoon',
  FunhouseMirrorsScene: 'funhouse-mirrors'
};
