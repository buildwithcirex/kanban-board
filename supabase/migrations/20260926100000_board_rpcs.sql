-- Phase 3 — Boards.
--
-- Two things here:
--
-- 1. `boards_select` no longer reads the `boards` table to decide whether you can see a row of
--    `boards`. The policy already has the row, so it can test `team_id` and `visibility`
--    directly. Besides being one function call per row instead of a join plus a subquery, this
--    removes a trap: the old policy could not see the row being inserted by the same statement,
--    so `insert ... returning` on a team board was refused with 42501 — the same surprise that
--    forced `create_team` to exist.
--
-- 2. `create_board`, because making a board is a multi-row write: the board, the creator's
--    membership when it is private, its starting lists, and an activity entry. It is also the
--    only way to create a *private* board and read it back, since its `board_members` row does
--    not exist yet while RETURNING re-checks the SELECT policy.

-- ---------------------------------------------------------------------------
-- Membership of a private board, without reading `boards`
-- ---------------------------------------------------------------------------

create or replace function public.is_board_member(p_board_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.board_members bm
    where bm.board_id = p_board_id
      and bm.user_id = (select auth.uid())
  );
$$;

comment on function public.is_board_member(uuid) is
  'Is the caller on this board''s member list? Only meaningful for private boards.';

revoke all on function public.is_board_member(uuid) from public, anon;
grant execute on function public.is_board_member(uuid) to authenticated;

drop policy boards_select on public.boards;

create policy boards_select on public.boards
  for select to authenticated
  using (
    public.is_team_member(team_id)
    and (visibility = 'team' or public.is_board_member(id))
  );

-- ---------------------------------------------------------------------------
-- create_board
-- ---------------------------------------------------------------------------

create or replace function public.create_board(
  p_team_id uuid,
  p_title text,
  p_position text,
  p_visibility public.board_visibility default 'team',
  p_background text default null,
  p_with_default_lists boolean default true
)
returns public.boards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_board public.boards;
begin
  if v_actor is null or not public.is_team_member(p_team_id) then
    raise exception 'Only team members can create boards' using errcode = '42501';
  end if;

  -- Length, emptiness and the position format are enforced by the table's constraints.
  insert into public.boards (team_id, title, position, visibility, background, created_by)
  values (
    p_team_id,
    btrim(p_title),
    p_position,
    p_visibility,
    nullif(btrim(coalesce(p_background, '')), ''),
    v_actor
  )
  returning * into v_board;

  -- A private board with no members would be invisible to everyone, including its author.
  if v_board.visibility = 'private' then
    insert into public.board_members (board_id, user_id)
    values (v_board.id, v_actor)
    on conflict do nothing;
  end if;

  -- Trello's default columns. Positions match what the client's fractional index would produce.
  if p_with_default_lists then
    insert into public.lists (board_id, title, position)
    values
      (v_board.id, 'To do', 'a0'),
      (v_board.id, 'In progress', 'a1'),
      (v_board.id, 'Done', 'a2');
  end if;

  insert into public.activity (team_id, board_id, actor_id, type, payload)
  values (
    p_team_id, v_board.id, v_actor, 'board.created',
    jsonb_build_object('title', v_board.title, 'visibility', v_board.visibility)
  );

  return v_board;
end;
$$;

comment on function public.create_board(uuid, text, text, public.board_visibility, text, boolean) is
  'Creates a board with its starting lists. Use instead of inserting into public.boards.';

revoke all on function public.create_board(uuid, text, text, public.board_visibility, text, boolean)
  from public, anon;
grant execute on function public.create_board(uuid, text, text, public.board_visibility, text, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- set_board_visibility
-- ---------------------------------------------------------------------------

-- Turning a board private is two writes — the column, and a membership row so the board does not
-- become invisible to everyone including the person who just changed it. That also makes
-- `update ... returning` impossible: RETURNING re-checks the SELECT policy against the new row,
-- and `is_board_member` cannot see a row inserted by the same statement.
create or replace function public.set_board_visibility(
  p_board_id uuid,
  p_visibility public.board_visibility
)
returns public.boards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_board public.boards;
begin
  if v_actor is null or not public.can_access_board(p_board_id) then
    raise exception 'You do not have access to this board' using errcode = '42501';
  end if;

  update public.boards b
  set visibility = p_visibility
  where b.id = p_board_id
  returning * into v_board;

  if v_board is null then
    raise exception 'That board no longer exists' using errcode = 'PT404';
  end if;

  if p_visibility = 'private' then
    insert into public.board_members (board_id, user_id)
    values (v_board.id, v_actor)
    on conflict do nothing;
  end if;

  insert into public.activity (team_id, board_id, actor_id, type, payload)
  values (
    v_board.team_id, v_board.id, v_actor, 'board.visibility_changed',
    jsonb_build_object('visibility', p_visibility)
  );

  return v_board;
end;
$$;

revoke all on function public.set_board_visibility(uuid, public.board_visibility) from public, anon;
grant execute on function public.set_board_visibility(uuid, public.board_visibility) to authenticated;

-- ---------------------------------------------------------------------------
-- Safety net for a direct update
-- ---------------------------------------------------------------------------

-- `set_board_visibility` is the supported path, but a plain `update boards set visibility =
-- 'private'` (no RETURNING) is still allowed by the policies, and would leave a board nobody can
-- see. This puts whoever made the change on the member list.
create or replace function public.handle_board_visibility_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visibility = 'private' and old.visibility <> 'private' then
    insert into public.board_members (board_id, user_id)
    values (new.id, coalesce((select auth.uid()), new.created_by))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger boards_keep_private_board_reachable
  after update of visibility on public.boards
  for each row execute function public.handle_board_visibility_change();

revoke all on function public.handle_board_visibility_change() from public, anon, authenticated;
