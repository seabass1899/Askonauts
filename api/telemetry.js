const ALLOWED_AGE_BANDS = new Set(['6-7', '8-9', '10-11']);
const ALLOWED_STATUS = new Set(['in_progress', 'completed']);
const BUILD_ID_PATTERN = /^P\d[\w.-]*$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ ok: false, error: 'Telemetry storage is not configured.' });
  }

  try {
    const body = normalizeBody(req.body);
    const { context, summary, status = 'in_progress', feedback = null } = body || {};

    if (!summary || !isBuildId(summary.build)) return res.status(400).json({ ok: false, error: 'Invalid build.' });
    if (!isSessionId(summary.sessionId)) return res.status(400).json({ ok: false, error: 'Invalid session ID.' });
    if (!context || !ALLOWED_AGE_BANDS.has(context.ageBand)) return res.status(400).json({ ok: false, error: 'Invalid age band.' });
    if (!ALLOWED_STATUS.has(status)) return res.status(400).json({ ok: false, error: 'Invalid status.' });

    const record = {
      session_id: summary.sessionId,
      build: summary.build,
      age_band: context.ageBand,
      source: safeShort(context.source, 40),
      tester_code: context.testerCode ? safeShort(context.testerCode, 40) : null,
      status,
      started_at: summary.startedAt,
      updated_at: new Date().toISOString(),
      active_gameplay_ms: asNullableInt(summary.activeGameplayMs),
      duration_ms: asNullableInt(summary.durationMs),
      last_gameplay_event_ms: asNullableInt(summary.lastGameplayEventMs),
      first_interaction_ms: asNullableInt(summary.firstInteractionMs),
      first_quip_drag_ms: asNullableInt(summary.firstQuipDragMs),
      first_light_drag_ms: asNullableInt(summary.firstLightDragMs),
      first_light_toggle_ms: asNullableInt(summary.firstLightToggleMs),
      first_near_light_ms: asNullableInt(summary.firstNearLightMs),
      first_near_wall_ms: asNullableInt(summary.firstNearWallMs),
      core_discovery_ms: asNullableInt(summary.coreDiscoveryMs),
      quip_drag_count: asNullableInt(summary.quipDragCount) ?? 0,
      light_drag_count: asNullableInt(summary.lightDragCount) ?? 0,
      light_toggle_count: asNullableInt(summary.lightToggleCount) ?? 0,
      interaction_count: asNullableInt(summary.interactionCount) ?? 0,
      interactions_after_core_discovery: asNullableInt(summary.interactionsAfterCoreDiscovery) ?? 0,
      seconds_after_core_discovery: asNullableInt(summary.secondsAfterCoreDiscovery) ?? 0,
      continued_after_core_discovery: Boolean(summary.continuedAfterCoreDiscovery),
      min_shadow_scale: asNullableNumber(summary.minShadowScale),
      max_shadow_scale: asNullableNumber(summary.maxShadowScale),
      giant_quip_discovered: Boolean(summary.giantQuipDiscovered),
      zones_visited: Array.isArray(summary.zonesVisited) ? summary.zonesVisited.slice(0, 10) : [],
      device: sanitizeJson(summary.device, 4000),
      events: sanitizeJson(summary.events, 50000),
      feedback: feedback ? sanitizeJson(feedback, 4000) : null,
      raw_summary: sanitizeJson(summary, 70000)
    };

    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/playtest_sessions?on_conflict=session_id`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(record)
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Supabase telemetry error', response.status, detail.slice(0, 500));
      return res.status(502).json({ ok: false, error: 'Storage write failed.' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Telemetry endpoint error', error);
    return res.status(400).json({ ok: false, error: 'Invalid request.' });
  }
}

function normalizeBody(body) {
  if (!body) return null;
  if (typeof body === 'string') return JSON.parse(body);
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8'));
  return body;
}

function isBuildId(value) {
  return typeof value === 'string' && value.length <= 32 && BUILD_ID_PATTERN.test(value);
}

function isSessionId(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 80 && /^[a-zA-Z0-9-]+$/.test(value);
}

function safeShort(value, max) {
  return String(value ?? '').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, max) || 'direct';
}

function asNullableInt(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}

function asNullableNumber(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function sanitizeJson(value, maxChars) {
  const serialized = JSON.stringify(value ?? null);
  if (serialized.length > maxChars) throw new Error('Payload section too large');
  return JSON.parse(serialized);
}
