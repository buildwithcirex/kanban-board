-- Phase 1 — Row Level Security policies.
--
-- Default posture is deny: RLS is enabled on every table (previous migration) and only the
-- policies below open anything up. Every policy is scoped `to authenticated`, so the public
-- `anon` key on its own can read and write nothing.
--
-- Permission matrix (from docs/IMPLEMENTATION_PLAN.md §2):
--
--   Action                                    owner  admin  member
--   Manage team, members, roles                yes    yes     no
--   Create boards in the team                  yes    yes     yes
--   Delete a board                             yes    yes     no
--   Create/edit/move cards, comment, assign    yes    yes     yes
--   View team boards                           yes    yes     yes (private boards: members only)

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_team_with(id));

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No delete policy: profiles disappear with the auth user.

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------

create policy teams_select_member on public.teams
  for select to authenticated
  using (public.is_team_member(id));

-- Any signed-in user may start a team; a trigger makes them its owner.
create policy teams_insert_self on public.teams
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy teams_update_admin on public.teams
  for update to authenticated
  using (public.is_team_admin(id))
  with check (public.is_team_admin(id));

create policy teams_delete_owner on public.teams
  for delete to authenticated
  using (public.is_team_owner(id));

-- ---------------------------------------------------------------------------
-- team_members
-- ---------------------------------------------------------------------------

create policy team_members_select on public.team_members
  for select to authenticated
  using (public.is_team_member(team_id));

-- Admins add members and other admins. The single owner row is written by the
-- teams_create_owner_membership trigger; ownership transfer will be an RPC.
create policy team_members_insert_admin on public.team_members
  for insert to authenticated
  with check (public.is_team_admin(team_id) and role <> 'owner');

create policy team_members_update_admin on public.team_members
  for update to authenticated
  using (public.is_team_admin(team_id) and role <> 'owner')
  with check (public.is_team_admin(team_id) and role <> 'owner');

-- Admins remove members; anyone may leave a team they do not own.
create policy team_members_delete on public.team_members
  for delete to authenticated
  using (role <> 'owner' and (public.is_team_admin(team_id) or user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- boards
-- ---------------------------------------------------------------------------

create policy boards_select on public.boards
  for select to authenticated
  using (public.can_access_board(id));

create policy boards_insert_member on public.boards
  for insert to authenticated
  with check (public.is_team_member(team_id) and created_by = (select auth.uid()));

-- `with check` re-tests team membership so a board cannot be moved into a team
-- the caller does not belong to.
create policy boards_update on public.boards
  for update to authenticated
  using (public.can_access_board(id))
  with check (public.is_team_member(team_id) and public.can_access_board(id));

create policy boards_delete_admin on public.boards
  for delete to authenticated
  using (public.is_board_team_admin(id));

-- ---------------------------------------------------------------------------
-- board_members (private boards)
-- ---------------------------------------------------------------------------

create policy board_members_select on public.board_members
  for select to authenticated
  using (public.can_access_board(board_id));

-- You can only add someone who is already in the board's team.
create policy board_members_insert on public.board_members
  for insert to authenticated
  with check (public.can_access_board(board_id) and public.is_board_team_member(board_id, user_id));

create policy board_members_delete on public.board_members
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.can_access_board(board_id));

-- ---------------------------------------------------------------------------
-- lists
-- ---------------------------------------------------------------------------

create policy lists_select on public.lists
  for select to authenticated
  using (public.can_access_board(board_id));

create policy lists_insert on public.lists
  for insert to authenticated
  with check (public.can_edit_board(board_id));

create policy lists_update on public.lists
  for update to authenticated
  using (public.can_edit_board(board_id))
  with check (public.can_edit_board(board_id));

create policy lists_delete on public.lists
  for delete to authenticated
  using (public.can_edit_board(board_id));

-- ---------------------------------------------------------------------------
-- cards
-- ---------------------------------------------------------------------------

create policy cards_select on public.cards
  for select to authenticated
  using (public.can_access_board(board_id));

create policy cards_insert on public.cards
  for insert to authenticated
  with check (public.can_edit_board(board_id) and created_by = (select auth.uid()));

-- Board-level (not card-level) so archived cards can still be restored.
create policy cards_update on public.cards
  for update to authenticated
  using (public.can_edit_board(board_id))
  with check (public.can_edit_board(board_id));

create policy cards_delete on public.cards
  for delete to authenticated
  using (public.can_edit_board(board_id));

-- ---------------------------------------------------------------------------
-- card_assignees
-- ---------------------------------------------------------------------------

create policy card_assignees_select on public.card_assignees
  for select to authenticated
  using (public.can_access_card(card_id));

-- Only teammates can be assigned, and you cannot forge who did the assigning.
create policy card_assignees_insert on public.card_assignees
  for insert to authenticated
  with check (
    public.can_assign_to_card(card_id, user_id)
    and assigned_by = (select auth.uid())
  );

create policy card_assignees_delete on public.card_assignees
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.can_edit_card(card_id));

-- ---------------------------------------------------------------------------
-- labels & card_labels
-- ---------------------------------------------------------------------------

create policy labels_select on public.labels
  for select to authenticated
  using (public.can_access_board(board_id));

create policy labels_insert on public.labels
  for insert to authenticated
  with check (public.can_edit_board(board_id));

create policy labels_update on public.labels
  for update to authenticated
  using (public.can_edit_board(board_id))
  with check (public.can_edit_board(board_id));

create policy labels_delete on public.labels
  for delete to authenticated
  using (public.can_edit_board(board_id));

create policy card_labels_select on public.card_labels
  for select to authenticated
  using (public.can_access_board(board_id));

create policy card_labels_insert on public.card_labels
  for insert to authenticated
  with check (public.can_edit_card(card_id) and public.can_edit_board(board_id));

create policy card_labels_delete on public.card_labels
  for delete to authenticated
  using (public.can_edit_card(card_id));

-- ---------------------------------------------------------------------------
-- checklists & items
-- ---------------------------------------------------------------------------

create policy checklists_select on public.checklists
  for select to authenticated
  using (public.can_access_card(card_id));

create policy checklists_insert on public.checklists
  for insert to authenticated
  with check (public.can_edit_card(card_id));

create policy checklists_update on public.checklists
  for update to authenticated
  using (public.can_edit_card(card_id))
  with check (public.can_edit_card(card_id));

create policy checklists_delete on public.checklists
  for delete to authenticated
  using (public.can_edit_card(card_id));

create policy checklist_items_select on public.checklist_items
  for select to authenticated
  using (public.can_access_checklist(checklist_id));

create policy checklist_items_insert on public.checklist_items
  for insert to authenticated
  with check (public.can_edit_checklist(checklist_id));

create policy checklist_items_update on public.checklist_items
  for update to authenticated
  using (public.can_edit_checklist(checklist_id))
  with check (public.can_edit_checklist(checklist_id));

create policy checklist_items_delete on public.checklist_items
  for delete to authenticated
  using (public.can_edit_checklist(checklist_id));

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------

create policy comments_select on public.comments
  for select to authenticated
  using (public.can_access_card(card_id));

create policy comments_insert_own on public.comments
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_edit_card(card_id));

create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()) and public.can_edit_card(card_id))
  with check (author_id = (select auth.uid()));

-- Authors delete their own comments; team admins can moderate.
create policy comments_delete on public.comments
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or public.is_board_team_admin((select c.board_id from public.cards c where c.id = card_id))
  );

-- ---------------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------------

create policy attachments_select on public.attachments
  for select to authenticated
  using (public.can_access_card(card_id));

create policy attachments_insert_own on public.attachments
  for insert to authenticated
  with check (uploader_id = (select auth.uid()) and public.can_edit_card(card_id));

create policy attachments_delete on public.attachments
  for delete to authenticated
  using (
    uploader_id = (select auth.uid())
    or public.is_board_team_admin((select c.board_id from public.cards c where c.id = card_id))
  );

-- No update policy: attachment metadata mirrors an immutable Storage object.

-- ---------------------------------------------------------------------------
-- dependencies
-- ---------------------------------------------------------------------------

create policy dependencies_select on public.dependencies
  for select to authenticated
  using (public.can_access_card(from_card_id) and public.can_access_card(to_card_id));

create policy dependencies_insert on public.dependencies
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.can_edit_card(from_card_id)
    and public.can_edit_card(to_card_id)
  );

create policy dependencies_delete on public.dependencies
  for delete to authenticated
  using (public.can_edit_card(from_card_id) or public.can_edit_card(to_card_id));

-- ---------------------------------------------------------------------------
-- activity (read-only for clients)
-- ---------------------------------------------------------------------------

create policy activity_select on public.activity
  for select to authenticated
  using (
    case
      when board_id is not null then public.can_access_board(board_id)
      when team_id is not null then public.is_team_member(team_id)
      else false
    end
  );

-- ---------------------------------------------------------------------------
-- notifications (own rows; created server-side only)
-- ---------------------------------------------------------------------------

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Marking read/unread. A user can only ever touch their own rows.
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- push_subscriptions & notification_prefs (strictly own rows)
-- ---------------------------------------------------------------------------

create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy notification_prefs_select_own on public.notification_prefs
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notification_prefs_insert_own on public.notification_prefs
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy notification_prefs_update_own on public.notification_prefs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notification_prefs_delete_own on public.notification_prefs
  for delete to authenticated
  using (user_id = (select auth.uid()));
