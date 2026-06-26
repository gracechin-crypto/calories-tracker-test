create table if not exists coaching_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  content text not null,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table coaching_notes enable row level security;

create policy "Users see own notes"
  on coaching_notes for all using (auth.uid() = user_id);
