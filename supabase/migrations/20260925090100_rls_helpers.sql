-- Phase 1 — Authorization helpers and table privileges.
--
-- Every policy in the next migration is expressed with these helpers, so the access rules exist
-- in exactly one place and can be unit-tested on their own.
--
-- Each helper is:
--   * `security definer` — it reads membership tables the caller may not be allowed to read, and
--     bypassing RLS inside the helper is what stops `team_members` policies recursing into
--     themselves. (Do NOT add `force row level security` to these tables; that would reintroduce
--     the recursion.)
--   * `stable` — the planner may cache it per statement.
--   * `set search_path = ''` with fully-qualified names — an attacker-controlled `search_path`
--     cannot make the function resolve to a different table or operator.
--
-- Policies call `(select auth.uid())` rather than `auth.uid()` so Postgres evaluates it once per
-- statement (InitPlan) instead of once per row.

-- ---------------------------------------------------------------------------
-- Privileges: authenticated users only, and only what they need.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on all sequences in schema public from anon;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on sequences from anon;

grant select, insert, update, delete on table
  public.profiles,
  public.teams,
  public.team_members,
  public.boards,
  public.board_members,
  public.lists,
  public.cards,
  public.card_assignees,
  public.labels,
  public.card_labels,
  public.checklists,
  public.checklist_items,
  public.comments,
  public.attachments,
  public.dependencies,
  public.push_subscriptions,
  public.notification_prefs
to authenticated;

-- Append-only feeds: the client reads them; rows are written by SECURITY DEFINER routines
-- (RPCs, triggers, cron, the send-push function) that run as the table owner.
grant select on table public.activity to authenticated;
grant select, update on table public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Team helpers
-- ---------------------------------------------------------------------------

create or replace function public.team_role(p_team_id uuid)
returns public.team_role
language sql
security definer
stable
set search_path = ''
as $$
  select tm.role
  from public.team_members tm
  where tm.team_id = p_team_id
    and tm.user_id = (select auth.uid());
$$;

comment on function public.team_role(uuid) is 'The caller''s role in the team, or NULL when they are not a member.';

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_team_admin(p_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = (select auth.uid())
      and tm.role = 'owner'
  );
$$;

-- True when the caller and the target user share at least one team. Gates profile visibility:
-- you can see the people you work with, and nobody else.
create or replace function public.shares_team_with(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members mine
    join public.team_members theirs on theirs.team_id = mine.team_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Board helpers
-- ---------------------------------------------------------------------------

-- A 'team' board is visible to the whole team; a 'private' board only to its board members
-- (who must themselves still be members of the owning team).
create or replace function public.can_access_board(p_board_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.boards b
    join public.team_members tm
      on tm.team_id = b.team_id
     and tm.user_id = (select auth.uid())
    where b.id = p_board_id
      and (
        b.visibility = 'team'
        or exists (
          select 1
          from public.board_members bm
          where bm.board_id = b.id
            and bm.user_id = (select auth.uid())
        )
      )
  );
$$;

-- Content edits (lists, cards, comments, …) additionally require the board not to be archived.
-- Archiving/unarchiving the board itself goes through the `boards` policy, not this helper.
create or replace function public.can_edit_board(p_board_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.boards b
    where b.id = p_board_id
      and not b.archived
  ) and public.can_access_board(p_board_id);
$$;

create or replace function public.is_board_team_admin(p_board_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.boards b
    join public.team_members tm
      on tm.team_id = b.team_id
     and tm.user_id = (select auth.uid())
    where b.id = p_board_id
      and tm.role in ('owner', 'admin')
  );
$$;

-- Is the given user a member of the team that owns this board? Used to stop outsiders being
-- added to a private board or assigned to a card.
create or replace function public.is_board_team_member(p_board_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.boards b
    join public.team_members tm on tm.team_id = b.team_id
    where b.id = p_board_id
      and tm.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Card helpers
-- ---------------------------------------------------------------------------

create or replace function public.can_access_card(p_card_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.can_access_board((select c.board_id from public.cards c where c.id = p_card_id));
$$;

create or replace function public.can_edit_card(p_card_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.cards c
    where c.id = p_card_id
      and not c.archived
      and c.deleted_at is null
      and public.can_edit_board(c.board_id)
  );
$$;

-- Can `p_user_id` be assigned to this card? Only members of the card's team, and only when the
-- caller may edit the card in the first place.
create or replace function public.can_assign_to_card(p_card_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.can_edit_card(p_card_id)
     and public.is_board_team_member(
           (select c.board_id from public.cards c where c.id = p_card_id),
           p_user_id
         );
$$;

create or replace function public.can_access_checklist(p_checklist_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.can_access_card((select cl.card_id from public.checklists cl where cl.id = p_checklist_id));
$$;

create or replace function public.can_edit_checklist(p_checklist_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.can_edit_card((select cl.card_id from public.checklists cl where cl.id = p_checklist_id));
$$;

-- ---------------------------------------------------------------------------
-- Only signed-in users may call the helpers.
-- ---------------------------------------------------------------------------

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'team_role', 'is_team_member', 'is_team_admin', 'is_team_owner', 'shares_team_with',
        'can_access_board', 'can_edit_board', 'is_board_team_admin', 'is_board_team_member',
        'can_access_card', 'can_edit_card', 'can_assign_to_card',
        'can_access_checklist', 'can_edit_checklist'
      )
  loop
    execute format('revoke all on function %s from public, anon', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end;
$$;
