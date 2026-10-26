-- ---------------------------------------------------------------------------
-- Migration 0003: Application Branding & Settings
-- Supports global application name and logo customization, with fallback
-- columns on profiles for user-scoped branding preferences.
-- ---------------------------------------------------------------------------

create table if not exists app_branding (
  id text primary key default 'default',
  app_name text not null default 'GapFinder AI' check (char_length(trim(app_name)) between 1 and 60),
  logo_url text,
  updated_by uuid references auth.users on delete set null,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table app_branding enable row level security;

-- Everyone can read the global branding configuration
drop policy if exists "app_branding_read" on app_branding;
create policy "app_branding_read" on app_branding
  for select using (true);

-- Authenticated users can update or insert branding
drop policy if exists "app_branding_write" on app_branding;
create policy "app_branding_write" on app_branding
  for all to authenticated
  using (true)
  with check (true);

-- Seed initial row
insert into app_branding (id, app_name)
values ('default', 'GapFinder AI')
on conflict (id) do nothing;

-- Also add app_name and logo_url to user profiles as fallback
alter table profiles
  add column if not exists app_name text check (char_length(trim(app_name)) between 1 and 60),
  add column if not exists logo_url text;
