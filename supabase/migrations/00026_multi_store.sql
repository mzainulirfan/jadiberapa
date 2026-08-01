-- Fase 6 (tahap 1): Multi-toko — isolasi data per toko.
-- 1 user = 1 toko (owner). store_members menyiapkan peran (owner/kasir) untuk
-- tahap berikutnya. Semua tabel data mendapat store_id + RLS per toko.
--
-- Data lama (sebelum migrasi) digabung ke SATU toko default yang dimiliki semua
-- user yang sudah ada (mempertahankan data historis yang tadinya di-share).
-- User baru otomatis mendapat toko sendiri via trigger auth.users.

-- ============ 1. Toko & keanggotaan ============

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Toko Saya',
  created_at timestamptz not null default now()
);

create table if not exists store_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'kasir')),
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

alter table stores enable row level security;
alter table store_members enable row level security;

-- RLS stores: hanya member yang bisa lihat/ubah toko.
drop policy if exists stores_member on stores;
create policy stores_member on stores
  for all to authenticated
  using (
    exists (select 1 from store_members sm where sm.store_id = stores.id and sm.user_id = auth.uid())
  )
  with check (
    exists (select 1 from store_members sm where sm.store_id = stores.id and sm.user_id = auth.uid())
  );

-- RLS store_members: user hanya bisa melihat keanggotaannya sendiri.
drop policy if exists store_members_own on store_members;
create policy store_members_own on store_members
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Toko aktif user (default: membership pertama). Dipakai untuk default kolom
-- store_id dan untuk RLS (invoker) serta guard RPC security definer.
create or replace function current_store_id()
returns uuid
language sql
stable
as $$
  select store_id
  from store_members
  where user_id = auth.uid()
  order by created_at asc
  limit 1;
$$;

-- ============ 2. Tambah store_id ke semua tabel data ============

do $$
declare t text;
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

-- ============ 3. Backfill data lama ke toko default ============

insert into stores (id, name)
values (
  '11111111-1111-1111-1111-111111111111',
  coalesce((select value from settings where key = 'store_name'), 'Toko Saya')
)
on conflict (id) do nothing;

update stores
set name = coalesce((select value from settings where key = 'store_name'), name)
where id = '11111111-1111-1111-1111-111111111111';

insert into store_members (user_id, store_id, role)
select id, '11111111-1111-1111-1111-111111111111', 'owner'
from auth.users
on conflict (user_id, store_id) do nothing;

do $$
declare t text;
begin
  foreach t in array array[
    'products','categories','customers','transactions','transaction_items',
    'settings','payments','stock_movements','expenses','discounts',
    'discount_products','cash_sessions','product_variants'
  ] loop
    execute format(
      'update %I set store_id = %L where store_id is null',
      t, '11111111-1111-1111-1111-111111111111'
    );
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'products','categories','customers','transactions','transaction_items',
    'settings','payments','stock_movements','expenses','discounts',
    'discount_products','cash_sessions','product_variants'
  ] loop
    execute format('alter table %I alter column store_id set not null', t);
  end loop;
end $$;

-- ============ 4. Perbaikan constraint (nama unik & PK jadi per toko) ============

alter table settings drop constraint if exists settings_pkey;
alter table settings add primary key (store_id, key);

alter table categories drop constraint if exists categories_name_key;
alter table categories add constraint categories_store_name_key unique (store_id, name);

-- ============ 5. Indeks per toko ============

do $$
declare t text;
begin
  foreach t in array array[
    'products','categories','customers','transactions','transaction_items',
    'settings','payments','stock_movements','expenses','discounts',
    'discount_products','cash_sessions','product_variants'
  ] loop
    execute format('create index if not exists %I on %I (store_id)', 'idx_' || t || '_store', t);
  end loop;
end $$;

-- ============ 6. Ganti semua RLS menjadi per toko ============

drop policy if exists "authenticated_all" on products;
drop policy if exists "authenticated_all" on categories;
drop policy if exists "authenticated_all" on customers;
drop policy if exists "authenticated_all" on transactions;
drop policy if exists "authenticated_all" on transaction_items;
drop policy if exists "authenticated_all" on settings;
drop policy if exists "payments_all" on payments;
drop policy if exists "stock_movements_all" on stock_movements;
drop policy if exists "expenses_all" on expenses;
drop policy if exists "discounts_all" on discounts;
drop policy if exists "discount_products_all" on discount_products;
drop policy if exists "cash_sessions_all" on cash_sessions;
drop policy if exists "Semua akses product_variants" on product_variants;

do $$
declare t text;
begin
  foreach t in array array[
    'products','categories','customers','transactions','transaction_items',
    'settings','payments','stock_movements','expenses','discounts',
    'discount_products','cash_sessions','product_variants'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated using (store_id = current_store_id()) with check (store_id = current_store_id())',
      'store_all_' || t, t
    );
  end loop;
end $$;

-- ============ 7. Guard RPC security definer per toko ============

-- decrement_stock: cegah user mengubah stok produk toko lain.
create or replace function decrement_stock(pid uuid, qty int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update products
  set stock = greatest(0, stock - qty), updated_at = now()
  where id = pid and store_id = current_store_id();
end;
$$;

-- increment_stock: sama, kunci ke toko user.
create or replace function increment_stock(pid uuid, qty int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update products
  set stock = stock + qty, updated_at = now()
  where id = pid and store_id = current_store_id();
end;
$$;

-- get_shift_summary: batasi kas ke toko user.
create or replace function get_shift_summary(p_opened_at timestamptz)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'cashSales', coalesce((
      select sum(total) from transactions
      where payment_method = 'cash' and created_at >= p_opened_at
        and store_id = current_store_id()
    ), 0)
    + coalesce((
      select sum(amount) from payments
      where method = 'cash' and created_at >= p_opened_at
        and store_id = current_store_id()
    ), 0),
    'txCount', coalesce((
      select count(*) from transactions
      where created_at >= p_opened_at
        and store_id = current_store_id()
    ), 0)
  );
$$;

-- get_public_receipt: profil toko diambil dari settings milik toko transaksi itu.
create or replace function get_public_receipt(p_token uuid)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'store', (
      select json_build_object(
        'name',    coalesce((select value from settings where key = 'store_name' and store_id = t.store_id), ''),
        'address', coalesce((select value from settings where key = 'store_address' and store_id = t.store_id), ''),
        'phone',   coalesce((select value from settings where key = 'store_phone' and store_id = t.store_id), '')
      )
    ),
    'number', t.number,
    'created_at', t.created_at,
    'payment_method', t.payment_method,
    'total', t.total,
    'discount', coalesce(t.discount, 0),
    'fee', coalesce(t.fee, 0),
    'paid_amount', coalesce(t.paid_amount, t.total),
    'status', coalesce(t.status, 'lunas'),
    'customer', (
      select json_build_object('name', c.name) from customers c where c.id = t.customer_id
    ),
    'items', (
      select coalesce(json_agg(json_build_object(
        'name',         coalesce(p.name, 'Produk dihapus'),
        'variant_name', coalesce(ti.variant_name, ''),
        'qty',          ti.qty,
        'price_sell',   ti.price_sell,
        'subtotal',     ti.subtotal,
        'discount',     coalesce(ti.discount, 0)
      )), '[]'::json)
      from transaction_items ti
      left join products p on p.id = ti.product_id
      where ti.transaction_id = t.id
    ),
    'payments', (
      select coalesce(json_agg(json_build_object(
        'amount',     pm.amount,
        'method',     pm.method,
        'created_at', pm.created_at
      )), '[]'::json)
      from payments pm
      where pm.transaction_id = t.id
    )
  )
  from transactions t
  where t.share_token = p_token
$$;

grant execute on function get_public_receipt(uuid) to anon, authenticated, service_role;

-- ============ 8. User baru otomatis dapat toko sendiri ============

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare new_store_id uuid;
begin
  insert into stores (name)
  values (coalesce(new.raw_user_meta_data->>'store_name', 'Toko Saya'))
  returning id into new_store_id;

  insert into store_members (user_id, store_id, role)
  values (new.id, new_store_id, 'owner');

  insert into settings (store_id, key, value) values
    (new_store_id, 'store_name',  coalesce(new.raw_user_meta_data->>'store_name', 'Toko Saya')),
    (new_store_id, 'store_address', ''),
    (new_store_id, 'store_phone', '');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
