-- Phase 4 — Card RPCs.
--
-- `move_card` is the one the board canvas calls on every drop. It is a function rather than an
-- update because a move is three facts at once: where the card now is, that it happened, and
-- (later) who should hear about it. It also enforces the one rule a client must not be trusted
-- with — that the destination list belongs to the same board.
--
-- Error codes, as elsewhere: 42501 not allowed · PT404 no such card/list · 22023 bad argument.

-- ---------------------------------------------------------------------------
-- create_card
-- ---------------------------------------------------------------------------

create or replace function public.create_card(
  p_list_id uuid,
  p_title text,
  p_position text
)
returns public.cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_board uuid;
  v_card  public.cards;
begin
  select l.board_id into v_board from public.lists l where l.id = p_list_id;

  if v_board is null then
    raise exception 'That list no longer exists' using errcode = 'PT404';
  end if;

  if v_actor is null or not public.can_edit_board(v_board) then
    raise exception 'You cannot add cards to this board' using errcode = '42501';
  end if;

  insert into public.cards (board_id, list_id, title, position, created_by)
  values (v_board, p_list_id, btrim(p_title), p_position, v_actor)
  returning * into v_card;

  insert into public.activity (team_id, board_id, card_id, actor_id, type, payload)
  select b.team_id, v_board, v_card.id, v_actor, 'card.created',
         jsonb_build_object('title', v_card.title, 'list_id', p_list_id)
  from public.boards b
  where b.id = v_board;

  return v_card;
end;
$$;

comment on function public.create_card(uuid, text, text) is
  'Adds a card to a list and logs it. The board is taken from the list, never from the client.';

-- ---------------------------------------------------------------------------
-- move_card
-- ---------------------------------------------------------------------------

create or replace function public.move_card(
  p_card_id uuid,
  p_list_id uuid,
  p_position text
)
returns public.cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor    uuid := (select auth.uid());
  v_card     public.cards;
  v_from     uuid;
  v_to_board uuid;
begin
  select * into v_card from public.cards c where c.id = p_card_id;

  if v_card is null or v_card.deleted_at is not null then
    raise exception 'That card no longer exists' using errcode = 'PT404';
  end if;

  if v_actor is null or not public.can_edit_card(p_card_id) then
    raise exception 'You cannot move this card' using errcode = '42501';
  end if;

  select l.board_id into v_to_board from public.lists l where l.id = p_list_id;

  if v_to_board is null then
    raise exception 'That list no longer exists' using errcode = 'PT404';
  end if;

  -- The composite foreign key would catch this too, but a clear error beats a constraint
  -- violation, and it stops a card being flung onto a board the caller may not even see.
  if v_to_board <> v_card.board_id then
    raise exception 'A card cannot move to a different board' using errcode = '22023';
  end if;

  v_from := v_card.list_id;

  update public.cards c
  set list_id = p_list_id,
      position = p_position
  where c.id = p_card_id
  returning * into v_card;

  -- Reordering within a list is not worth an activity entry; moving between lists is.
  if v_from <> p_list_id then
    insert into public.activity (team_id, board_id, card_id, actor_id, type, payload)
    select b.team_id, v_card.board_id, v_card.id, v_actor, 'card.moved',
           jsonb_build_object('from_list_id', v_from, 'to_list_id', p_list_id)
    from public.boards b
    where b.id = v_card.board_id;
  end if;

  return v_card;
end;
$$;

comment on function public.move_card(uuid, uuid, text) is
  'Moves a card to a list and position within the same board, logging cross-list moves.';

-- ---------------------------------------------------------------------------
-- Signed-in users only.
-- ---------------------------------------------------------------------------

revoke all on function public.create_card(uuid, text, text) from public, anon;
revoke all on function public.move_card(uuid, uuid, text) from public, anon;

grant execute on function public.create_card(uuid, text, text) to authenticated;
grant execute on function public.move_card(uuid, uuid, text) to authenticated;
