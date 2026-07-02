-- Profiles table: first name + avatar URL per user
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  avatar_url text,
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users manage own profile"
  on profiles for all using (auth.uid() = user_id);

-- Avatars storage bucket: public read (avatars are non-sensitive; public
-- URLs avoid signed-URL expiry churn in the header), owner-only write.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Avatar owner insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Avatar owner update"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Avatar owner delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
