-- meals table
create table public.meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  description text not null,
  calories    integer not null,
  protein_g   numeric(6, 2) not null default 0,
  carbs_g     numeric(6, 2) not null default 0,
  fat_g       numeric(6, 2) not null default 0,
  logged_at   timestamptz not null default now()
);

alter table public.meals enable row level security;

create policy "Users can manage their own meals"
  on public.meals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- daily_goals table
create table public.daily_goals (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  calorie_target  integer not null default 2000,
  protein_target  numeric(6, 2) not null default 150,
  carb_target     numeric(6, 2) not null default 250,
  fat_target      numeric(6, 2) not null default 65
);

alter table public.daily_goals enable row level security;

create policy "Users can manage their own goals"
  on public.daily_goals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
