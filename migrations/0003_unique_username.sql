-- One live account per username. Default placeholder 'player' is excluded so
-- unfinished OAuth rows can coexist until a real name is chosen. Deleting the
-- profile row frees the name.
create unique index if not exists profiles_username_unique
  on profiles (lower(username))
  where username is not null
    and username <> ''
    and lower(username) <> 'player';
