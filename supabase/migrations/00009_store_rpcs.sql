-- Fase multi-toko (bagian 5/6): RPC kelola toko & kasir.

-- Store and staff RPCs.
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
    where sm.user_id = auth.uid()
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
  if not exists (select 1 from store_members where user_id = auth.uid() and store_id = p_store_id) then
    return json_build_object('error', 'Anda bukan member toko ini');
  end if;

  insert into user_active_store (user_id, store_id)
  values (auth.uid(), p_store_id)
  on conflict (user_id) do update set store_id = excluded.store_id, updated_at = now();

  return json_build_object('error', null);
end;
$$;

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
        'created_at', sm.created_at
      ) order by sm.created_at asc), '[]'::json)
    )
    from store_members sm
    join auth.users u on u.id = sm.user_id
    where sm.store_id = sid
  );
end;
$$;

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
  if exists (select 1 from store_members where user_id = uid and store_id = sid) then
    return json_build_object('error', 'Akun tersebut sudah menjadi member toko ini');
  end if;

  insert into store_members (user_id, store_id, role) values (uid, sid, 'kasir');
  return json_build_object('error', null);
end;
$$;

create or replace function remove_member(p_user_id uuid)
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
    return json_build_object('error', 'Hanya pemilik toko yang bisa menghapus kasir');
  end if;
  if p_user_id = auth.uid() then
    return json_build_object('error', 'Pemilik tidak bisa menghapus dirinya sendiri');
  end if;

  delete from store_members where user_id = p_user_id and store_id = sid;
  return json_build_object('error', null);
end;
$$;

create or replace function get_store_by_code(p_code text)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object('store_id', id, 'name', name)
  from stores
  where code = lower(trim(p_code))
  limit 1;
$$;
