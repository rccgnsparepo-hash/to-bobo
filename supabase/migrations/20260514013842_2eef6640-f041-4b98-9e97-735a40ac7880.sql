
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1) || substr(new.id::text, 1, 4)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) <= 280),
  image_url text,
  created_at timestamptz not null default now()
);
create index posts_created_at_idx on public.posts (created_at desc);
alter table public.posts enable row level security;
create policy "posts readable by authenticated" on public.posts for select to authenticated using (true);
create policy "users create own posts" on public.posts for insert to authenticated with check (auth.uid() = author_id);
create policy "users delete own posts" on public.posts for delete to authenticated using (auth.uid() = author_id);

-- likes
create table public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.likes enable row level security;
create policy "likes readable" on public.likes for select to authenticated using (true);
create policy "users like" on public.likes for insert to authenticated with check (auth.uid() = user_id);
create policy "users unlike" on public.likes for delete to authenticated using (auth.uid() = user_id);

-- stories (24h)
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  caption text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index stories_expires_idx on public.stories (expires_at);
alter table public.stories enable row level security;
create policy "stories readable if not expired" on public.stories for select to authenticated using (expires_at > now());
create policy "users create own stories" on public.stories for insert to authenticated with check (auth.uid() = author_id);
create policy "users delete own stories" on public.stories for delete to authenticated using (auth.uid() = author_id);

-- messages (disappearing DMs)
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index messages_pair_idx on public.messages (sender_id, recipient_id, created_at desc);
alter table public.messages enable row level security;
create policy "messages readable by participants if not expired" on public.messages for select to authenticated
  using ((auth.uid() = sender_id or auth.uid() = recipient_id) and expires_at > now());
create policy "users send messages" on public.messages for insert to authenticated with check (auth.uid() = sender_id);
create policy "participants delete messages" on public.messages for delete to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.stories;

-- storage bucket
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
create policy "auth upload media" on storage.objects for insert to authenticated with check (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "auth delete own media" on storage.objects for delete to authenticated using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
