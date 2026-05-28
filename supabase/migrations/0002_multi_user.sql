-- Cadence M5 — multi-user migration.
-- Run this in: Supabase dashboard → SQL Editor → paste → Run.
-- This drops existing test data (no real users have been on board yet).

-- Wipe and rebuild
drop table if exists analyses cascade;
drop table if exists transcripts cascade;
drop table if exists sessions cascade;
drop table if exists profiles cascade;

-- =========================================================================
-- profiles: one row per auth.users, holds Cadence-specific user data.
-- =========================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  digest_recipient text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_digest_recipient_idx on profiles(digest_recipient);

-- Auto-create a profile row whenever a new auth.users row is inserted.
-- digest_recipient defaults to the email used to sign up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, digest_recipient)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- sessions / transcripts / analyses — now user-scoped.
-- =========================================================================

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  duration_ms integer,
  storage_path text not null,
  mime_type text not null
);

create index sessions_user_id_idx on sessions(user_id);
create index sessions_created_at_idx on sessions(created_at desc);

create table transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create unique index transcripts_session_id_idx on transcripts(session_id);
create index transcripts_user_id_idx on transcripts(user_id);

create table analyses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dimensions jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index analyses_session_id_idx on analyses(session_id);
create index analyses_user_id_idx on analyses(user_id);

-- =========================================================================
-- Row Level Security — every read/write must match auth.uid().
-- The service-role admin client (used by the cron) bypasses RLS.
-- =========================================================================

alter table profiles enable row level security;
alter table sessions enable row level security;
alter table transcripts enable row level security;
alter table analyses enable row level security;

-- profiles
create policy "Profiles: read own"
  on profiles for select
  using (auth.uid() = id);

create policy "Profiles: update own"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- sessions
create policy "Sessions: read own"
  on sessions for select
  using (auth.uid() = user_id);

create policy "Sessions: insert own"
  on sessions for insert
  with check (auth.uid() = user_id);

create policy "Sessions: delete own"
  on sessions for delete
  using (auth.uid() = user_id);

-- transcripts
create policy "Transcripts: read own"
  on transcripts for select
  using (auth.uid() = user_id);

create policy "Transcripts: insert own"
  on transcripts for insert
  with check (auth.uid() = user_id);

-- analyses
create policy "Analyses: read own"
  on analyses for select
  using (auth.uid() = user_id);

create policy "Analyses: insert own"
  on analyses for insert
  with check (auth.uid() = user_id);
