-- Phase 1 — Core schema.
--
-- Conventions used throughout:
--   * Every table lives in `public` and has `created_at` / `updated_at` (trigger-maintained).
--   * Ordering uses fractional-index strings (`position`), so moving one row updates one row.
--     Those columns are `collate "C"` so ordering is plain byte order, independent of the
--     database locale — the same order the client's fractional-index code produces.
--   * Cross-table consistency (a card's list must live on the card's board, a label applied to a
--     card must belong to that card's board) is enforced by composite foreign keys, not by
--     application code.
--   * RLS is enabled here but every policy lives in 20260925090200_rls_policies.sql.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.team_role as enum ('owner', 'admin', 'member');
create type public.board_visibility as enum ('team', 'private');
create type public.card_priority as enum ('none', 'low', 'medium', 'high', 'urgent');
create type public.dependency_type as enum ('blocks', 'relates_to', 'duplicates');
create type public.notification_type as enum (
  'card_assigned',
  'card_unassigned',
  'mention',
  'comment',
  'due_soon',
  'overdue',
  'added_to_team',
  'added_to_board'
);

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- Keeps `updated_at` honest: clients cannot backdate or freeze it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'BEFORE UPDATE trigger: stamps updated_at with the server clock.';

-- A 6-digit hex colour (#rrggbb). Used for team, label and card cover colours.
create domain public.hex_color as text
  check (value ~ '^#[0-9a-fA-F]{6}$');

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user, created by a trigger on auth.users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  email text not null check (length(email) <= 320),
  avatar_url text check (length(avatar_url) <= 2048),
  color public.hex_color not null default '#4b7bec',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_name_idx on public.profiles (lower(name));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- teams & membership
-- ---------------------------------------------------------------------------

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  description text check (length(description) <= 500),
  color public.hex_color not null default '#4b7bec',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.team_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index team_members_user_idx on public.team_members (user_id);

-- A team has exactly one owner; ownership is transferred, never duplicated.
create unique index team_members_single_owner_idx
  on public.team_members (team_id)
  where role = 'owner';

create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- boards & lists
-- ---------------------------------------------------------------------------

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  background text check (length(background) <= 512),
  visibility public.board_visibility not null default 'team',
  archived boolean not null default false,
  position text collate "C" not null check (length(position) between 1 and 64),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target for the composite FKs that pin child rows to the same board.
  unique (id, team_id)
);

create index boards_team_position_idx on public.boards (team_id, position);
create index boards_team_active_idx on public.boards (team_id) where not archived;

create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();

-- Membership of a `private` board. Ignored while visibility = 'team'.
create table public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index board_members_user_idx on public.board_members (user_id);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  position text collate "C" not null check (length(position) between 1 and 64),
  wip_limit integer check (wip_limit between 1 and 999),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets `cards` reference (list_id, board_id) so a card can never point at a
  -- list on a different board.
  unique (id, board_id)
);

create index lists_board_position_idx on public.lists (board_id, position);

create trigger lists_set_updated_at
  before update on public.lists
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- cards
-- ---------------------------------------------------------------------------

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null,
  list_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 512),
  description text check (length(description) <= 20000),
  position text collate "C" not null check (length(position) between 1 and 64),
  start_date timestamptz,
  due_date timestamptz,
  due_complete boolean not null default false,
  priority public.card_priority not null default 'none',
  cover_color public.hex_color,
  archived boolean not null default false,
  deleted_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cards_list_on_same_board_fkey
    foreign key (list_id, board_id) references public.lists (id, board_id) on delete cascade,
  constraint cards_dates_ordered check (start_date is null or due_date is null or start_date <= due_date),
  -- Target for the composite FK from card_labels.
  unique (id, board_id)
);

create index cards_list_position_idx on public.cards (list_id, position) where deleted_at is null;
create index cards_board_idx on public.cards (board_id) where deleted_at is null;
create index cards_due_date_idx on public.cards (due_date)
  where due_date is not null and not archived and deleted_at is null and not due_complete;

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

create table public.card_assignees (
  card_id uuid not null references public.cards (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

-- Drives My Tasks and the "assigned to me" highlight.
create index card_assignees_user_idx on public.card_assignees (user_id);

-- ---------------------------------------------------------------------------
-- labels
-- ---------------------------------------------------------------------------

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null default '' check (length(name) <= 60),
  color public.hex_color not null,
  position text collate "C" not null check (length(position) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, board_id)
);

create index labels_board_position_idx on public.labels (board_id, position);
create unique index labels_board_name_idx on public.labels (board_id, lower(name)) where name <> '';

create trigger labels_set_updated_at
  before update on public.labels
  for each row execute function public.set_updated_at();

create table public.card_labels (
  card_id uuid not null,
  label_id uuid not null,
  board_id uuid not null references public.boards (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, label_id),
  -- Both composite FKs carry board_id, so a card can only take labels from its own board.
  constraint card_labels_card_fkey
    foreign key (card_id, board_id) references public.cards (id, board_id) on delete cascade,
  constraint card_labels_label_fkey
    foreign key (label_id, board_id) references public.labels (id, board_id) on delete cascade
);

create index card_labels_label_idx on public.card_labels (label_id);

-- ---------------------------------------------------------------------------
-- checklists
-- ---------------------------------------------------------------------------

create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  position text collate "C" not null check (length(position) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index checklists_card_position_idx on public.checklists (card_id, position);

create trigger checklists_set_updated_at
  before update on public.checklists
  for each row execute function public.set_updated_at();

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists (id) on delete cascade,
  text text not null check (length(btrim(text)) between 1 and 512),
  done boolean not null default false,
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date timestamptz,
  position text collate "C" not null check (length(position) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index checklist_items_checklist_position_idx on public.checklist_items (checklist_id, position);
create index checklist_items_assignee_idx on public.checklist_items (assignee_id) where assignee_id is not null;

create trigger checklist_items_set_updated_at
  before update on public.checklist_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- comments, attachments, dependencies
-- ---------------------------------------------------------------------------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  -- Kept when the author's account goes away, so threads stay readable.
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 10000),
  mentions uuid[] not null default '{}' check (array_length(mentions, 1) is null or array_length(mentions, 1) <= 50),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_card_created_idx on public.comments (card_id, created_at desc);

create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  uploader_id uuid references public.profiles (id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 255),
  mime text not null check (length(mime) <= 255),
  size bigint not null check (size > 0 and size <= 52428800), -- 50 MiB, matches the Storage limit
  storage_path text not null unique check (length(storage_path) <= 1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index attachments_card_idx on public.attachments (card_id, created_at desc);

create trigger attachments_set_updated_at
  before update on public.attachments
  for each row execute function public.set_updated_at();

create table public.dependencies (
  id uuid primary key default gen_random_uuid(),
  from_card_id uuid not null references public.cards (id) on delete cascade,
  to_card_id uuid not null references public.cards (id) on delete cascade,
  type public.dependency_type not null default 'blocks',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint dependencies_not_self check (from_card_id <> to_card_id),
  unique (from_card_id, to_card_id, type)
);

create index dependencies_to_card_idx on public.dependencies (to_card_id);

-- ---------------------------------------------------------------------------
-- activity & notifications (append-only; written by SECURITY DEFINER routines)
-- ---------------------------------------------------------------------------

create table public.activity (
  id bigint generated always as identity primary key,
  team_id uuid references public.teams (id) on delete cascade,
  board_id uuid references public.boards (id) on delete cascade,
  card_id uuid references public.cards (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type text not null check (length(type) between 1 and 60),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_board_created_idx on public.activity (board_id, created_at desc);
create index activity_team_created_idx on public.activity (team_id, created_at desc);
create index activity_card_created_idx on public.activity (card_id, created_at desc);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  actor_id uuid references public.profiles (id) on delete set null,
  team_id uuid references public.teams (id) on delete cascade,
  board_id uuid references public.boards (id) on delete cascade,
  card_id uuid references public.cards (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

-- ---------------------------------------------------------------------------
-- push subscriptions & notification preferences
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (length(endpoint) <= 2048),
  p256dh text not null check (length(p256dh) <= 256),
  auth text not null check (length(auth) <= 256),
  user_agent text check (length(user_agent) <= 512),
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

-- Absent row means "both channels on"; a row overrides that per notification type.
create table public.notification_prefs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  in_app boolean not null default true,
  push boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, type)
);

create trigger notification_prefs_set_updated_at
  before update on public.notification_prefs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: on everywhere, from the moment the tables exist.
-- With RLS enabled and no policy yet, every table is deny-all — policies are
-- added in 20260925090200_rls_policies.sql.
-- ---------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.teams               enable row level security;
alter table public.team_members        enable row level security;
alter table public.boards              enable row level security;
alter table public.board_members       enable row level security;
alter table public.lists               enable row level security;
alter table public.cards               enable row level security;
alter table public.card_assignees      enable row level security;
alter table public.labels              enable row level security;
alter table public.card_labels         enable row level security;
alter table public.checklists          enable row level security;
alter table public.checklist_items     enable row level security;
alter table public.comments            enable row level security;
alter table public.attachments         enable row level security;
alter table public.dependencies        enable row level security;
alter table public.activity            enable row level security;
alter table public.notifications       enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.notification_prefs  enable row level security;
