-- Phase 3 — Board background images (Supabase Storage).
--
-- The bucket is **private**: objects are reached through short-lived signed URLs, never a public
-- link, so a background cannot leak a team's work to anyone who guesses the path.
--
-- Object names are `<board_id>/<random>.<ext>`. The first path segment is what the policies read,
-- which is why the board id has to be the folder rather than part of the file name.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-backgrounds',
  'board-backgrounds',
  false,
  5242880, -- 5 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- `storage.foldername(name)` returns the path segments before the file name, so [1] is the board.
-- An object whose name has no folder yields NULL and fails every policy below.
create or replace function public.board_id_from_storage_name(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_first text := (storage.foldername(p_name))[1];
begin
  -- A name that is not `<uuid>/<file>` belongs to no board, so access is refused rather than
  -- erroring the whole request.
  return v_first::uuid;
exception
  when invalid_text_representation then
    return null;
  when others then
    return null;
end;
$$;

revoke all on function public.board_id_from_storage_name(text) from public, anon;
grant execute on function public.board_id_from_storage_name(text) to authenticated;

drop policy if exists board_backgrounds_select on storage.objects;
drop policy if exists board_backgrounds_insert on storage.objects;
drop policy if exists board_backgrounds_update on storage.objects;
drop policy if exists board_backgrounds_delete on storage.objects;

create policy board_backgrounds_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'board-backgrounds'
    and public.can_access_board(public.board_id_from_storage_name(name))
  );

create policy board_backgrounds_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'board-backgrounds'
    and public.can_edit_board(public.board_id_from_storage_name(name))
  );

create policy board_backgrounds_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'board-backgrounds'
    and public.can_edit_board(public.board_id_from_storage_name(name))
  )
  with check (
    bucket_id = 'board-backgrounds'
    and public.can_edit_board(public.board_id_from_storage_name(name))
  );

create policy board_backgrounds_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'board-backgrounds'
    and public.can_edit_board(public.board_id_from_storage_name(name))
  );
