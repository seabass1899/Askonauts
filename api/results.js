export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const adminKey = process.env.PLAYTEST_ADMIN_KEY;
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!adminKey || !supplied || supplied !== adminKey) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ ok: false, error: 'Telemetry storage is not configured.' });
  }

  const select = [
    'session_id','build','age_band','source','tester_code','status','started_at','updated_at',
    'active_gameplay_ms','first_interaction_ms','first_quip_drag_ms','first_light_drag_ms',
    'first_light_toggle_ms','first_near_light_ms','first_near_wall_ms','core_discovery_ms',
    'quip_drag_count','light_drag_count','light_toggle_count','interaction_count',
    'continued_after_core_discovery','giant_quip_discovered','min_shadow_scale','max_shadow_scale',
    'feedback','raw_summary'
  ].join(',');

  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/playtest_sessions?select=${encodeURIComponent(select)}&order=started_at.desc&limit=200`;
  const response = await fetch(url, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  });

  if (!response.ok) {
    console.error('Supabase results error', response.status, (await response.text()).slice(0, 500));
    return res.status(502).json({ ok: false, error: 'Storage read failed.' });
  }

  const storedRows = await response.json();
  const rows = storedRows.map((row) => {
    const raw = row.raw_summary && typeof row.raw_summary === 'object' ? row.raw_summary : {};
    const mission = raw.mission && typeof raw.mission === 'object' ? raw.mission : null;
    const worlds = raw.worlds && typeof raw.worlds === 'object' ? raw.worlds : null;
    const { raw_summary: _rawSummary, ...base } = row;
    return {
      ...base,
      first_blocker_drag_ms: Number.isFinite(raw.firstBlockerDragMs) ? raw.firstBlockerDragMs : null,
      first_compass_tap_ms: Number.isFinite(raw.firstCompassTapMs) ? raw.firstCompassTapMs : null,
      blocker_drag_count: Number.isFinite(raw.blockerDragCount) ? raw.blockerDragCount : 0,
      compass_tap_count: Number.isFinite(raw.compassTapCount) ? raw.compassTapCount : 0,
      evidence_locked: Boolean(raw.evidenceLocked),
      free_play_interactions: Number.isFinite(mission?.freeExperimentInteractions) ? mission.freeExperimentInteractions : 0,
      question_gate_revealed: Boolean(raw.questionGateRevealed),
      question_gate_entered: Boolean(raw.questionGateEntered),
      question_gate_explore_more_count: Number.isFinite(raw.questionGateExploreMoreCount) ? raw.questionGateExploreMoreCount : 0,
      next_mission_prompt_seen: Boolean(raw.nextMissionPromptSeen),
      mission_completed: Boolean(raw.missionCompleted),
      time_to_question_gate_ms: Number.isFinite(raw.timeToQuestionGateMs) ? raw.timeToQuestionGateMs : null,
      time_gate_reveal_to_enter_ms: Number.isFinite(raw.timeGateRevealToEnterMs) ? raw.timeGateRevealToEnterMs : null,
      mission_stage: typeof mission?.stageId === 'string' ? mission.stageId : null,
      mission_sparks: Number.isFinite(mission?.sparks) ? mission.sparks : 0,
      mission_discoveries: Array.isArray(mission?.discoveries) ? mission.discoveries.length : 0,
      delight_event_count: Number.isFinite(raw.delightEventCount) ? raw.delightEventCount : 0,
      world_interaction_count: Number.isFinite(raw.worldInteractionCount) ? raw.worldInteractionCount : 0,
      world_secret_count: Array.isArray(raw.worldSecretsFound) ? raw.worldSecretsFound.length : 0,
      // P7.0: every world reports into raw_summary.worlds (no schema change needed).
      tap_count: Number.isFinite(raw.tapCount) ? raw.tapCount : 0,
      worlds_visited: worlds ? Object.keys(worlds).join(' ') : '',
      worlds_completed: worlds ? Object.values(worlds).filter((w) => w && w.completed).length : 0,
      world_discoveries: worlds ? Object.values(worlds).reduce((n, w) => n + (Array.isArray(w?.discoveries) ? w.discoveries.length : 0), 0) : 0
    };
  });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, rows });
}
