-- Per-user IANA timezone for streak calendar days / rescue deadlines.
alter table profiles
  add column if not exists timezone text;
