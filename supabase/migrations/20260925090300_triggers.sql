-- Phase 1 — Lifecycle triggers.
--
-- These run as the table owner (`security definer`) because they write rows the calling user has
-- no direct policy for: a profile at sign-up, and the single owner membership of a new team.

-- ---------------------------------------------------------------------------
-- A profile for every auth user
-- ---------------------------------------------------------------------------

-- Deterministic avatar colour so the same person keeps the same colour everywhere.
create or replace function public.default_profile_color(p_id uuid)
returns public.hex_color
language sql
immutable
set search_path = ''
as $$
  -- 28 bits keeps the cast to `integer` non-negative, so the index is always 1..10.
  select (array[
    '#4b7bec', '#20bf6b', '#eb3b5a', '#f7b731', '#8854d0',
    '#0fb9b1', '#fa8231', '#2d98da', '#a55eea', '#26de81'
  ])[1 + (('x' || substr(md5(p_id::text), 1, 7))::bit(28)::integer % 10)]::public.hex_color;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Member'
  );

  insert into public.profiles (id, name, email, avatar_url, color)
  values (
    new.id,
    left(v_name, 80),
    coalesce(new.email, ''),
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    public.default_profile_color(new.id)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is 'Creates public.profiles row when an auth user is created.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Email stays owned by Supabase Auth
-- ---------------------------------------------------------------------------

-- Users may edit their own profile row, so without this a user could display a
-- teammate's address as their own. `profiles.email` is therefore writable only by
-- the sync path below, which sets the guard flag for the duration of its statement.
create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id <> old.id then
    raise exception 'profiles.id is immutable';
  end if;

  if new.email is distinct from old.email
     and coalesce(current_setting('app.syncing_auth_email', true), '') <> 'on' then
    new.email := old.email;
  end if;

  return new;
end;
$$;

create trigger profiles_protect_identity
  before update on public.profiles
  for each row execute function public.protect_profile_identity();

create or replace function public.handle_auth_user_email_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.syncing_auth_email', 'on', true);
  update public.profiles
  set email = coalesce(new.email, '')
  where id = new.id;
  perform set_config('app.syncing_auth_email', 'off', true);
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_auth_user_email_changed();

-- ---------------------------------------------------------------------------
-- Whoever creates a team owns it
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_team()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.team_members (team_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict (team_id, user_id) do update set role = 'owner';
  end if;
  return new;
end;
$$;

create trigger teams_create_owner_membership
  after insert on public.teams
  for each row execute function public.handle_new_team();

-- ---------------------------------------------------------------------------
-- created_by is a fact about the past
-- ---------------------------------------------------------------------------

create or replace function public.protect_created_by()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

create trigger teams_protect_created_by
  before update on public.teams
  for each row execute function public.protect_created_by();

create trigger boards_protect_created_by
  before update on public.boards
  for each row execute function public.protect_created_by();

create trigger cards_protect_created_by
  before update on public.cards
  for each row execute function public.protect_created_by();

-- These are internal plumbing, not an API surface.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_new_team() from public, anon, authenticated;
revoke all on function public.handle_auth_user_email_changed() from public, anon, authenticated;
revoke all on function public.protect_profile_identity() from public, anon, authenticated;
revoke all on function public.protect_created_by() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.default_profile_color(uuid) from public, anon;
