-- Vitalis schema for Supabase (Postgres). Run in the Supabase SQL editor or via `supabase db push`.
-- Synthetic data only. The backend is the ONLY client: it connects with the Postgres connection string.
-- RLS is enabled with NO policies, so the public anon/authenticated API roles can read or write nothing.

create table if not exists public.astronauts (
  id         text primary key,                 -- e.g. 'crew-01' (no real names)
  label      text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.check_ins (
  id           bigint generated always as identity primary key,
  astronaut_id text not null references public.astronauts(id) on delete cascade,
  day          int  not null check (day >= 1),
  hr     int           not null check (hr between 30 and 200),
  sbp    int           not null check (sbp between 60 and 220),
  ortho  int           not null check (ortho between 0 and 80),
  ex     int           not null check (ex between 0 and 480),
  bone   int           not null check (bone between 0 and 10),
  temp   numeric(3,1)  not null check (temp between 34 and 42),
  sym    int           not null check (sym between 0 and 6),
  sleep  numeric(3,1)  not null check (sleep between 0 and 16),
  mood   int           not null check (mood between 1 and 10),
  stress int           not null check (stress between 0 and 10),
  dose   numeric(5,2)  not null check (dose between 0 and 100),
  co2    int           not null check (co2 between 300 and 10000),
  created_at   timestamptz not null default now(),
  unique (astronaut_id, day)                   -- makes offline-queue sync idempotent
);
create index if not exists check_ins_astronaut_day_idx on public.check_ins (astronaut_id, day);

create table if not exists public.assistant_logs (
  id            bigint generated always as identity primary key,
  astronaut_id  text not null references public.astronauts(id) on delete cascade,
  question      text not null,
  answer        jsonb not null,
  model         text,
  fallback_used boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.astronauts      enable row level security;
alter table public.check_ins       enable row level security;
alter table public.assistant_logs  enable row level security;
-- Intentionally no policies. If you later add Supabase Auth, add per-user policies here.
