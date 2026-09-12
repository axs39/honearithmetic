-- Weekly leaderboard: best completed 120s score for the current PT week only.
-- week_key e.g. 2026-W37 (ISO-like week, Monday 00:00 America/Los_Angeles).
alter table profiles
  add column if not exists best_120_week int not null default 0,
  add column if not exists week_key text;
