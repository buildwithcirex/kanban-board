-- Phase 1 — Development seed. NEVER run this against the production project.
--
-- Creates four confirmed test users, two teams and one sample board so that RLS can be exercised
-- from day one (docs/IMPLEMENTATION_PLAN.md §1.3, option A):
--
--   ada@kanban.test    Ada Lovelace    owner  of "Product"
--   grace@kanban.test  Grace Hopper    admin  of "Product"
--   linus@kanban.test  Linus Torvalds  member of "Product"
--   mallory@kanban.test Mallory Quinn  owner  of "Outsiders"  — in no shared team; the RLS suite
--                                                               asserts she can see nothing above
--
-- All four share the password below. It only ever exists in the dev project and in `.env.local`
-- (as VITE_DEV_USER_PASSWORD, read by the dev-only user switcher).
--
-- Running it (no Docker required):
--   Supabase Dashboard -> SQL Editor -> paste this file -> Run.
-- It is idempotent: re-running resets the test users' passwords and leaves the data as-is.

begin;

do $seed$
declare
  v_password    constant text := 'kanban-dev-2026';
  v_ada         uuid;
  v_grace       uuid;
  v_linus       uuid;
  v_mallory     uuid;
  v_product     uuid;
  v_outsiders   uuid;
  v_board       uuid;
  v_todo        uuid;
  v_doing       uuid;
  v_done        uuid;
  v_label_bug   uuid;
  v_label_feat  uuid;
  v_card        uuid;
begin
  -- ---- users -------------------------------------------------------------
  -- Inlined in a nested block rather than a helper function, so the seed leaves
  -- nothing behind in the database.
  <<users>>
  declare
    v_specs jsonb := jsonb_build_array(
      jsonb_build_object('email', 'ada@kanban.test',     'name', 'Ada Lovelace'),
      jsonb_build_object('email', 'grace@kanban.test',   'name', 'Grace Hopper'),
      jsonb_build_object('email', 'linus@kanban.test',   'name', 'Linus Torvalds'),
      jsonb_build_object('email', 'mallory@kanban.test', 'name', 'Mallory Quinn')
    );
    v_spec  jsonb;
    v_id    uuid;
  begin
    for v_spec in select * from jsonb_array_elements(v_specs)
    loop
      select id into v_id from auth.users where email = v_spec ->> 'email';

      if v_id is null then
        v_id := gen_random_uuid();

        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at
        )
        values (
          '00000000-0000-0000-0000-000000000000',
          v_id,
          'authenticated',
          'authenticated',
          v_spec ->> 'email',
          extensions.crypt(v_password, extensions.gen_salt('bf')),
          now(),
          jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
          jsonb_build_object('name', v_spec ->> 'name'),
          now(),
          now()
        );

        -- GoTrue needs a matching identity row for password sign-in.
        insert into auth.identities (
          id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        )
        values (
          gen_random_uuid(),
          v_id::text,
          v_id,
          jsonb_build_object('sub', v_id::text, 'email', v_spec ->> 'email', 'email_verified', true),
          'email',
          now(),
          now(),
          now()
        )
        on conflict do nothing;
      else
        update auth.users
        set encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
            email_confirmed_at = coalesce(email_confirmed_at, now()),
            updated_at = now()
        where id = v_id;
      end if;

      -- handle_new_user() fills this in for new users; keep names fresh for existing ones.
      insert into public.profiles (id, name, email, color)
      values (v_id, v_spec ->> 'name', v_spec ->> 'email', public.default_profile_color(v_id))
      on conflict (id) do update set name = excluded.name;
    end loop;

    -- GoTrue reads several auth.users token columns into non-nullable Go strings. A row inserted
    -- by hand leaves them NULL, and every sign-in then fails with "Database error querying
    -- schema". The list is filtered against information_schema so this keeps working as GoTrue's
    -- own schema changes.
    declare
      v_column text;
    begin
      for v_column in
        select c.column_name
        from information_schema.columns c
        where c.table_schema = 'auth'
          and c.table_name = 'users'
          and c.data_type in ('text', 'character varying')
          and c.is_nullable = 'YES'
          and c.column_name in (
            'confirmation_token', 'recovery_token', 'email_change', 'email_change_token_new',
            'email_change_token_current', 'phone_change', 'phone_change_token',
            'reauthentication_token'
          )
      loop
        execute format(
          'update auth.users set %I = %L where %I is null and email like %L',
          v_column, '', v_column, '%@kanban.test'
        );
      end loop;
    end;
  end users;

  select id into v_ada     from auth.users where email = 'ada@kanban.test';
  select id into v_grace   from auth.users where email = 'grace@kanban.test';
  select id into v_linus   from auth.users where email = 'linus@kanban.test';
  select id into v_mallory from auth.users where email = 'mallory@kanban.test';

  -- ---- teams -------------------------------------------------------------

  select id into v_product from public.teams where name = 'Product';
  if v_product is null then
    insert into public.teams (name, description, color, created_by)
    values ('Product', 'Everything we are shipping this quarter.', '#4b7bec', v_ada)
    returning id into v_product;
  end if;

  select id into v_outsiders from public.teams where name = 'Outsiders';
  if v_outsiders is null then
    insert into public.teams (name, description, color, created_by)
    values ('Outsiders', 'Unrelated team. Must never see Product data.', '#eb3b5a', v_mallory)
    returning id into v_outsiders;
  end if;

  insert into public.team_members (team_id, user_id, role) values
    (v_product,   v_ada,     'owner'),
    (v_product,   v_grace,   'admin'),
    (v_product,   v_linus,   'member'),
    (v_outsiders, v_mallory, 'owner')
  on conflict (team_id, user_id) do update set role = excluded.role;

  -- ---- board, lists, labels, cards ---------------------------------------

  select id into v_board from public.boards where team_id = v_product and title = 'Roadmap';
  if v_board is null then
    insert into public.boards (team_id, title, visibility, position, created_by)
    values (v_product, 'Roadmap', 'team', 'a0', v_ada)
    returning id into v_board;

    insert into public.lists (board_id, title, position) values (v_board, 'To do', 'a0')
      returning id into v_todo;
    insert into public.lists (board_id, title, position) values (v_board, 'In progress', 'a1')
      returning id into v_doing;
    insert into public.lists (board_id, title, position) values (v_board, 'Done', 'a2')
      returning id into v_done;

    insert into public.labels (board_id, name, color, position) values (v_board, 'Bug', '#eb3b5a', 'a0')
      returning id into v_label_bug;
    insert into public.labels (board_id, name, color, position) values (v_board, 'Feature', '#20bf6b', 'a1')
      returning id into v_label_feat;

    insert into public.cards (board_id, list_id, title, description, position, priority, created_by)
    values (v_board, v_todo, 'Design the board canvas', 'ReactFlow proof of concept.', 'a0', 'high', v_ada)
    returning id into v_card;
    insert into public.card_assignees (card_id, user_id, assigned_by) values (v_card, v_linus, v_ada);
    insert into public.card_labels (card_id, label_id, board_id) values (v_card, v_label_feat, v_board);

    insert into public.cards (board_id, list_id, title, position, priority, due_date, created_by)
    values (v_board, v_todo, 'Fix flaky drag on touch', 'a1', 'urgent', now() + interval '2 days', v_grace)
    returning id into v_card;
    insert into public.card_assignees (card_id, user_id, assigned_by) values (v_card, v_grace, v_grace);
    insert into public.card_labels (card_id, label_id, board_id) values (v_card, v_label_bug, v_board);

    insert into public.cards (board_id, list_id, title, position, created_by)
    values (v_board, v_doing, 'Row Level Security policies', 'a0', v_ada)
    returning id into v_card;
    insert into public.card_assignees (card_id, user_id, assigned_by) values (v_card, v_ada, v_ada);

    insert into public.cards (board_id, list_id, title, position, created_by)
    values (v_board, v_done, 'Project scaffolding', 'a0', v_ada);
  end if;

  raise notice 'Seed complete. Test users share the password %', v_password;
end;
$seed$;

commit;
