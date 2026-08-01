-- Fase 6 (tahap 3): Kode toko unik untuk gabung kasir saat mendaftar.
-- - stores.code: slug nama toko + 4 huruf/angka acak, unik dan tak bisa diubah.
-- - Kasir memilih "Daftar sebagai Kasir" di halaman daftar dan memasukkan kode
--   toko; trigger handle_new_user menjadikannya member kasir (tanpa membuat toko
--   baru). Pemilik tetap otomatis membuat toko baru.
-- - get_store_by_code untuk memvalidasi kode dari sisi client sebelum mendaftar.

-- ============ 1. Kolom code + pengisian toko lama ============

alter table stores add column if not exists code text;

-- Slug nama toko + suffix acak, dijamin unik terhadap stores.code.
create or replace function make_store_code(p_name text)
returns text
language plpgsql
as $$
declare base text; result text;
begin
  base := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  if base = '' then base := 'toko'; end if;
  loop
    result := base || '-' || substr(md5(random()::text), 1, 4);
    exit when not exists (select 1 from stores where code = result);
  end loop;
  return result;
end;
$$;

-- Isi kode untuk semua toko yang sudah ada.
do $$
declare s record;
begin
  for s in select id, name from stores loop
    update stores set code = make_store_code(s.name) where id = s.id;
  end loop;
end $$;

alter table stores alter column code set not null;
create unique index if not exists stores_code_key on stores (code);

-- ============ 2. handle_new_user: kasir gabung by kode, pemilik bikin toko ============

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare store_code text; target_store uuid;
begin
  store_code := nullif(trim(coalesce(new.raw_user_meta_data->>'store_code', '')), '');

  -- Kasir: gabung ke toko yang sudah ada, tidak membuat toko baru.
  if store_code is not null then
    select id into target_store from stores where code = lower(store_code);
    if target_store is null then
      raise exception 'Kode toko tidak ditemukan';
    end if;
    insert into store_members (user_id, store_id, role)
    values (new.id, target_store, 'kasir')
    on conflict (user_id, store_id) do nothing;
    return new;
  end if;

  -- Pemilik: buat toko baru + settings awal.
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

-- ============ 3. Validasi kode dari client ============

create or replace function get_store_by_code(p_code text)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'store_id', id,
    'name',     name
  )
  from stores
  where code = lower(trim(p_code))
  limit 1;
$$;
