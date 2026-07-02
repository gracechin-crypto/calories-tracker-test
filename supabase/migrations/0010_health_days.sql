create table if not exists health_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  steps integer not null default 0,
  active_kcal integer not null default 0,
  workouts jsonb not null default '[]',
  updated_at timestamptz default now(),
  unique(user_id, date)
);

alter table health_days enable row level security;

-- Owner read; writes come only from the health-sync API route via the
-- service role, so no insert/update policy is needed for regular users.
create policy "Users read own health days"
  on health_days for select using (auth.uid() = user_id);
