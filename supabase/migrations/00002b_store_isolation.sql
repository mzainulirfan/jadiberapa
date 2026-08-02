-- Fase multi-toko (bagian 2/6): isolasi toko — tambah store_id ke semua tabel
-- bisnis, isi ulang, NOT NULL, dan perubahan PK/constraint. Dipecah dari 00002_multi_store.sql.

-- Add store ownership to every business table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'products','categories','customers','transactions','transaction_items',
    'settings','payments','stock_movements','expenses','discounts',
    'discount_products','cash_sessions','product_variants'
  ] loop
    execute format(
      'alter table %I add column if not exists store_id uuid references stores(id) on delete cascade default current_store_id()',
      t
    );
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'products','categories','customers','transactions','transaction_items',
    'settings','payments','stock_movements','expenses','discounts',
    'discount_products','cash_sessions','product_variants'
  ] loop
    execute format('update %I set store_id = %L where store_id is null', t, '11111111-1111-1111-1111-111111111111');
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'products','categories','customers','transactions','transaction_items',
    'settings','payments','stock_movements','expenses','discounts',
    'discount_products','cash_sessions','product_variants'
  ] loop
    execute format('alter table %I alter column store_id set not null', t);
  end loop;
end $$;

-- PK settings berubah dari (key) menjadi (store_id, key). Hanya diubah bila
-- belum berbentuk (store_id, key) — aman dijalankan ulang.
do $$
declare
  cols text[];
begin
  select array_agg(a.attname order by u.ord) into cols
  from pg_constraint c
  cross join unnest(c.conkey) with ordinality as u(attnum, ord)
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = u.attnum
  where c.conname = 'settings_pkey' and c.conrelid = 'public.settings'::regclass;

  if cols is null or cols <> array['store_id', 'key'] then
    alter table settings drop constraint if exists settings_pkey;
    alter table settings add primary key (store_id, key);
  end if;
end $$;

-- Unik kategori berubah dari (name) menjadi (store_id, name). Hanya dibuat bila
-- belum ada — aman dijalankan ulang.
do $$
declare
  cols text[];
begin
  select array_agg(a.attname order by u.ord) into cols
  from pg_constraint c
  cross join unnest(c.conkey) with ordinality as u(attnum, ord)
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = u.attnum
  where c.conname = 'categories_store_name_key' and c.conrelid = 'public.categories'::regclass;

  if cols is null or cols <> array['store_id', 'name'] then
    alter table categories drop constraint if exists categories_name_key;
    alter table categories drop constraint if exists categories_store_name_key;
    alter table categories add constraint categories_store_name_key unique (store_id, name);
  end if;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'products','categories','customers','transactions','transaction_items',
    'settings','payments','stock_movements','expenses','discounts',
    'discount_products','cash_sessions','product_variants'
  ] loop
    execute format('create index if not exists %I on %I (store_id)', 'idx_' || t || '_store', t);
  end loop;
end $$;

create index if not exists transactions_user_idx on transactions (user_id);
