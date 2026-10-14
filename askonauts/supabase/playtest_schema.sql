-- ASKONAUTS P0.5.2 playtest telemetry
-- Run once in Supabase SQL Editor.

create table if not exists public.playtest_sessions (
  session_id text primary key,
  build text not null,
  age_band text not null check (age_band in ('6-7', '8-9', '10-11')),
  source text not null default 'direct',
  tester_code text,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null,
  updated_at timestamptz not null default now(),

  active_gameplay_ms integer,
  duration_ms integer,
  last_gameplay_event_ms integer,
  first_interaction_ms integer,
  first_quip_drag_ms integer,
  first_light_drag_ms integer,
  first_light_toggle_ms integer,
  first_near_light_ms integer,
  first_near_wall_ms integer,
  core_discovery_ms integer,

  quip_drag_count integer not null default 0,
  light_drag_count integer not null default 0,
  light_toggle_count integer not null default 0,
  interaction_count integer not null default 0,
  interactions_after_core_discovery integer not null default 0,
  seconds_after_core_discovery integer not null default 0,

  continued_after_core_discovery boolean not null default false,
  giant_quip_discovered boolean not null default false,
  min_shadow_scale numeric,
  max_shadow_scale numeric,

  zones_visited jsonb not null default '[]'::jsonb,
  device jsonb not null default '{}'::jsonb,
  events jsonb not null default '[]'::jsonb,
  feedback jsonb,
  raw_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists playtest_sessions_started_at_idx
  on public.playtest_sessions (started_at desc);
create index if not exists playtest_sessions_age_band_idx
  on public.playtest_sessions (age_band);
create index if not exists playtest_sessions_status_idx
  on public.playtest_sessions (status);

-- No browser client should read or write the table directly.
-- Vercel's server-side function uses a Supabase secret/service-role key.
alter table public.playtest_sessions enable row level security;

-- Deliberately create no anon/authenticated RLS policies.
-- With RLS enabled and no policies, public client keys cannot access these rows.
