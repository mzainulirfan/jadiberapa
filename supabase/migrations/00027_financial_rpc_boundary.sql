-- Semua mutasi finansial melewati RPC tervalidasi. Katalog hanya dapat ditulis
-- owner, sementara owner dan kasir tetap dapat membaca data toko aktif.

create or replace function add_stock(
  p_product_id uuid,
  p_qty integer,
  p_price_buy integer default null,
  p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  role_name text;
  product_row products%rowtype;
  new_stock bigint;
begin
  if auth.uid() is null then return json_build_object('error', 'Tidak ada sesi'); end if;
  select current_store_id(), current_user_role() into sid, role_name;
  if sid is null or role_name is null or role_name not in ('owner', 'kasir') then
    return json_build_object('error', 'Akses ditolak');
  end if;
  if p_qty is null or p_qty <= 0 then
    return json_build_object('error', 'Jumlah stok masuk tidak valid');
  end if;
  if p_price_buy is not null and p_price_buy < 0 then
    return json_build_object('error', 'Harga beli tidak valid');
  end if;
  if role_name <> 'owner' and p_price_buy is not null then
    return json_build_object('error', 'Hanya pemilik toko yang bisa mengubah harga beli');
  end if;

  select * into product_row
  from products
  where id = p_product_id and store_id = sid
  for update;
  if not found then return json_build_object('error', 'Barang tidak ditemukan'); end if;

  new_stock := product_row.stock::bigint + p_qty::bigint;
  if new_stock > 2147483647 then
    return json_build_object('error', 'Jumlah stok terlalu besar');
  end if;

  update products
  set stock = new_stock::integer,
      price_buy = case when p_price_buy is null then price_buy else p_price_buy end,
      updated_at = now()
  where id = p_product_id and store_id = sid;

  insert into stock_movements (store_id, product_id, type, qty, note)
  values (sid, p_product_id, 'in', p_qty, nullif(btrim(p_note), ''));

  return json_build_object('error', null, 'stock', new_stock);
end;
$$;

create or replace function adjust_stock(
  p_product_id uuid,
  p_new_stock integer,
  p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  current_stock integer;
  delta integer;
begin
  if auth.uid() is null then return json_build_object('error', 'Tidak ada sesi'); end if;
  if current_user_role() is distinct from 'owner' then
    return json_build_object('error', 'Hanya pemilik toko yang bisa stok opname');
  end if;
  select current_store_id() into sid;
  if sid is null then return json_build_object('error', 'Toko aktif tidak ditemukan'); end if;
  if p_new_stock is null or p_new_stock < 0 then
    return json_build_object('error', 'Stok hasil opname tidak valid');
  end if;

  select stock into current_stock
  from products
  where id = p_product_id and store_id = sid
  for update;
  if not found then return json_build_object('error', 'Barang tidak ditemukan'); end if;

  delta := p_new_stock - current_stock;
  if delta = 0 then return json_build_object('error', null, 'stock', current_stock); end if;

  update products
  set stock = p_new_stock, updated_at = now()
  where id = p_product_id and store_id = sid;

  insert into stock_movements (store_id, product_id, type, qty, note)
  values (sid, p_product_id, 'adjust', delta, nullif(btrim(p_note), ''));

  return json_build_object('error', null, 'stock', p_new_stock);
end;
$$;

create or replace function create_customer_contact(
  p_name text,
  p_phone text default null,
  p_address text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  customer_id uuid;
begin
  if auth.uid() is null then return json_build_object('error', 'Tidak ada sesi'); end if;
  select current_store_id() into sid;
  if sid is null or current_user_role() is null or current_user_role() not in ('owner', 'kasir') then
    return json_build_object('error', 'Akses ditolak');
  end if;
  if nullif(btrim(p_name), '') is null or length(btrim(p_name)) > 200 then
    return json_build_object('error', 'Nama pembeli tidak valid');
  end if;

  insert into customers (store_id, name, phone, address)
  values (sid, btrim(p_name), nullif(btrim(p_phone), ''), nullif(btrim(p_address), ''))
  returning id into customer_id;

  return json_build_object('error', null, 'id', customer_id);
end;
$$;

create or replace function update_customer_contact(
  p_customer_id uuid,
  p_name text,
  p_phone text default null,
  p_address text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  if auth.uid() is null then return json_build_object('error', 'Tidak ada sesi'); end if;
  select current_store_id() into sid;
  if sid is null or current_user_role() is null or current_user_role() not in ('owner', 'kasir') then
    return json_build_object('error', 'Akses ditolak');
  end if;
  if nullif(btrim(p_name), '') is null or length(btrim(p_name)) > 200 then
    return json_build_object('error', 'Nama pembeli tidak valid');
  end if;

  update customers
  set name = btrim(p_name),
      phone = nullif(btrim(p_phone), ''),
      address = nullif(btrim(p_address), '')
  where id = p_customer_id and store_id = sid;
  if not found then return json_build_object('error', 'Pembeli tidak ditemukan'); end if;

  return json_build_object('error', null);
end;
$$;

create or replace function delete_customer_contact(p_customer_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  if auth.uid() is null then return json_build_object('error', 'Tidak ada sesi'); end if;
  select current_store_id() into sid;
  if sid is null or current_user_role() is null or current_user_role() not in ('owner', 'kasir') then
    return json_build_object('error', 'Akses ditolak');
  end if;

  delete from customers where id = p_customer_id and store_id = sid;
  if not found then return json_build_object('error', 'Pembeli tidak ditemukan'); end if;
  return json_build_object('error', null);
end;
$$;

-- Pembelian dan pembayaran supplier merupakan operasi owner-only di DB, bukan
-- hanya di Server Action.
create or replace function create_purchase(
  p_supplier_id uuid,
  p_items jsonb,
  p_paid_amount integer default 0,
  p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  item jsonb;
  pid uuid;
  qty integer;
  item_price_buy integer;
  product_stock integer;
  total bigint := 0;
  paid integer;
  pur_id uuid;
  seen_products uuid[] := '{}';
begin
  if auth.uid() is null then return json_build_object('error', 'Tidak ada sesi'); end if;
  if current_user_role() is distinct from 'owner' then
    return json_build_object('error', 'Hanya pemilik toko yang bisa catat pembelian');
  end if;
  select current_store_id() into sid;
  if sid is null then return json_build_object('error', 'Toko aktif tidak ditemukan'); end if;
  if p_supplier_id is not null and not exists (
    select 1 from suppliers where id = p_supplier_id and store_id = sid
  ) then
    return json_build_object('error', 'Supplier tidak ditemukan di toko ini');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return json_build_object('error', 'Format item pembelian tidak valid');
  end if;
  if jsonb_array_length(p_items) = 0 then
    return json_build_object('error', 'Pembelian minimal 1 item');
  end if;
  if jsonb_array_length(p_items) > 500 then
    return json_build_object('error', 'Jumlah item pembelian terlalu banyak');
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    begin
      pid := (item->>'product_id')::uuid;
      qty := (item->>'qty')::integer;
      item_price_buy := (item->>'price_buy')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      return json_build_object('error', 'Item pembelian tidak valid');
    end;
    if pid is null or qty is null or item_price_buy is null then
      return json_build_object('error', 'Item pembelian tidak lengkap');
    end if;
    if pid = any(seen_products) then
      return json_build_object('error', 'Barang pembelian duplikat');
    end if;
    seen_products := array_append(seen_products, pid);
    if qty <= 0 or item_price_buy < 0 then
      return json_build_object('error', 'Jumlah atau harga beli tidak valid');
    end if;
    select stock into product_stock
    from products
    where id = pid and store_id = sid
    for update;
    if not found then return json_build_object('error', 'Barang tidak ditemukan di toko ini'); end if;
    if product_stock::bigint + qty::bigint > 2147483647 then
      return json_build_object('error', 'Jumlah stok terlalu besar');
    end if;
    total := total + qty::bigint * item_price_buy::bigint;
    if total > 2147483647 then
      return json_build_object('error', 'Total pembelian terlalu besar');
    end if;
  end loop;

  paid := greatest(0, least(total::integer, coalesce(p_paid_amount, 0)));
  insert into purchases (
    store_id, number, supplier_id, total, paid_amount, status, note, user_id, cashier_name
  ) values (
    sid, 'PB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    p_supplier_id, total::integer, paid,
    case when paid >= total then 'lunas' else 'utang' end,
    nullif(btrim(p_note), ''), auth.uid(),
    split_part(coalesce((select email from auth.users where id = auth.uid()), ''), '@', 1)
  ) returning id into pur_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    pid := (item->>'product_id')::uuid;
    qty := (item->>'qty')::integer;
    item_price_buy := (item->>'price_buy')::integer;
    insert into purchase_items (store_id, purchase_id, product_id, qty, price_buy, subtotal)
    values (sid, pur_id, pid, qty, item_price_buy, (qty::bigint * item_price_buy::bigint)::integer);
    update products
    set stock = stock + qty, price_buy = item_price_buy, updated_at = now()
    where id = pid and store_id = sid;
    insert into stock_movements (store_id, product_id, type, qty, note)
    values (sid, pid, 'in', qty, 'Pembelian');
  end loop;

  if paid > 0 then
    insert into supplier_payments (store_id, purchase_id, amount, method, note)
    values (sid, pur_id, paid, 'cash', 'DP');
  end if;
  return json_build_object('error', null, 'id', pur_id);
end;
$$;

create or replace function record_supplier_payment(
  p_purchase_id uuid,
  p_amount integer,
  p_method text default 'cash',
  p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  pur purchases%rowtype;
  applied integer;
  new_paid integer;
  new_status text;
begin
  if auth.uid() is null then return json_build_object('error', 'Tidak ada sesi'); end if;
  if current_user_role() is distinct from 'owner' then
    return json_build_object('error', 'Hanya pemilik toko yang bisa catat pembayaran');
  end if;
  select current_store_id() into sid;
  if sid is null then return json_build_object('error', 'Toko aktif tidak ditemukan'); end if;
  if p_amount is null or p_amount <= 0 then
    return json_build_object('error', 'Nominal tidak valid');
  end if;

  select * into pur
  from purchases
  where id = p_purchase_id and store_id = sid
  for update;
  if not found then return json_build_object('error', 'Pembelian tidak ditemukan'); end if;

  applied := least(p_amount, greatest(0, pur.total - pur.paid_amount));
  if applied <= 0 then return json_build_object('error', 'Utang sudah lunas'); end if;
  insert into supplier_payments (store_id, purchase_id, amount, method, note)
  values (sid, p_purchase_id, applied, coalesce(nullif(btrim(p_method), ''), 'cash'), nullif(btrim(p_note), ''));

  new_paid := pur.paid_amount + applied;
  new_status := case when new_paid >= pur.total then 'lunas' else 'utang' end;
  update purchases set paid_amount = new_paid, status = new_status
  where id = p_purchase_id and store_id = sid;
  return json_build_object('error', null, 'paid_amount', new_paid, 'status', new_status);
end;
$$;

-- Pisahkan read dan write policy. Policy owner tetap memungkinkan Server Action
-- katalog memakai sesi user, sedangkan tabel finansial hanya dapat ditulis RPC.
drop policy if exists store_all_products on products;
drop policy if exists products_member_read on products;
drop policy if exists products_owner_write on products;
create policy products_member_read on products for select to authenticated
  using (store_id = current_store_id());
create policy products_owner_write on products for all to authenticated
  using (store_id = current_store_id() and current_user_role() = 'owner')
  with check (store_id = current_store_id() and current_user_role() = 'owner');

drop policy if exists store_all_categories on categories;
drop policy if exists categories_member_read on categories;
drop policy if exists categories_owner_write on categories;
create policy categories_member_read on categories for select to authenticated
  using (store_id = current_store_id());
create policy categories_owner_write on categories for all to authenticated
  using (store_id = current_store_id() and current_user_role() = 'owner')
  with check (store_id = current_store_id() and current_user_role() = 'owner');

drop policy if exists store_all_product_variants on product_variants;
drop policy if exists product_variants_member_read on product_variants;
drop policy if exists product_variants_owner_write on product_variants;
create policy product_variants_member_read on product_variants for select to authenticated
  using (store_id = current_store_id());
create policy product_variants_owner_write on product_variants for all to authenticated
  using (store_id = current_store_id() and current_user_role() = 'owner')
  with check (store_id = current_store_id() and current_user_role() = 'owner');

drop policy if exists store_all_product_units on product_units;
drop policy if exists product_units_member_read on product_units;
drop policy if exists product_units_owner_write on product_units;
create policy product_units_member_read on product_units for select to authenticated
  using (store_id = current_store_id());
create policy product_units_owner_write on product_units for all to authenticated
  using (store_id = current_store_id() and current_user_role() = 'owner')
  with check (store_id = current_store_id() and current_user_role() = 'owner');

drop policy if exists store_all_customers on customers;
drop policy if exists customers_member_read on customers;
create policy customers_member_read on customers for select to authenticated
  using (store_id = current_store_id());

drop policy if exists store_all_suppliers on suppliers;
drop policy if exists suppliers_owner_read on suppliers;
drop policy if exists suppliers_owner_write on suppliers;
create policy suppliers_owner_read on suppliers for select to authenticated
  using (store_id = current_store_id() and current_user_role() = 'owner');
create policy suppliers_owner_write on suppliers for all to authenticated
  using (store_id = current_store_id() and current_user_role() = 'owner')
  with check (store_id = current_store_id() and current_user_role() = 'owner');

do $$
declare
  table_name text;
  policy_name text;
  owner_only boolean;
begin
  foreach table_name in array array[
    'transactions', 'transaction_items', 'payments', 'stock_movements',
    'purchases', 'purchase_items', 'supplier_payments', 'loyalty_ledger',
    'cash_sessions'
  ]
  loop
    policy_name := 'store_all_' || table_name;
    execute format('drop policy if exists %I on %I', policy_name, table_name);
    execute format('drop policy if exists %I on %I', table_name || '_member_read', table_name);
    execute format('drop policy if exists %I on %I', table_name || '_owner_read', table_name);
    owner_only := table_name in ('purchases', 'purchase_items', 'supplier_payments');
    if owner_only then
      execute format(
        'create policy %I on %I for select to authenticated using (store_id = current_store_id() and current_user_role() = ''owner'')',
        table_name || '_owner_read', table_name
      );
    else
      execute format(
        'create policy %I on %I for select to authenticated using (store_id = current_store_id())',
        table_name || '_member_read', table_name
      );
    end if;
  end loop;
end;
$$;

revoke insert, update, delete on
  customers, transactions, transaction_items, payments, stock_movements,
  purchases, purchase_items, supplier_payments, loyalty_ledger, cash_sessions
from authenticated;
grant select on
  customers, transactions, transaction_items, payments, stock_movements,
  purchases, purchase_items, supplier_payments, loyalty_ledger, cash_sessions
to authenticated;

revoke execute on function increment_stock(uuid, int) from public, anon, authenticated;
revoke execute on function decrement_stock(uuid, int) from public, anon, authenticated;
revoke execute on function add_stock(uuid, integer, integer, text) from public, anon;
revoke execute on function adjust_stock(uuid, integer, text) from public, anon;
revoke execute on function create_customer_contact(text, text, text) from public, anon;
revoke execute on function update_customer_contact(uuid, text, text, text) from public, anon;
revoke execute on function delete_customer_contact(uuid) from public, anon;
revoke execute on function create_purchase(uuid, jsonb, integer, text) from public, anon;
revoke execute on function record_supplier_payment(uuid, integer, text, text) from public, anon;
grant execute on function add_stock(uuid, integer, integer, text) to authenticated;
grant execute on function adjust_stock(uuid, integer, text) to authenticated;
grant execute on function create_customer_contact(text, text, text) to authenticated;
grant execute on function update_customer_contact(uuid, text, text, text) to authenticated;
grant execute on function delete_customer_contact(uuid) to authenticated;
grant execute on function create_purchase(uuid, jsonb, integer, text) to authenticated;
grant execute on function record_supplier_payment(uuid, integer, text, text) to authenticated;
