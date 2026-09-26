-- Phase 1 — Team RPC.
--
-- Creating a team is a two-row write: the team, and the owner membership that makes it visible.
-- Per docs/IMPLEMENTATION_PLAN.md §1.1 those belong in one Postgres function.
--
-- It is also the only way to create a team and read it back in one round trip. A plain
-- `insert ... returning` cannot work: RETURNING re-checks the SELECT policy on the new row, and
-- `teams_select_member` is still false at that instant because the AFTER INSERT trigger that adds
-- the owner has not fired yet. The trigger stays as a safety net so no team can exist ownerless.

create or replace function public.create_team(
  p_name text,
  p_description text default null,
  p_color text default null
)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_team public.teams;
begin
  if v_actor is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Length and format are enforced by the table's constraints and the hex_color domain.
  insert into public.teams (name, description, color, created_by)
  values (
    btrim(p_name),
    nullif(btrim(coalesce(p_description, '')), ''),
    coalesce(nullif(btrim(coalesce(p_color, '')), '')::public.hex_color, '#4b7bec'),
    v_actor
  )
  returning * into v_team;

  -- Belt and braces: the teams_create_owner_membership trigger has already done this.
  insert into public.team_members (team_id, user_id, role)
  values (v_team.id, v_actor, 'owner')
  on conflict (team_id, user_id) do update set role = 'owner';

  return v_team;
end;
$$;

comment on function public.create_team(text, text, text) is
  'Creates a team owned by the caller and returns it. Use instead of inserting into public.teams.';

revoke all on function public.create_team(text, text, text) from public, anon;
grant execute on function public.create_team(text, text, text) to authenticated;
