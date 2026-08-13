-- Run this once in the Supabase SQL Editor before enabling group rooms.
create table if not exists public.movie_rooms (
  code text primary key,
  status text not null check (status in ('lobby', 'voting', 'revealed', 'closed')),
  host_name text not null,
  host_member_id uuid not null,
  host_token_hash text not null,
  filters jsonb not null default '{}'::jsonb,
  candidates jsonb not null default '[]'::jsonb,
  winner_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.movie_room_members (
  id uuid primary key,
  room_code text not null references public.movie_rooms(code) on delete cascade,
  name text not null,
  token_hash text not null unique,
  joined_at timestamptz not null default now()
);

create table if not exists public.movie_room_votes (
  room_code text not null references public.movie_rooms(code) on delete cascade,
  member_id uuid not null references public.movie_room_members(id) on delete cascade,
  movie_id bigint not null,
  updated_at timestamptz not null default now(),
  primary key (room_code, member_id)
);

-- Each participant writes to their own row, so everyone can search at the
-- same time without one person's result overwriting another person's result.
create table if not exists public.movie_room_submissions (
  room_code text not null references public.movie_rooms(code) on delete cascade,
  member_id uuid not null references public.movie_room_members(id) on delete cascade,
  status text not null check (status in ('success', 'failed')),
  movie jsonb,
  error_message text not null default '',
  filters jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (room_code, member_id)
);

create index if not exists movie_room_members_room_code_idx
  on public.movie_room_members(room_code);
create index if not exists movie_room_votes_room_code_idx
  on public.movie_room_votes(room_code);
create index if not exists movie_room_submissions_room_code_idx
  on public.movie_room_submissions(room_code);
create index if not exists movie_rooms_expires_at_idx
  on public.movie_rooms(expires_at);

alter table public.movie_rooms enable row level security;
alter table public.movie_room_members enable row level security;
alter table public.movie_room_votes enable row level security;
alter table public.movie_room_submissions enable row level security;

-- There are intentionally no public RLS policies. The browser never receives
-- database credentials; the serverless room endpoint performs every operation.
