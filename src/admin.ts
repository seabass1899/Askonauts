import './style.css';

type Feedback = {
  helpNeeded?: string | null;
  wantedMore?: string | null;
  reactedToQuip?: string | null;
  parentWouldAllowMore?: string | null;
  skipped?: boolean;
} | null;

type ResultRow = {
  session_id: string;
  build: string;
  age_band: string;
  source: string;
  tester_code: string | null;
  status: string;
  started_at: string;
  updated_at: string;
  active_gameplay_ms: number | null;
  first_interaction_ms: number | null;
  first_quip_drag_ms: number | null;
  first_light_drag_ms: number | null;
  first_blocker_drag_ms: number | null;
  first_compass_tap_ms: number | null;
  first_light_toggle_ms: number | null;
  first_near_light_ms: number | null;
  first_near_wall_ms: number | null;
  core_discovery_ms: number | null;
  quip_drag_count: number;
  light_drag_count: number;
  blocker_drag_count: number;
  compass_tap_count: number;
  light_toggle_count: number;
  interaction_count: number;
  continued_after_core_discovery: boolean;
  giant_quip_discovered: boolean;
  evidence_locked: boolean;
  min_shadow_scale: number | null;
  max_shadow_scale: number | null;
  mission_stage: string | null;
  mission_sparks: number;
  mission_discoveries: number;
  delight_event_count: number;
  world_interaction_count: number;
  world_secret_count: number;
  free_play_interactions: number;
  tap_count: number;
  worlds_visited: string;
  worlds_completed: number;
  world_discoveries: number;
  question_gate_revealed: boolean;
  question_gate_entered: boolean;
  question_gate_explore_more_count: number;
  next_mission_prompt_seen: boolean;
  mission_completed: boolean;
  time_to_question_gate_ms: number | null;
  time_gate_reveal_to_enter_ms: number | null;
  feedback: Feedback;
};

const keyInput = document.querySelector<HTMLInputElement>('#admin-key')!;
const loadButton = document.querySelector<HTMLButtonElement>('#load-results')!;
const exportButton = document.querySelector<HTMLButtonElement>('#export-csv')!;
const statusText = document.querySelector<HTMLElement>('#admin-status')!;
const resultsSection = document.querySelector<HTMLElement>('#results')!;
const cards = document.querySelector<HTMLElement>('#summary-cards')!;
const body = document.querySelector<HTMLTableSectionElement>('#results-body')!;
let rows: ResultRow[] = [];

const stored = sessionStorage.getItem('askonauts-admin-key');
if (stored) keyInput.value = stored;

loadButton.addEventListener('click', () => void loadResults());
keyInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') void loadResults();
});
exportButton.addEventListener('click', exportCsv);

async function loadResults(): Promise<void> {
  const key = keyInput.value.trim();
  if (!key) {
    statusText.textContent = 'Enter the admin dashboard key.';
    return;
  }

  statusText.textContent = 'Loading…';
  loadButton.disabled = true;

  try {
    const response = await fetch('/api/results', {
      headers: { Authorization: `Bearer ${key}` }
    });
    if (!response.ok) throw new Error(response.status === 401 ? 'Incorrect admin key.' : 'Could not load results.');

    const data = await response.json() as { ok: boolean; rows: ResultRow[] };
    rows = data.rows ?? [];
    sessionStorage.setItem('askonauts-admin-key', key);
    render(rows);
    statusText.textContent = `${rows.length} session${rows.length === 1 ? '' : 's'} loaded.`;
    resultsSection.hidden = false;
    exportButton.disabled = rows.length === 0;
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : 'Could not load results.';
    resultsSection.hidden = true;
  } finally {
    loadButton.disabled = false;
  }
}

function render(data: ResultRow[]): void {
  body.innerHTML = '';

  const complete = data.filter((row) => row.status === 'completed');
  const base = complete.length ? complete : data;
  const pct = (predicate: (row: ResultRow) => boolean) => base.length
    ? `${Math.round((base.filter(predicate).length / base.length) * 100)}%`
    : '—';

  const medianFirst = median(base.map((row) => row.first_interaction_ms).filter(isNumber));
  const medianPlay = median(base.map((row) => row.active_gameplay_ms).filter(isNumber));
  const medianGate = median(base.map((row) => row.time_to_question_gate_ms).filter(isNumber));
  const medianGateEnter = median(base.map((row) => row.time_gate_reveal_to_enter_ms).filter(isNumber));

  cards.innerHTML = [
    card('Sessions', String(data.length)),
    card('Completed tests', String(complete.length)),
    card('Median first touch', formatMs(medianFirst)),
    card('Median active play', formatMs(medianPlay)),
    card('Reached Gate', pct((row) => row.question_gate_revealed)),
    card('Entered Gate', pct((row) => row.question_gate_entered)),
    card('Explore More', pct((row) => row.question_gate_explore_more_count > 0)),
    card('Mission complete', pct((row) => row.mission_completed)),
    card('Next mystery seen', pct((row) => row.next_mission_prompt_seen)),
    card('Median time → Gate', formatMs(medianGate)),
    card('Median Gate → Enter', formatMs(medianGateEnter)),
    card('Locked evidence', pct((row) => row.evidence_locked)),
    card('Found both extremes', pct((row) => row.first_near_light_ms !== null && row.first_near_wall_ms !== null)),
    card('Found GIANT QUIP', pct((row) => row.giant_quip_discovered)),
    card('Median delight beats', String(median(base.map((row) => row.delight_event_count)) ?? 0)),
    card('Median world touches', String(median(base.map((row) => row.world_interaction_count)) ?? 0)),
    card('Found a lab secret', pct((row) => row.world_secret_count > 0))
  ].join('');

  for (const row of data) {
    const tr = document.createElement('tr');
    const values = [
      new Date(row.started_at).toLocaleString(),
      row.build,
      row.age_band,
      row.status,
      formatMs(row.active_gameplay_ms),
      row.first_quip_drag_ms === null ? '—' : '✓',
      row.first_light_drag_ms === null ? '—' : '✓',
      row.first_blocker_drag_ms === null ? '—' : '✓',
      row.evidence_locked ? '✓' : '—',
      row.free_play_interactions,
      row.question_gate_revealed ? '✓' : '—',
      row.question_gate_entered ? '✓' : '—',
      row.question_gate_explore_more_count,
      row.mission_completed ? '✓' : '—',
      formatMs(row.time_to_question_gate_ms),
      row.mission_stage ?? '—',
      row.delight_event_count,
      row.world_interaction_count,
      row.world_secret_count,
      row.worlds_visited || '—',
      row.world_discoveries ?? 0,
      prettyFeedback(row.feedback?.parentWouldAllowMore)
    ];
    for (const value of values) {
      const td = document.createElement('td');
      td.textContent = String(value);
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
}

function card(label: string, value: string): string {
  return `<article class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function isNumber(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatMs(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const seconds = value / 1000;
  return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function prettyFeedback(value: string | null | undefined): string {
  if (!value) return '—';
  if (value === 'not_sure') return 'Maybe';
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
}

function exportCsv(): void {
  const headers = [
    'session_id','build','started_at','age_band','source','tester_code','status','active_gameplay_ms',
    'first_interaction_ms','first_quip_drag_ms','first_light_drag_ms','first_blocker_drag_ms','first_compass_tap_ms','first_light_toggle_ms',
    'first_near_light_ms','first_near_wall_ms','core_discovery_ms','quip_drag_count','light_drag_count','blocker_drag_count','compass_tap_count',
    'light_toggle_count','interaction_count','giant_quip_discovered','evidence_locked','free_play_interactions',
    'question_gate_revealed','question_gate_entered','question_gate_explore_more_count','next_mission_prompt_seen','mission_completed',
    'time_to_question_gate_ms','time_gate_reveal_to_enter_ms','mission_stage','mission_sparks','mission_discoveries','delight_event_count','world_interaction_count','world_secret_count',
    'tap_count','worlds_visited','worlds_completed','world_discoveries',
    'parent_help_needed','child_wanted_more','reacted_to_quip','parent_would_allow_more'
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = [
      row.session_id,row.build,row.started_at,row.age_band,row.source,row.tester_code ?? '',row.status,row.active_gameplay_ms,
      row.first_interaction_ms,row.first_quip_drag_ms,row.first_light_drag_ms,row.first_blocker_drag_ms,row.first_compass_tap_ms,row.first_light_toggle_ms,
      row.first_near_light_ms,row.first_near_wall_ms,row.core_discovery_ms,row.quip_drag_count,row.light_drag_count,row.blocker_drag_count,row.compass_tap_count,
      row.light_toggle_count,row.interaction_count,row.giant_quip_discovered,row.evidence_locked,row.free_play_interactions,
      row.question_gate_revealed,row.question_gate_entered,row.question_gate_explore_more_count,row.next_mission_prompt_seen,row.mission_completed,
      row.time_to_question_gate_ms,row.time_gate_reveal_to_enter_ms,row.mission_stage ?? '',row.mission_sparks,row.mission_discoveries,row.delight_event_count,row.world_interaction_count,row.world_secret_count,
      row.tap_count ?? 0,row.worlds_visited ?? '',row.worlds_completed ?? 0,row.world_discoveries ?? 0,
      row.feedback?.helpNeeded ?? '',row.feedback?.wantedMore ?? '',row.feedback?.reactedToQuip ?? '',row.feedback?.parentWouldAllowMore ?? ''
    ];
    lines.push(values.map(csvCell).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `askonauts-playtests-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);
}
