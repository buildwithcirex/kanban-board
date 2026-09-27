-- Phase 5 — Card detail.
--
-- Assigning, commenting and copying are each several rows at once — the change itself, an
-- activity entry, and the notifications that follow — so they are functions rather than a
-- sequence of client writes. Description, dates, priority, labels and checklists are ordinary
-- single-row writes and stay on the table policies.
--
-- Codes, as elsewhere: 42501 not allowed · PT404 no such row · 22023 bad argument.

-- ---------------------------------------------------------------------------
-- assign_card
-- ---------------------------------------------------------------------------

create or replace function public.assign_card(
  p_card_id uuid,
  p_user_id uuid,
  p_assign boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_card  public.cards;
begin
  select * into v_card from public.cards c where c.id = p_card_id;
  if v_card is null then
    raise exception 'That card no longer exists' using errcode = 'PT404';
  end if;

  if v_actor is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_assign then
    -- Refuses anyone outside the board's team, so a tampered request cannot hand work to a
    -- stranger or reveal that a user id exists.
    if not public.can_assign_to_card(p_card_id, p_user_id) then
      raise exception 'That person cannot be assigned to this card' using errcode = '42501';
    end if;

    insert into public.card_assignees (card_id, user_id, assigned_by)
    values (p_card_id, p_user_id, v_actor)
    on conflict (card_id, user_id) do nothing;

    if found then
      insert into public.activity (team_id, board_id, card_id, actor_id, type, payload)
      select b.team_id, v_card.board_id, p_card_id, v_actor, 'card.assigned',
             jsonb_build_object('user_id', p_user_id)
      from public.boards b where b.id = v_card.board_id;

      -- Telling yourself you assigned yourself is noise.
      if p_user_id <> v_actor then
        insert into public.notifications (user_id, type, actor_id, board_id, card_id, payload)
        values (p_user_id, 'card_assigned', v_actor, v_card.board_id, p_card_id,
                jsonb_build_object('title', v_card.title));
      end if;
    end if;
  else
    -- Anyone who can edit the card may unassign, and you may always remove yourself.
    if p_user_id <> v_actor and not public.can_edit_card(p_card_id) then
      raise exception 'You cannot change assignments on this card' using errcode = '42501';
    end if;

    delete from public.card_assignees ca
    where ca.card_id = p_card_id and ca.user_id = p_user_id;

    if found then
      insert into public.activity (team_id, board_id, card_id, actor_id, type, payload)
      select b.team_id, v_card.board_id, p_card_id, v_actor, 'card.unassigned',
             jsonb_build_object('user_id', p_user_id)
      from public.boards b where b.id = v_card.board_id;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- add_card_comment
-- ---------------------------------------------------------------------------

create or replace function public.add_card_comment(
  p_card_id uuid,
  p_body text,
  p_mentions uuid[] default '{}'
)
returns public.comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor    uuid := (select auth.uid());
  v_card     public.cards;
  v_comment  public.comments;
  v_mentions uuid[];
begin
  select * into v_card from public.cards c where c.id = p_card_id;
  if v_card is null then
    raise exception 'That card no longer exists' using errcode = 'PT404';
  end if;

  if v_actor is null or not public.can_edit_card(p_card_id) then
    raise exception 'You cannot comment on this card' using errcode = '42501';
  end if;

  -- Mentions are filtered against the board's team rather than trusted: otherwise a crafted
  -- request could notify — and so confirm the existence of — any account.
  select coalesce(array_agg(distinct m), '{}')
  into v_mentions
  from unnest(coalesce(p_mentions, '{}')) as m
  where public.is_board_team_member(v_card.board_id, m);

  insert into public.comments (card_id, author_id, body, mentions)
  values (p_card_id, v_actor, btrim(p_body), v_mentions)
  returning * into v_comment;

  insert into public.activity (team_id, board_id, card_id, actor_id, type, payload)
  select b.team_id, v_card.board_id, p_card_id, v_actor, 'card.commented',
         jsonb_build_object('comment_id', v_comment.id)
  from public.boards b where b.id = v_card.board_id;

  -- Someone mentioned hears about it as a mention; everyone else on the card hears about the
  -- comment. Nobody is told about their own comment, and nobody is told twice.
  insert into public.notifications (user_id, type, actor_id, board_id, card_id, payload)
  select m, 'mention', v_actor, v_card.board_id, p_card_id,
         jsonb_build_object('title', v_card.title)
  from unnest(v_mentions) as m
  where m <> v_actor;

  insert into public.notifications (user_id, type, actor_id, board_id, card_id, payload)
  select ca.user_id, 'comment', v_actor, v_card.board_id, p_card_id,
         jsonb_build_object('title', v_card.title)
  from public.card_assignees ca
  where ca.card_id = p_card_id
    and ca.user_id <> v_actor
    and not (ca.user_id = any (v_mentions));

  return v_comment;
end;
$$;

-- ---------------------------------------------------------------------------
-- copy_card
-- ---------------------------------------------------------------------------

create or replace function public.copy_card(
  p_card_id uuid,
  p_list_id uuid,
  p_position text,
  p_title text default null
)
returns public.cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor    uuid := (select auth.uid());
  v_source   public.cards;
  v_copy     public.cards;
  v_to_board uuid;
  v_list     record;
  v_new_list uuid;
begin
  select * into v_source from public.cards c where c.id = p_card_id;
  if v_source is null then
    raise exception 'That card no longer exists' using errcode = 'PT404';
  end if;

  if v_actor is null or not public.can_access_card(p_card_id) then
    raise exception 'You cannot copy this card' using errcode = '42501';
  end if;

  select l.board_id into v_to_board from public.lists l where l.id = p_list_id;
  if v_to_board is null then
    raise exception 'That list no longer exists' using errcode = 'PT404';
  end if;

  if not public.can_edit_board(v_to_board) then
    raise exception 'You cannot add cards to that board' using errcode = '42501';
  end if;

  -- Labels belong to a board, so a copy onto another board cannot take them with it.
  if v_to_board <> v_source.board_id then
    raise exception 'A card can only be copied within its own board' using errcode = '22023';
  end if;

  insert into public.cards (
    board_id, list_id, title, description, position,
    start_date, due_date, priority, cover_color, created_by
  )
  values (
    v_to_board, p_list_id, coalesce(nullif(btrim(coalesce(p_title, '')), ''), v_source.title),
    v_source.description, p_position,
    v_source.start_date, v_source.due_date, v_source.priority, v_source.cover_color, v_actor
  )
  returning * into v_copy;

  insert into public.card_labels (card_id, label_id, board_id)
  select v_copy.id, cl.label_id, cl.board_id
  from public.card_labels cl
  where cl.card_id = p_card_id;

  -- Checklists come across with their items; comments, attachments and assignees do not, which
  -- is what Trello does too — a copy is a fresh piece of work.
  for v_list in
    select * from public.checklists cl where cl.card_id = p_card_id order by cl.position
  loop
    insert into public.checklists (card_id, title, position)
    values (v_copy.id, v_list.title, v_list.position)
    returning id into v_new_list;

    insert into public.checklist_items (checklist_id, text, done, due_date, position)
    select v_new_list, ci.text, ci.done, ci.due_date, ci.position
    from public.checklist_items ci
    where ci.checklist_id = v_list.id;
  end loop;

  insert into public.activity (team_id, board_id, card_id, actor_id, type, payload)
  select b.team_id, v_to_board, v_copy.id, v_actor, 'card.copied',
         jsonb_build_object('from_card_id', p_card_id)
  from public.boards b where b.id = v_to_board;

  return v_copy;
end;
$$;

-- ---------------------------------------------------------------------------
-- Attachments: a private bucket, filed under the card
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('card-attachments', 'card-attachments', false, 26214400) -- 25 MiB
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit;

create or replace function public.card_id_from_storage_name(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_first text := (storage.foldername(p_name))[1];
begin
  return v_first::uuid;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.card_id_from_storage_name(text) from public, anon;
grant execute on function public.card_id_from_storage_name(text) to authenticated;

drop policy if exists card_attachments_select on storage.objects;
drop policy if exists card_attachments_insert on storage.objects;
drop policy if exists card_attachments_delete on storage.objects;

create policy card_attachments_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'card-attachments'
    and public.can_access_card(public.card_id_from_storage_name(name))
  );

create policy card_attachments_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'card-attachments'
    and public.can_edit_card(public.card_id_from_storage_name(name))
  );

create policy card_attachments_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'card-attachments'
    and public.can_edit_card(public.card_id_from_storage_name(name))
  );

-- ---------------------------------------------------------------------------
-- Signed-in users only.
-- ---------------------------------------------------------------------------

revoke all on function public.assign_card(uuid, uuid, boolean) from public, anon;
revoke all on function public.add_card_comment(uuid, text, uuid[]) from public, anon;
revoke all on function public.copy_card(uuid, uuid, text, text) from public, anon;

grant execute on function public.assign_card(uuid, uuid, boolean) to authenticated;
grant execute on function public.add_card_comment(uuid, text, uuid[]) to authenticated;
grant execute on function public.copy_card(uuid, uuid, text, text) to authenticated;
