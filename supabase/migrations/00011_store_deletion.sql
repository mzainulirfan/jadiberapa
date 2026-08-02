  -- Store deletion & standalone store creation for existing users.
  -- Tightens `stores` RLS (only owners may modify/delete) and adds RPCs used by
  -- the "Hapus Toko" danger zone and the /stores/new flow.

  -- 1) Tighten stores RLS: everyone in the store may read; only owners write/delete.
  drop policy if exists stores_member on stores;
  drop policy if exists stores_select_member on stores;
  drop policy if exists stores_modify_owner on stores;
  drop policy if exists stores_delete_owner on stores;

  create policy stores_select_member on stores
    for select to authenticated
    using (
      exists (
        select 1 from store_members sm
        where sm.store_id = stores.id and sm.user_id = auth.uid()
      )
    );

  create policy stores_modify_owner on stores
    for update to authenticated
    using (
      exists (
        select 1 from store_members sm
        where sm.store_id = stores.id and sm.user_id = auth.uid() and sm.role = 'owner'
      )
    )
    with check (
      exists (
        select 1 from store_members sm
        where sm.store_id = stores.id and sm.user_id = auth.uid() and sm.role = 'owner'
      )
    );

  create policy stores_delete_owner on stores
    for delete to authenticated
    using (
      exists (
        select 1 from store_members sm
        where sm.store_id = stores.id and sm.user_id = auth.uid() and sm.role = 'owner'
      )
    );

  -- 2) Delete the caller's active store (owner only). Cascade clears all related
  --    rows (products, categories, transactions, settings, held_carts, members, ...).
  create or replace function delete_current_store(p_confirm text)
  returns json
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    sid uuid;
    r text;
    deleted_name text;
    remaining int;
    next_store uuid;
  begin
    if auth.uid() is null then
      return json_build_object('error', 'Anda belum masuk');
    end if;

    select current_store_id(), current_user_role() into sid, r;

    if sid is null then
      return json_build_object('error', 'Toko aktif tidak ditemukan');
    end if;
    if r is distinct from 'owner' then
      return json_build_object('error', 'Hanya pemilik toko yang bisa menghapus toko');
    end if;

    select name into deleted_name from stores where id = sid;
    if deleted_name is null then
      return json_build_object('error', 'Toko tidak ditemukan');
    end if;
    if trim(coalesce(p_confirm, '')) <> deleted_name then
      return json_build_object('error', 'Konfirmasi nama toko tidak cocok');
    end if;

    delete from stores where id = sid;

    select count(*) into remaining
    from store_members where user_id = auth.uid();

    if remaining > 0 then
      select sm.store_id into next_store
      from store_members sm
      where sm.user_id = auth.uid()
      order by sm.created_at asc
      limit 1;

      insert into user_active_store (user_id, store_id)
      values (auth.uid(), next_store)
      on conflict (user_id) do update set store_id = excluded.store_id, updated_at = now();
    end if;

    return json_build_object(
      'error', null,
      'deleted_name', deleted_name,
      'remaining', remaining,
      'next_store_id', next_store
    );
  end;
  $$;

  grant execute on function delete_current_store(text) to authenticated;

  -- 3) Create a fresh store for a logged-in user without one (post-deletion flow).
  --    security definer bypasses the chicken-and-egg RLS (not yet a member).
  create or replace function create_store_for_current_user(p_name text, p_code text default null)
  returns json
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    uid uuid;
    clean_name text;
    new_store uuid;
  begin
    uid := auth.uid();
    if uid is null then
      return json_build_object('error', 'Anda belum masuk');
    end if;

    clean_name := trim(coalesce(p_name, ''));
    if clean_name = '' then
      return json_build_object('error', 'Nama toko wajib diisi');
    end if;

    insert into stores (name, code)
    values (
      clean_name,
      coalesce(nullif(trim(coalesce(p_code, '')), ''), make_store_code(clean_name))
    )
    returning id into new_store;

    insert into store_members (user_id, store_id, role)
    values (uid, new_store, 'owner');

    insert into settings (store_id, key, value) values
      (new_store, 'store_name',    clean_name),
      (new_store, 'store_address', ''),
      (new_store, 'store_phone',   '')
    on conflict (store_id, key) do nothing;

    insert into user_active_store (user_id, store_id)
    values (uid, new_store)
    on conflict (user_id) do update set store_id = excluded.store_id, updated_at = now();

    return json_build_object('error', null, 'store_id', new_store);
  end;
  $$;

  grant execute on function create_store_for_current_user(text, text) to authenticated;
  