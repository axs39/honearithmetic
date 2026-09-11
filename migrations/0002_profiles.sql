create table if not exists profiles (
  user_id text primary key,
  username text not null default 'player',
  onboarded boolean not null default false,
  save_json text not null default '{}',
  updated_at timestamptz not null default now()
);
create index if not exists profiles_username_idx on profiles (username);
