-- Cadence M3 — initial schema
-- Run this in: Supabase dashboard → SQL Editor → paste → Run
-- Safe to re-run (uses IF NOT EXISTS everywhere).

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  duration_ms integer,
  storage_path text not null,
  mime_type text not null
);

create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists transcripts_session_id_idx
  on transcripts(session_id);

create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  dimensions jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index if not exists analyses_session_id_idx
  on analyses(session_id);

create index if not exists sessions_created_at_idx
  on sessions(created_at desc);
