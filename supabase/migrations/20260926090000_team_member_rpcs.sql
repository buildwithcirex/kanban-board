-- Phase 2 — Team membership RPCs.
--
-- Membership changes are multi-row writes (the membership, an activity entry, sometimes a
-- notification), so per docs/IMPLEMENTATION_PLAN.md §1.1 they belong in Postgres functions rather
-- than several client round trips.
--
-- All three are `security definer`, for two reasons: `add_team_member` has to look up an account
-- by email in `auth.users`, which `authenticated` cannot read, and all three write to `activity`,
-- which has no insert policy precisely so clients cannot forge it. That means each one re-checks
-- authorization itself; the RLS policies on `team_members` stay as defence in depth and the rules
-- are pinned from both directions by tests/rls/isolation.test.ts.
--
-- Error codes are chosen so the client can map them without parsing messages (see
-- src/lib/api/errors.ts):
--   42501 not allowed · P0002 no such account · 23505 already a member · 22023 bad argument

-- ---------------------------------------------------------------------------
-- add_team_member
-- ---------------------------------------------------------------------------

create or replace function public.add_team_member(
  p_team_id uuid,
  p_email text,
  p_role public.team_role default 'member'
)
returns public.team_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := (select auth.uid());
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_user   uuid;
  v_member public.team_members;
begin
  if v_actor is null or not public.is_team_admin(p_team_id) then
    raise exception 'Only team admins can add members' using errcode = '42501';
  end if;

  -- Ownership is transferred, never granted; there is exactly one owner per team.
  if p_role = 'owner' then
    raise exception 'A team cannot have a second owner' using errcode = '22023';
  end if;

  if v_email = '' then
    raise exception 'An email address is required' using errcode = '22023';
  end if;

  select u.id into v_user from auth.users u where lower(u.email) = v_email;

  -- Note: this tells a team admin whether an address has an account, which is the same signal
  -- Trello's invite box gives. Phase 11 replaces this with email invites, which removes the
  -- oracle for addresses that have not signed up.
  if v_user is null then
    raise exception 'No account uses that email address' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id and tm.user_id = v_user
  ) then
    raise exception 'Already a member of this team' using errcode = '23505';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (p_team_id, v_user, p_role)
  returning * into v_member;

  insert into public.activity (team_id, actor_id, type, payload)
  values (
    p_team_id, v_actor, 'team.member_added',
    jsonb_build_object('user_id', v_user, 'role', p_role)
  );

  insert into public.notifications (user_id, type, actor_id, team_id, payload)
  values (
    v_user, 'added_to_team', v_actor, p_team_id,
    jsonb_build_object('role', p_role)
  );

  return v_member;
end;
$$;

comment on function public.add_team_member(uuid, text, public.team_role) is
  'Adds an existing account to a team by email. Team admins only.';

-- ---------------------------------------------------------------------------
-- set_team_member_role
-- ---------------------------------------------------------------------------

create or replace function public.set_team_member_role(
  p_team_id uuid,
  p_user_id uuid,
  p_role public.team_role
)
returns public.team_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := (select auth.uid());
  v_member public.team_members;
begin
  if v_actor is null or not public.is_team_admin(p_team_id) then
    raise exception 'Only team admins can change roles' using errcode = '42501';
  end if;

  if p_role = 'owner' then
    raise exception 'A team cannot have a second owner' using errcode = '22023';
  end if;

  -- The owner's own row is untouchable, including by the owner: demoting it would leave the team
  -- without one.
  if exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id and tm.user_id = p_user_id and tm.role = 'owner'
  ) then
    raise exception 'The team owner''s role cannot be changed' using errcode = '42501';
  end if;

  update public.team_members tm
  set role = p_role
  where tm.team_id = p_team_id and tm.user_id = p_user_id
  returning * into v_member;

  if v_member is null then
    raise exception 'That person is not a member of this team' using errcode = 'P0002';
  end if;

  insert into public.activity (team_id, actor_id, type, payload)
  values (
    p_team_id, v_actor, 'team.member_role_changed',
    jsonb_build_object('user_id', p_user_id, 'role', p_role)
  );

  return v_member;
end;
$$;

-- ---------------------------------------------------------------------------
-- remove_team_member  (also how a member leaves)
-- ---------------------------------------------------------------------------

create or replace function public.remove_team_member(
  p_team_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role  public.team_role;
begin
  if v_actor is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Anyone may leave; removing someone else needs admin.
  if p_user_id <> v_actor and not public.is_team_admin(p_team_id) then
    raise exception 'Only team admins can remove members' using errcode = '42501';
  end if;

  select tm.role into v_role
  from public.team_members tm
  where tm.team_id = p_team_id and tm.user_id = p_user_id;

  if v_role is null then
    raise exception 'That person is not a member of this team' using errcode = 'P0002';
  end if;

  if v_role = 'owner' then
    raise exception 'The team owner cannot be removed. Delete the team instead.'
      using errcode = '42501';
  end if;

  delete from public.team_members tm
  where tm.team_id = p_team_id and tm.user_id = p_user_id;

  -- Boards they were on privately are no longer theirs to see.
  delete from public.board_members bm
  using public.boards b
  where bm.board_id = b.id
    and b.team_id = p_team_id
    and bm.user_id = p_user_id;

  insert into public.activity (team_id, actor_id, type, payload)
  values (
    p_team_id, v_actor, 'team.member_removed',
    jsonb_build_object('user_id', p_user_id, 'left', p_user_id = v_actor)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Signed-in users only.
-- ---------------------------------------------------------------------------

revoke all on function public.add_team_member(uuid, text, public.team_role) from public, anon;
revoke all on function public.set_team_member_role(uuid, uuid, public.team_role) from public, anon;
revoke all on function public.remove_team_member(uuid, uuid) from public, anon;

grant execute on function public.add_team_member(uuid, text, public.team_role) to authenticated;
grant execute on function public.set_team_member_role(uuid, uuid, public.team_role) to authenticated;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;
