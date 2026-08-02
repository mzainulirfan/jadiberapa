-- Persetujuan member kasir: kasir yang mendaftar sendiri lewat link/kode toko
-- masuk sebagai "menunggu" (approved = false) sampai disetujui pemilik di halaman
-- Kelola Kasir. Kasir yang ditambahkan pemilik manual (via username) langsung disetujui.
-- Semua gate akses (RLS, RPC, current_store_id/current_user_role) hanya memakai
-- membership berstatus approved, sehingga kasir pending tidak bisa mengakses data toko.

-- 1) Kolom approved (default true = perilaku lama bagi member yang sudah ada).
alter table store_members add column if not exists approved boolean not null default true;

-- 2) current_store_id & current_user_role hanya mempertimbangkan member approved.
create or replace function current_store_id()
returns uuid
language sql
stable
as $$
  select sm.store_id
  from store_members sm
  join user_active_store uas
    on uas.user_id = sm.user_id
   and uas.store_id = sm.store_id
  where sm.user_id = auth.uid()
    and sm.approved
  limit 1;
$$;

create or replace function current_user_role()
returns text
language sql
stable
as $$
  select sm.role
  from store_members sm
  join user_active_store uas
    on uas.user_id = sm.user_id
   and uas.store_id = sm.store_id
  where sm.user_id = auth.uid()
    and sm.approved
  limit 1;
$$;

-- 3) Signup: owner langsung disetujui; kasir via kode toko menunggu persetujuan.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  store_code text;
  target_store uuid;
begin
  store_code := nullif(trim(coalesce(new.raw_user_meta_data->>'store_code', '')), '');

  if store_code is not null then
    select id into target_store from stores where code = lower(store_code);
    if target_store is null then
      raise exception 'Kode toko tidak ditemukan';
    end if;
    insert into store_members (user_id, store_id, role, approved)
    values (new.id, target_store, 'kasir', false)
    on conflict (user_id, store_id) do nothing;
    return new;
  end if;

  insert into stores (name, code)
  values (
    coalesce(new.raw_user_meta_data->>'store_name', 'Toko Saya'),
    make_store_code(coalesce(new.raw_user_meta_data->>'store_name', 'Toko Saya'))
  )
  returning id into target_store;

  insert into store_members (user_id, store_id, role)
  values (new.id, target_store, 'owner');

  insert into settings (store_id, key, value) values
    (target_store, 'store_name',    coalesce(new.raw_user_meta_data->>'store_name', 'Toko Saya')),
    (target_store, 'store_address', ''),
    (target_store, 'store_phone',   '');

  return new;
end;
$$;

-- 4) Trigger after-insert: jangan set toko aktif untuk member yang belum disetujui.
create or replace function store_members_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approved then
    insert into user_active_store (user_id, store_id)
    values (new.user_id, new.store_id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

-- 5) RLS stores: hanya member approved (select) / owner approved (modify, delete).
drop policy if exists stores_select_member on stores;
create policy stores_select_member on stores
  for select to authenticated
  using (
    exists (
      select 1 from store_members sm
      where sm.store_id = stores.id and sm.user_id = auth.uid() and sm.approved
    )
  );

drop policy if exists stores_modify_owner on stores;
create policy stores_modify_owner on stores
  for update to authenticated
  using (
    exists (
      select 1 from store_members sm
      where sm.store_id = stores.id and sm.user_id = auth.uid() and sm.role = 'owner' and sm.approved
    )
  )
  with check (
    exists (
      select 1 from store_members sm
      where sm.store_id = stores.id and sm.user_id = auth.uid() and sm.role = 'owner' and sm.approved
    )
  );

drop policy if exists stores_delete_owner on stores;
create policy stores_delete_owner on stores
  for delete to authenticated
  using (
    exists (
      select 1 from store_members sm
      where sm.store_id = stores.id and sm.user_id = auth.uid() and sm.role = 'owner' and sm.approved
    )
  );

-- 6) RPC toko: hanya store approved yang muncul / bisa diaktifkan.
create or replace function get_my_stores()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  active uuid;
begin
  select store_id into active from user_active_store where user_id = auth.uid();

  return (
    select coalesce(json_agg(json_build_object(
      'store_id', s.id,
      'name',     s.name,
      'role',     sm.role,
      'active',   (s.id = active)
    ) order by (s.id = active) desc, sm.created_at asc), '[]'::json)
    from store_members sm
    join stores s on s.id = sm.store_id
    where sm.user_id = auth.uid() and sm.approved
  );
end;
$$;

create or replace function set_active_store(p_store_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from store_members where user_id = auth.uid() and store_id = p_store_id and approved) then
    return json_build_object('error', 'Anda bukan member toko ini');
  end if;

  insert into user_active_store (user_id, store_id)
  values (auth.uid(), p_store_id)
  on conflict (user_id) do update set store_id = excluded.store_id, updated_at = now();

  return json_build_object('error', null);
end;
$$;

-- 7) Daftar member: sertakan status approved agar UI bisa menampilkan kasir pending.
create or replace function get_store_members()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  r text;
begin
  select current_store_id(), current_user_role() into sid, r;

  if r is distinct from 'owner' then
    return json_build_object('error', 'Hanya pemilik toko yang bisa kelola kasir', 'members', '[]'::json);
  end if;

  return (
    select json_build_object(
      'error', null,
      'members', coalesce(json_agg(json_build_object(
        'user_id',    sm.user_id,
        'role',       sm.role,
        'username',   split_part(u.email, '@', 1),
        'created_at', sm.created_at,
        'approved',   sm.approved
      ) order by sm.approved asc, sm.created_at asc), '[]'::json)
    )
    from store_members sm
    join auth.users u on u.id = sm.user_id
    where sm.store_id = sid
  );
end;
$$;

-- 8) Tambah kasir manual (username): langsung disetujui. Jika sudah terdaftar
--    sebagai pending, langsung dinaikkan statusnya.
create or replace function invite_kasir(p_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  r text;
  uid uuid;
  uname text;
begin
  select current_store_id(), current_user_role() into sid, r;

  if r is distinct from 'owner' then
    return json_build_object('error', 'Hanya pemilik toko yang bisa menambah kasir');
  end if;

  uname := lower(trim(p_username));
  if uname = '' then
    return json_build_object('error', 'Username wajib diisi');
  end if;

  select id into uid from auth.users where email = uname || '@app.pos';
  if uid is null then
    return json_build_object('error', 'Username tidak ditemukan. Pastikan akun kasir sudah didaftarkan terlebih dahulu.');
  end if;

  if exists (select 1 from store_members where user_id = uid and store_id = sid and approved) then
    return json_build_object('error', 'Akun tersebut sudah menjadi member toko ini');
  end if;

  if exists (select 1 from store_members where user_id = uid and store_id = sid) then
    update store_members set approved = true where user_id = uid and store_id = sid;
    insert into user_active_store (user_id, store_id)
    values (uid, sid)
    on conflict (user_id) do nothing;
    return json_build_object('error', null);
  end if;

  insert into store_members (user_id, store_id, role)
  values (uid, sid, 'kasir');
  return json_build_object('error', null);
end;
$$;

-- 9) Persetujuan kasir pending oleh pemilik.
create or replace function approve_member(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  r text;
begin
  select current_store_id(), current_user_role() into sid, r;

  if r is distinct from 'owner' then
    return json_build_object('error', 'Hanya pemilik toko yang bisa menyetujui kasir');
  end if;

  update store_members
  set approved = true
  where user_id = p_user_id and store_id = sid and role = 'kasir';

  if not found then
    return json_build_object('error', 'Member tidak ditemukan');
  end if;

  insert into user_active_store (user_id, store_id)
  values (p_user_id, sid)
  on conflict (user_id) do nothing;

  return json_build_object('error', null);
end;
$$;

grant execute on function approve_member(uuid) to authenticated;
