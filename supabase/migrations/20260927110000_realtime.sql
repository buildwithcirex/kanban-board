-- Phase 7 — Realtime.
--
-- Adding tables to the `supabase_realtime` publication is what makes Postgres stream their
-- changes. Realtime still applies RLS to every row before it reaches a client, so a subscriber
-- only ever hears about rows they could have selected anyway — a board they cannot see produces
-- no events for them.
--
-- Only the tables the UI actually reacts to are published. Every extra table is traffic every
-- subscriber pays for, and `activity` in particular is append-only noise the board does not
-- redraw for.

do $$
begin
  -- `add table` errors if the table is already a member, so each is guarded.
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cards'
  ) then
    alter publication supabase_realtime add table public.cards;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lists'
  ) then
    alter publication supabase_realtime add table public.lists;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'card_assignees'
  ) then
    alter publication supabase_realtime add table public.card_assignees;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- A delete event carries only the primary key unless the whole old row is replicated. The board
-- needs to know *which board* a deleted card belonged to in order to refresh the right one, so
-- these tables replicate their full old row.
alter table public.cards replica identity full;
alter table public.lists replica identity full;
alter table public.card_assignees replica identity full;

-- ---------------------------------------------------------------------------
-- Marking notifications read
-- ---------------------------------------------------------------------------

-- `update notifications set read_at = now() where user_id = auth.uid()` already works through the
-- policy, but marking the whole inbox read is one statement rather than one per row, and this
-- keeps the client from having to know the shape of "unread".
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.notifications n
  set read_at = now()
  where n.user_id = (select auth.uid())
    and n.read_at is null
    and (p_ids is null or n.id = any (p_ids));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.mark_notifications_read(bigint[]) is
  'Marks the caller''s unread notifications read. Null marks the whole inbox.';

revoke all on function public.mark_notifications_read(bigint[]) from public, anon;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;
