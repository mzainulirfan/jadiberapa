-- Fase 6 (tahap 2): Peran Pemilik vs Kasir + pindah toko aktif.
-- - user_active_store: toko yang sedang aktif dipakai user. Sebelumnya toko aktif
--   selalu membership pertama; sekarang bisa diganti sehingga owner multi-toko
--   bisa pindah toko, dan kasir otomatis memakai toko yang mengundangnya.
-- - current_store_id() sekarang mengikuti toko aktif.
-- - RLS store_members dikunci menjadi SELECT-only (menutup celah user bisa
--   self-insert/bergabung ke toko lain tanpa izin); mutasi member hanya lewat
--   fungsi security definer yang memeriksa peran owner.

-- ============ 1. Toko aktif user ============

create table if not exists user_active_store (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table user_active_store enable row level security;

-- user hanya bisa membaca/mengubah baris dirinya sendiri.
drop policy if exists user_active_store_own on user_active_store;
create policy user_active_store_own on user_active_store
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Backfill: toko aktif = membership pertama user.
insert into user_active_store (user_id, store_id)
select distinct on (user_id) user_id, store_id
from store_members
order by user_id, created_at asc
on conflict (user_id) do nothing;

-- ============ 2. current_store_id / current_user_role ============

-- Toko aktif user. Kosong hanya jika user belum punya membership (tidak mungkin
-- dalam alur normal).
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
  limit 1;
$$;

-- Peran user di toko aktifnya: 'owner' | 'kasir' | null.
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
  limit 1;
$$;

-- ============ 3. Kunci RLS store_members jadi SELECT-only ============

drop policy if exists store_members_own on store_members;
create policy store_members_select_own on store_members
  for select to authenticated
  using (user_id = auth.uid());

-- ============ 4. Trigger: jaga toko aktif tetap valid ============

-- Saat membership baru dibuat, jadikan toko itu toko aktif user (mis. kasir
-- yang baru diundang langsung memakai toko pengundang).
create or replace function store_members_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_active_store (user_id, store_id)
  values (new.user_id, new.store_id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Saat membership dihapus (kasir dipecat), bersihkan toko aktif; kalau itu
-- satu-satunya toko aktif, pindahkan ke membership pertama yang tersisa.
create or replace function store_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from user_active_store
  where user_id = old.user_id and store_id = old.store_id;

  if not exists (select 1 from user_active_store where user_id = old.user_id) then
    insert into user_active_store (user_id, store_id)
    select user_id, store_id
    from store_members
    where user_id = old.user_id
    order by created_at asc
    limit 1;
  end if;

  return old;
end;
$$;

drop trigger if exists store_members_after_insert_trigger on store_members;
create trigger store_members_after_insert_trigger
  after insert on store_members
  for each row execute function store_members_after_insert();

drop trigger if exists store_members_after_delete_trigger on store_members;
create trigger store_members_after_delete_trigger
  after delete on store_members
  for each row execute function store_members_after_delete();

-- ============ 5. Fungsi security definer: toko & kelola kasir ============

-- Daftar toko user + peran + toko aktif.
create or replace function get_my_stores()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare active uuid;
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

-- Ganti toko aktif. User harus member toko tersebut.
create or replace function set_active_store(p_store_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from store_members where user_id = auth.uid() and store_id = p_store_id
  ) then
    return json_build_object('error', 'Anda bukan member toko ini');
  end if;

  insert into user_active_store (user_id, store_id)
  values (auth.uid(), p_store_id)
  on conflict (user_id) do update
    set store_id = excluded.store_id, updated_at = now();

  return json_build_object('error', null);
end;
$$;

-- Daftar member toko aktif (khusus owner).
create or replace function get_store_members()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare sid uuid; r text;
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

-- Undang kasir: cari akun yang sudah terdaftar (email sintetis <username>@app.pos),
-- lalu jadikan member kasir toko aktif.
create or replace function invite_kasir(p_username text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare sid uuid; r text; uid uuid; uname text;
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

  insert into store_members (user_id, store_id, role)
  values (uid, sid, 'kasir');

  return json_build_object('error', null);
end;
$$;

-- Pecat kasir dari toko aktif (khusus owner).
create or replace function remove_member(p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare sid uuid; r text;
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
