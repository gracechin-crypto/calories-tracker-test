create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz default now(),
  expires_at timestamptz,
  revoked boolean not null default false
);

alter table share_links enable row level security;

-- Owners manage their own links. The public /share/[token] route reads via
-- the service role (server-only), so no public RLS policy is needed here.
create policy "Users manage own share links"
  on share_links for all using (auth.uid() = user_id);

create index if not exists share_links_token_idx on share_links (token);
