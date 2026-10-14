import type { ParentFeedback, PlaytestSummary } from '../game/systems/PlaytestTelemetry';
import type { RemoteSyncState } from './RemotePlaytestSync';
import type { PlaytestSession } from './PlaytestSession';

/**
 * P7.0: the parent / playtest panel, as plain HTML over the game.
 *
 * P6.x drew it inside Shadow Chase only, so a parent whose child ended in any
 * other world had no way to finish the test. Being HTML, this one works the
 * same in every world (including Spoon Lab's painted header) and never has to
 * fit inside a scene's layout.
 */

type Choice<T extends string> = Array<[label: string, value: T]>;

const WORLD_NAMES: Record<string, string> = {
  clubhouse: 'Clubhouse',
  'shadow-chase': 'Shadow Chase',
  'reflection-hunt': 'Reflection Lab',
  'upside-down-spoon': 'Spoon Lab',
  'funhouse-mirrors': 'Funhouse Mirrors'
};

export function installParentPanel(session: PlaytestSession): void {
  const { telemetry, sync } = session;

  const button = el('button', 'parent-button', 'Parent');
  button.type = 'button';
  button.setAttribute('aria-label', 'Parent and playtest options');

  const overlay = el('div', 'parent-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.hidden = true;
  const card = el('section', 'parent-card');
  overlay.append(card);
  document.body.append(button, overlay);

  let syncState: RemoteSyncState = sync.getState();
  let view: 'status' | 'finish' | 'done' = 'status';
  let submitting = false;
  const feedback: Omit<ParentFeedback, 'skipped'> = {
    helpNeeded: null,
    wantedMore: null,
    reactedToQuip: null,
    parentWouldAllowMore: null
  };

  sync.subscribe((state) => {
    syncState = state;
    const label = card.querySelector('[data-sync]');
    if (label) label.textContent = syncLabel(state);
  });

  const open = () => {
    view = 'status';
    telemetry.pause();
    render();
    overlay.hidden = false;
    button.hidden = true;
  };
  const close = () => {
    overlay.hidden = true;
    button.hidden = false;
    telemetry.resume();
  };

  button.addEventListener('click', open);
  window.addEventListener('keydown', (event) => {
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if (typing || event.key.toLowerCase() !== 'p' || event.metaKey || event.ctrlKey) return;
    if (overlay.hidden) open();
    else if (view === 'status') close();
  });

  function render(): void {
    card.replaceChildren();
    if (view === 'status') renderStatus();
    else if (view === 'finish') renderFinish();
    else renderDone();
  }

  function renderStatus(): void {
    const summary = telemetry.getSummary();
    card.append(
      el('div', 'parent-kicker', 'ASKONAUTS PLAYTEST'),
      el('h2', '', 'Parent view'),
      el('p', 'parent-muted', 'The game is paused. Play data saves automatically; nothing to download.')
    );
    const sync = el('p', 'parent-sync', syncLabel(syncState));
    sync.dataset.sync = '';
    card.append(sync, summaryList(summary));

    const actions = el('div', 'parent-actions');
    actions.append(
      action('Resume play', close, 'primary'),
      action('Finish test', () => {
        view = 'finish';
        render();
      }),
      action('New test', () => {
        telemetry.clearStoredSession();
        window.location.reload();
      }, 'quiet')
    );
    card.append(actions);
  }

  function renderFinish(): void {
    card.append(
      el('div', 'parent-kicker', 'FINISH PLAYTEST'),
      el('h2', '', 'Four quick taps'),
      el('p', 'parent-muted', 'No typing needed.')
    );
    card.append(
      question('Did your child need help?', [['No', 'none'], ['A little', 'a_little'], ['A lot', 'a_lot']],
        feedback.helpNeeded, (v) => { feedback.helpNeeded = v; }),
      question('Did your child want to keep playing?', [['Yes', 'yes'], ['Not sure', 'not_sure'], ['No', 'no']],
        feedback.wantedMore, (v) => { feedback.wantedMore = v; }),
      question('Did your child laugh, smile, or react to Quip?', [['Yes', 'yes'], ['Not sure', 'not_sure'], ['No', 'no']],
        feedback.reactedToQuip, (v) => { feedback.reactedToQuip = v; }),
      question('Would you allow another short ASKONAUTS session?', [['Yes', 'yes'], ['Maybe', 'not_sure'], ['No', 'no']],
        feedback.parentWouldAllowMore, (v) => { feedback.parentWouldAllowMore = v; })
    );
    const status = el('p', 'parent-status');
    const actions = el('div', 'parent-actions');
    actions.append(
      action('Back', () => {
        view = 'status';
        render();
      }, 'quiet'),
      action('Submit & finish', () => void submit(false, status), 'primary'),
      action('Finish without questions', () => void submit(true, status))
    );
    card.append(actions, status);
  }

  function renderDone(): void {
    card.append(
      el('div', 'parent-kicker', 'PLAYTEST SAVED'),
      el('h2', '', 'Thank you for helping ASKONAUTS'),
      el('p', 'parent-muted', 'You can close this page now.')
    );
    const actions = el('div', 'parent-actions');
    actions.append(action('Start another test', () => {
      telemetry.clearStoredSession();
      window.location.reload();
    }, 'primary'));
    card.append(actions);
  }

  async function submit(skip: boolean, status: HTMLElement): Promise<void> {
    if (submitting) return;
    const answered = Object.values(feedback).every((value) => value !== null);
    if (!skip && !answered) {
      status.textContent = 'Please answer all four questions, or choose "Finish without questions".';
      return;
    }
    submitting = true;
    status.textContent = 'Saving…';
    const final: ParentFeedback = skip
      ? { helpNeeded: null, wantedMore: null, reactedToQuip: null, parentWouldAllowMore: null, skipped: true }
      : { ...feedback, skipped: false };
    telemetry.setParentFeedback(final);
    telemetry.flush();
    const saved = await sync.complete(telemetry.getSummary(), final);
    submitting = false;
    if (!saved) {
      status.textContent = 'Saved on this device. It will upload when the connection returns.';
      window.setTimeout(() => { view = 'done'; render(); }, 1600);
      return;
    }
    view = 'done';
    render();
  }

  function question<T extends string>(
    label: string,
    choices: Choice<T>,
    current: T | null,
    onPick: (value: T) => void
  ): HTMLElement {
    const row = el('div', 'parent-question');
    row.append(el('p', '', label));
    const group = el('div', 'parent-choices');
    for (const [text, value] of choices) {
      const choice = action(text, () => {
        onPick(value);
        group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        choice.setAttribute('aria-pressed', 'true');
      });
      choice.setAttribute('aria-pressed', current === value ? 'true' : 'false');
      group.append(choice);
    }
    row.append(group);
    return row;
  }
}

function summaryList(summary: PlaytestSummary): HTMLElement {
  const list = el('dl', 'parent-summary');
  const add = (term: string, value: string) => list.append(el('dt', '', term), el('dd', '', value));
  add('Active play', `${Math.round(summary.activeGameplayMs / 1000)} s`);
  add('Taps', String(summary.tapCount));
  const worlds = Object.entries(summary.worlds);
  add(
    'Worlds',
    worlds.length === 0
      ? 'None yet'
      : worlds
          .map(([id, w]) => `${WORLD_NAMES[id] ?? id}: ${w.discoveries.length} found${w.completed ? ', complete' : ''}`)
          .join(' · ')
  );
  if (summary.mission) add('Shadow Chase stage', summary.mission.stageId.replace(/_/g, ' '));
  add('Build', summary.build);
  return list;
}

function syncLabel(state: RemoteSyncState): string {
  return {
    idle: 'Saving starts after the first tap',
    saving: 'Saving…',
    saved: '✓ Saved automatically',
    offline: 'Offline — will save when back online',
    error: 'Save pending — will retry'
  }[state];
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function action(label: string, onClick: () => void, kind: 'primary' | 'quiet' | '' = ''): HTMLButtonElement {
  const button = el('button', `parent-action ${kind}`.trim(), label);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}
