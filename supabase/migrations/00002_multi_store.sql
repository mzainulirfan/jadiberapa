-- Squashed multi-store, roles, and onboarding migration for fresh install.

-- Stores and membership
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Toko Saya',
  code text,
  template_key text,
  created_at timestamptz not null default now()
);

create table if not exists store_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'kasir')),
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

create table if not exists user_active_store (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table stores enable row level security;
alter table store_members enable row level security;
alter table user_active_store enable row level security;

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

-- Store codes
create or replace function make_store_code(p_name text)
returns text
language plpgsql
as $$
declare
  base text;
  result text;
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

-- Default store for data/users that already exist before this migration.
insert into stores (id, name, code)
values (
  '11111111-1111-1111-1111-111111111111',
  coalesce((select value from settings where key = 'store_name'), 'Toko Saya'),
  make_store_code(coalesce((select value from settings where key = 'store_name'), 'Toko Saya'))
)
on conflict (id) do nothing;

update stores
set code = make_store_code(name)
where code is null;

alter table stores alter column code set not null;
create unique index if not exists stores_code_key on stores (code);
create index if not exists idx_stores_template_key on stores (template_key);

insert into store_members (user_id, store_id, role)
select id, '11111111-1111-1111-1111-111111111111', 'owner'
from auth.users
on conflict (user_id, store_id) do nothing;

insert into user_active_store (user_id, store_id)
select distinct on (user_id) user_id, store_id
from store_members
order by user_id, created_at asc
on conflict (user_id) do nothing;

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

alter table settings drop constraint if exists settings_pkey;
alter table settings add primary key (store_id, key);

alter table categories drop constraint if exists categories_name_key;
alter table categories add constraint categories_store_name_key unique (store_id, name);

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

-- Store-aware RLS.
drop policy if exists stores_member on stores;
create policy stores_member on stores
  for all to authenticated
  using (exists (select 1 from store_members sm where sm.store_id = stores.id and sm.user_id = auth.uid()))
  with check (exists (select 1 from store_members sm where sm.store_id = stores.id and sm.user_id = auth.uid()));

drop policy if exists store_members_own on store_members;
drop policy if exists store_members_select_own on store_members;
create policy store_members_select_own on store_members
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_active_store_own on user_active_store;
create policy user_active_store_own on user_active_store
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

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
declare
  t text;
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

-- Keep active store valid when memberships change.
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

create or replace function store_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from user_active_store where user_id = old.user_id and store_id = old.store_id;
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

-- Store-scoped security definer functions.
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

create or replace function get_shift_summary(p_opened_at timestamptz)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'cashSales', coalesce((
      select sum(total) from transactions
      where payment_method = 'cash' and created_at >= p_opened_at and store_id = current_store_id()
    ), 0)
    + coalesce((
      select sum(amount) from payments
      where method = 'cash' and created_at >= p_opened_at and store_id = current_store_id()
    ), 0),
    'txCount', coalesce((
      select count(*) from transactions
      where created_at >= p_opened_at and store_id = current_store_id()
    ), 0)
  );
$$;

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
    'customer', (select json_build_object('name', c.name) from customers c where c.id = t.customer_id),
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
      select coalesce(json_agg(json_build_object('amount', pm.amount, 'method', pm.method, 'created_at', pm.created_at)), '[]'::json)
      from payments pm
      where pm.transaction_id = t.id
    )
  )
  from transactions t
  where t.share_token = p_token;
$$;

grant execute on function get_public_receipt(uuid) to anon, authenticated, service_role;

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

-- Held carts are created after store isolation exists.
create table if not exists held_carts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade default current_store_id(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Pesanan',
  items jsonb not null default '[]',
  customer jsonb,
  created_at timestamptz not null default now()
);

alter table held_carts enable row level security;
drop policy if exists held_carts_store on held_carts;
create policy held_carts_store on held_carts
  for all to authenticated
  using (store_id = current_store_id() and user_id = auth.uid())
  with check (store_id = current_store_id() and user_id = auth.uid());

create index if not exists held_carts_store_idx on held_carts (store_id);

-- Auth signup hook: owner creates a new store; cashier joins by store code.
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
    insert into store_members (user_id, store_id, role)
    values (new.id, target_store, 'kasir')
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
