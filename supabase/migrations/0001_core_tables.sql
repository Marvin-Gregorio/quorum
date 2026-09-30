-- supabase/migrations/0001_core_tables.sql

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text
);

create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

create table pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  organization_name text not null,
  title text not null,
  owner_id uuid not null references profiles(id),
  is_private boolean not null default false,
  voting_starts_at timestamptz not null,
  voting_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint voting_window_valid check (voting_ends_at > voting_starts_at)
);

create table allowed_domains (
  page_id uuid not null references pages(id) on delete cascade,
  domain text not null,
  primary key (page_id, domain)
);

create table positions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  title text not null,
  display_order int not null default 0
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references positions(id) on delete cascade,
  name text not null,
  bio text not null default '',
  photo_url text
);
