-- Cadence M7 — analysis status tracking for background queue.
-- Run in Supabase SQL Editor. Safe to re-run (uses IF NOT EXISTS).

-- Track where each session is in the analysis lifecycle:
--   pending     — created but worker hasn't picked it up yet
--   processing  — worker is running Whisper + Claude
--   completed   — transcript + analysis rows exist
--   failed      — terminal failure; analysis_error has the message
--
-- Existing rows default to 'completed' (they finished synchronously and
-- already have transcript + analysis attached).
alter table sessions
  add column if not exists analysis_status text not null default 'completed';

alter table sessions
  add column if not exists analysis_error text;

alter table sessions
  add column if not exists analysis_started_at timestamptz;

alter table sessions
  add column if not exists analysis_completed_at timestamptz;

create index if not exists sessions_analysis_status_idx
  on sessions(analysis_status)
  where analysis_status in ('pending', 'processing');
