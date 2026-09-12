-- Leaderboard, display name, privacy, and server-side streak (PT calendar days).
alter table profiles
  add column if not exists display_name text,
  add column if not exists display_name_changed_at timestamptz,
  add column if not exists hide_from_leaderboard boolean not null default false,
  add column if not exists streak_count int not null default 0,
  add column if not exists streak_last_day date,
  add column if not exists streak_rescue_available boolean not null default false,
  add column if not exists streak_rescue_deadline timestamptz,
  add column if not exists best_120 int not null default 0;

create unique index if not exists profiles_display_name_unique
  on profiles (lower(display_name))
  where display_name is not null
    and trim(display_name) <> '';
