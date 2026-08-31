-- Run this once in your Supabase project's SQL editor (Database -> SQL editor -> New query).
-- Each signed-up user gets their own settings row and their own entries,
-- enforced by row-level security so users can never see each other's data.

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_salary numeric not null default 15000,
  hours_per_day numeric not null default 9,
  standard_monthly_hours numeric not null default 198,
  overtime_multiplier numeric not null default 1.5,
  currency text not null default 'EGP',
  holiday_days int[] not null default '{5,6}',
  updated_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.settings enable row level security;
alter table public.entries enable row level security;

drop policy if exists "Users manage their own settings" on public.settings;
create policy "Users manage their own settings"
  on public.settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own entries" on public.entries;
create policy "Users manage their own entries"
  on public.entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
