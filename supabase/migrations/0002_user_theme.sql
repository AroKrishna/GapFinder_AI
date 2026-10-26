-- ---------------------------------------------------------------------------
-- Migration 0002: Add theme preference to user profiles
-- Safely defaults to 'system' and validates allowed values.
-- ---------------------------------------------------------------------------
alter table profiles
  add column if not exists theme text check (theme in ('light', 'dark', 'system')) default 'system';
