-- Fase keamanan & konsistensi transaksi.
-- Semua mutation finansial penting divalidasi dan dijalankan atomik di database.

-- Idempotensi diperlukan karena request offline dapat berhasil di server tetapi
-- response-nya hilang sebelum browser menerimanya.
alter table transactions add column if not exists idempotency_key text;
create unique index if not exists transactions_store_idempotency_idx
  on transactions (store_id, idempotency_key)
  where idempotency_key is not null;

-- Cart benar-benar scoped ke toko aktif. Baris lama tanpa store tidak bisa
-- dipulihkan secara aman bila user sudah tidak punya membership toko.
update carts c
set store_id = (
  select sm.store_id
  from store_members sm
  where sm.user_id = c.user_id and sm.approved
  order by sm.created_at asc
  limit 1
)
where c.store_id is null;

delete from carts where store_id is null;
alter table carts alter column store_id set not null;

alter table carts drop constraint if exists carts_pkey;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.carts'::regclass
      and contype = 'p'
  ) then
    alter table carts add constraint carts_pkey primary key (user_id, store_id);
  end if;
end $$;

drop policy if exists cart_own on carts;
create policy cart_own on carts
  for all to authenticated
  using (auth.uid() = user_id and store_id = current_store_id())
  with check (auth.uid() = user_id and store_id = current_store_id());

create index if not exists carts_user_store_idx on carts (user_id, store_id);

-- Server action tetap memeriksa owner, tetapi policy Storage juga harus menutup
-- jalur langsung ke Supabase dari browser kasir.
drop policy if exists product_images_auth_insert on storage.objects;
create policy product_images_auth_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and split_part(name, '/', 1) = current_store_id()::text
    and current_user_role() = 'owner'
  );

drop policy if exists product_images_auth_update on storage.objects;
create policy product_images_auth_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and split_part(name, '/', 1) = current_store_id()::text
    and current_user_role() = 'owner'
  )
  with check (
    bucket_id = 'product-images'
    and split_part(name, '/', 1) = current_store_id()::text
    and current_user_role() = 'owner'
  );

drop policy if exists product_images_auth_delete on storage.objects;
create policy product_images_auth_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and split_part(name, '/', 1) = current_store_id()::text
    and current_user_role() = 'owner'
  );

-- Pastikan relasi antar tabel tidak bisa menghubungkan data toko berbeda.
create or replace function enforce_transaction_store_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_store uuid;
begin
  if tg_table_name = 'transactions' then
    if new.customer_id is not null then
      select store_id into related_store from customers where id = new.customer_id;
      if related_store is distinct from new.store_id then
        raise exception 'Pembeli bukan bagian dari toko aktif';
      end if;
    end if;
  elsif tg_table_name = 'transaction_items' then
    select store_id into related_store from transactions where id = new.transaction_id;
    if related_store is distinct from new.store_id then
      raise exception 'Transaksi bukan bagian dari toko aktif';
    end if;
    select store_id into related_store from products where id = new.product_id;
    if related_store is distinct from new.store_id then
      raise exception 'Barang bukan bagian dari toko aktif';
    end if;
    if new.variant_id is not null then
      select store_id into related_store from product_variants where id = new.variant_id;
      if related_store is distinct from new.store_id then
        raise exception 'Varian bukan bagian dari toko aktif';
      end if;
    end if;
  elsif tg_table_name = 'payments' then
    select store_id into related_store from transactions where id = new.transaction_id;
    if related_store is distinct from new.store_id then
      raise exception 'Pembayaran bukan bagian dari toko aktif';
    end if;
  elsif tg_table_name = 'stock_movements' then
    select store_id into related_store from products where id = new.product_id;
    if related_store is distinct from new.store_id then
      raise exception 'Pergerakan stok bukan bagian dari toko aktif';
    end if;
  elsif tg_table_name = 'product_variants' or tg_table_name = 'product_units' then
    select store_id into related_store from products where id = new.product_id;
    if related_store is distinct from new.store_id then
      raise exception 'Detail produk bukan bagian dari toko aktif';
    end if;
  elsif tg_table_name = 'discount_products' then
    select store_id into related_store from discounts where id = new.discount_id;
    if related_store is distinct from new.store_id then
      raise exception 'Diskon bukan bagian dari toko aktif';
    end if;
    select store_id into related_store from products where id = new.product_id;
    if related_store is distinct from new.store_id then
      raise exception 'Produk diskon bukan bagian dari toko aktif';
    end if;
  elsif tg_table_name = 'purchases' then
    if new.supplier_id is not null then
      select store_id into related_store from suppliers where id = new.supplier_id;
      if related_store is distinct from new.store_id then
        raise exception 'Supplier bukan bagian dari toko aktif';
      end if;
    end if;
  elsif tg_table_name = 'purchase_items' then
    select store_id into related_store from purchases where id = new.purchase_id;
    if related_store is distinct from new.store_id then
      raise exception 'Pembelian bukan bagian dari toko aktif';
    end if;
    select store_id into related_store from products where id = new.product_id;
    if related_store is distinct from new.store_id then
      raise exception 'Barang pembelian bukan bagian dari toko aktif';
    end if;
  elsif tg_table_name = 'supplier_payments' then
    select store_id into related_store from purchases where id = new.purchase_id;
    if related_store is distinct from new.store_id then
      raise exception 'Pembayaran supplier bukan bagian dari toko aktif';
    end if;
  elsif tg_table_name = 'loyalty_ledger' then
    select store_id into related_store from customers where id = new.customer_id;
    if related_store is distinct from new.store_id then
      raise exception 'Ledger loyalty bukan bagian dari toko aktif';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_transactions_store_links on transactions;
create trigger enforce_transactions_store_links
  before insert or update on transactions
  for each row execute function enforce_transaction_store_links();

drop trigger if exists enforce_transaction_items_store_links on transaction_items;
create trigger enforce_transaction_items_store_links
  before insert or update on transaction_items
  for each row execute function enforce_transaction_store_links();

drop trigger if exists enforce_payments_store_links on payments;
create trigger enforce_payments_store_links
  before insert or update on payments
  for each row execute function enforce_transaction_store_links();

drop trigger if exists enforce_stock_movements_store_links on stock_movements;
create trigger enforce_stock_movements_store_links
  before insert or update on stock_movements
  for each row execute function enforce_transaction_store_links();

drop trigger if exists enforce_product_variants_store_links on product_variants;
create trigger enforce_product_variants_store_links
  before insert or update on product_variants
  for each row execute function enforce_transaction_store_links();

drop trigger if exists enforce_product_units_store_links on product_units;
create trigger enforce_product_units_store_links
  before insert or update on product_units
  for each row execute function enforce_transaction_store_links();

drop trigger if exists enforce_discount_products_store_links on discount_products;
create trigger enforce_discount_products_store_links
  before insert or update on discount_products
  for each row execute function enforce_transaction_store_links();

drop trigger if exists enforce_purchases_store_links on purchases;
create trigger enforce_purchases_store_links
  before insert or update on purchases
  for each row execute function enforce_transaction_store_links();

drop trigger if exists enforce_purchase_items_store_links on purchase_items;
create trigger enforce_purchase_items_store_links
  before insert or update on purchase_items
  for each row execute function enforce_transaction_store_links();

drop trigger if exists enforce_supplier_payments_store_links on supplier_payments;
create trigger enforce_supplier_payments_store_links
  before insert or update on supplier_payments
  for each row execute function enforce_transaction_store_links();

drop trigger if exists enforce_loyalty_ledger_store_links on loyalty_ledger;
create trigger enforce_loyalty_ledger_store_links
  before insert or update on loyalty_ledger
  for each row execute function enforce_transaction_store_links();

-- One open cash shift per store, including concurrent attempts.
create unique index if not exists cash_sessions_one_open_per_store_idx
  on cash_sessions (store_id)
  where closed_at is null;

create or replace function is_current_store_kasir(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from store_members
    where user_id = p_user_id
      and store_id = current_store_id()
      and role = 'kasir'
      and approved
  );
$$;

create or replace function has_approved_membership()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from store_members
    where user_id = auth.uid() and approved
  );
$$;

revoke execute on function is_current_store_kasir(uuid) from public;
revoke execute on function has_approved_membership() from public;
grant execute on function is_current_store_kasir(uuid) to authenticated;
grant execute on function has_approved_membership() to authenticated;

-- Restore dilakukan di satu transaction. Jika satu tabel gagal, seluruh restore
-- rollback sehingga toko tidak tertinggal dalam kondisi setengah kosong.
create or replace function restore_store_backup(p_bundle jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  table_name text;
  row jsonb;
  rows jsonb;
  tables text[] := array[
    'transaction_items', 'payments', 'stock_movements', 'purchase_items',
    'supplier_payments', 'purchases', 'suppliers', 'discount_products',
    'transactions', 'loyalty_ledger', 'product_units', 'product_variants',
    'discounts', 'expenses', 'products', 'customers', 'categories',
    'cash_sessions', 'settings'
  ];
  insert_tables text[] := array[
    'settings', 'categories', 'customers', 'suppliers', 'products',
    'product_units', 'product_variants', 'purchases', 'purchase_items',
    'supplier_payments', 'discounts', 'discount_products', 'cash_sessions',
    'expenses', 'transactions', 'transaction_items', 'payments',
    'stock_movements', 'loyalty_ledger'
  ];
begin
  if auth.uid() is null then return json_build_object('error', 'Tidak ada sesi'); end if;
  if current_user_role() <> 'owner' then
    return json_build_object('error', 'Hanya pemilik toko yang bisa memulihkan backup');
  end if;
  select current_store_id() into sid;
  if sid is null then return json_build_object('error', 'Toko aktif tidak ditemukan'); end if;
  if jsonb_typeof(p_bundle) <> 'object' then
    return json_build_object('error', 'Format backup tidak valid');
  end if;
  if pg_column_size(p_bundle) > 52428800 then
    return json_build_object('error', 'Ukuran backup maksimal 50 MB');
  end if;

  foreach table_name in array tables
  loop
    execute format('delete from %I where store_id = $1', table_name) using sid;
  end loop;

  foreach table_name in array insert_tables
  loop
    rows := '[]'::jsonb;
    for row in select value from jsonb_array_elements(coalesce(p_bundle->table_name, '[]'::jsonb))
    loop
      row := jsonb_set(row, '{store_id}', to_jsonb(sid), true);
      if table_name = 'products' then row := row - 'is_low_stock'; end if;
      rows := rows || jsonb_build_array(row);
    end loop;
    if jsonb_array_length(rows) > 0 then
      if table_name = 'products' then
        execute 'insert into products
          (id, name, category_id, price_buy, price_sell, stock, sku, barcode,
           image_url, unit, min_stock, is_favorite, created_at, updated_at, store_id)
          select id, name, category_id, price_buy, price_sell, stock, sku, barcode,
           image_url, unit, min_stock, is_favorite, created_at, updated_at, store_id
          from jsonb_populate_recordset(null::products, $1)'
          using rows;
      else
        execute format(
          'insert into %I select * from jsonb_populate_recordset(null::%I, $1)',
          table_name, table_name
        ) using rows;
      end if;
    end if;
  end loop;

  return json_build_object('error', null);
end;
$$;

revoke execute on function restore_store_backup(jsonb) from public;
grant execute on function restore_store_backup(jsonb) to authenticated;

-- Checkout atomik: harga, diskon otomatis, stok, pembayaran, dan loyalty dibaca
-- serta ditulis dalam transaksi database yang sama.
create or replace function create_transaction(
  p_items jsonb,
  p_payment_method text default 'cash',
  p_customer_id uuid default null,
  p_paid_amount integer default null,
  p_discount integer default 0,
  p_fee integer default 0,
  p_points_redeemed integer default 0,
  p_idempotency_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  existing_id uuid;
  item jsonb;
  normalized jsonb := '[]'::jsonb;
  pid uuid;
  vid uuid;
  uid uuid;
  product_store uuid;
  variant_store uuid;
  unit_store uuid;
  product_category uuid;
  price_sell integer;
  price_buy integer;
  stock integer;
  factor integer;
  unit_name text;
  variant_name text;
  qty integer;
  base_qty integer;
  gross bigint;
  line_auto_discount bigint;
  line_manual_discount bigint;
  net_before_discount bigint := 0;
  note_discount bigint;
  fee_amount bigint;
  points_balance integer := 0;
  points_used integer := 0;
  redeem_value integer := 100;
  earn_per integer := 1000;
  loyalty_enabled boolean := true;
  total bigint;
  paid integer;
  transaction_id uuid;
  tx_number text;
  earned integer;
  loyalty_result json;
  setting_value text;
begin
  if auth.uid() is null then
    return json_build_object('error', 'Tidak ada sesi');
  end if;

  select current_store_id() into sid;
  if sid is null then
    return json_build_object('error', 'Toko aktif tidak ditemukan');
  end if;

  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    if length(trim(p_idempotency_key)) > 128 then
      return json_build_object('error', 'Kunci transaksi tidak valid');
    end if;
    select id into existing_id
    from transactions
    where store_id = sid and idempotency_key = trim(p_idempotency_key);
    if existing_id is not null then
      return json_build_object('error', null, 'id', existing_id, 'duplicate', true);
    end if;
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return json_build_object('error', 'Keranjang minimal 1 item');
  end if;
  if jsonb_array_length(p_items) > 500 then
    return json_build_object('error', 'Jumlah item transaksi terlalu banyak');
  end if;
  if p_payment_method not in ('cash', 'qris', 'dana', 'utang') then
    return json_build_object('error', 'Metode pembayaran tidak valid');
  end if;

  if p_customer_id is not null then
    select points into points_balance
    from customers
    where id = p_customer_id and store_id = sid
    for update;
    if not found then
      return json_build_object('error', 'Pembeli tidak ditemukan di toko ini');
    end if;
  end if;

  select value into setting_value from settings where store_id = sid and key = 'loyalty_enabled';
  loyalty_enabled := coalesce(setting_value <> '0', true);
  select value into setting_value from settings where store_id = sid and key = 'loyalty_redeem_value';
  if setting_value ~ '^\d+$' then redeem_value := greatest(1, setting_value::integer); end if;
  select value into setting_value from settings where store_id = sid and key = 'loyalty_earn_per';
  if setting_value ~ '^\d+$' then earn_per := greatest(1, setting_value::integer); end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    variant_name := null;
    unit_name := null;
    begin
      pid := (item->>'product_id')::uuid;
    exception when others then
      return json_build_object('error', 'ID barang tidak valid');
    end;
    qty := greatest(0, coalesce((item->>'qty')::integer, 0));
    if qty <= 0 or qty > 1000000 then
      return json_build_object('error', 'Jumlah barang tidak valid');
    end if;

    select p.store_id, p.category_id, p.price_sell, p.price_buy, p.stock
      into product_store, product_category, price_sell, price_buy, stock
    from products p
    where p.id = pid and p.store_id = sid
    for update;
    if not found then
      return json_build_object('error', 'Barang tidak ditemukan di toko ini');
    end if;

    vid := null;
    if nullif(item->>'variant_id', '') is not null then
      begin
        vid := (item->>'variant_id')::uuid;
      exception when others then
        return json_build_object('error', 'ID varian tidak valid');
      end;
      select v.store_id, v.price_sell, v.price_buy, v.name
        into variant_store, price_sell, price_buy, variant_name
      from product_variants v
      where v.id = vid and v.product_id = pid and v.store_id = sid;
      if not found or variant_store is distinct from sid then
        return json_build_object('error', 'Varian tidak ditemukan di toko ini');
      end if;
    end if;

    factor := 1;
    unit_name := null;
    uid := null;
    if nullif(item->>'unit_id', '') is not null then
      begin
        uid := (item->>'unit_id')::uuid;
      exception when others then
        return json_build_object('error', 'ID satuan tidak valid');
      end;
      select u.store_id, u.factor, u.name, u.price_sell
        into unit_store, factor, unit_name, price_sell
      from product_units u
      where u.id = uid and u.product_id = pid and u.store_id = sid;
      if not found or unit_store is distinct from sid then
        return json_build_object('error', 'Satuan tidak ditemukan di toko ini');
      end if;
    elsif nullif(item->>'unit_name', '') is not null then
      -- Kompatibilitas untuk antrean offline lama yang belum menyimpan unit_id.
      -- Factor tetap dibaca dari DB, bukan dari payload lama.
      select u.id, u.store_id, u.factor, u.name, u.price_sell
        into uid, unit_store, factor, unit_name, price_sell
      from product_units u
      where u.product_id = pid
        and u.store_id = sid
        and u.name = item->>'unit_name'
      limit 1;
    end if;

    factor := greatest(1, factor);
    base_qty := qty * factor;
    if base_qty > 1000000000 then
      return json_build_object('error', 'Jumlah stok terlalu besar');
    end if;

    select coalesce((
      select least(
        case when d.value_type = 'percent'
          then round(price_sell * d.value / 100.0)::integer
          else d.value end,
        price_sell
      )
      from discounts d
      left join discount_products dp
        on dp.discount_id = d.id and dp.product_id = pid
      where d.store_id = sid
        and d.active
        and (d.type = 'global' or dp.product_id is not null)
      order by case d.type when 'product' then 0 when 'category' then 1 else 2 end,
               case when d.value_type = 'percent'
                 then round(price_sell * d.value / 100.0)::integer
                 else d.value end desc
      limit 1
    ), 0) into line_auto_discount;

    gross := price_sell::bigint * qty;
    line_auto_discount := greatest(0, least(gross, line_auto_discount * qty));
    line_manual_discount := greatest(
      0,
      least(
        gross - line_auto_discount,
        case when item->>'discount_mode' = 'manual'
          then coalesce((item->>'discount')::bigint, 0)
          else greatest(0, coalesce((item->>'discount')::bigint, 0) - line_auto_discount)
        end
      )
    );
    net_before_discount := net_before_discount + gross - line_auto_discount - line_manual_discount;

    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'product_id', pid,
      'variant_id', vid,
      'variant_name', variant_name,
      'unit_id', uid,
      'unit_name', unit_name,
      'factor', factor,
      'qty', qty,
      'base_qty', base_qty,
      'price_sell', price_sell,
      'price_buy', price_buy,
      'subtotal', gross,
      'discount', line_auto_discount + line_manual_discount
    ));
  end loop;

  if net_before_discount > 2147483647 then
    return json_build_object('error', 'Total transaksi terlalu besar');
  end if;

  note_discount := greatest(0, least(net_before_discount, coalesce(p_discount, 0)::bigint));
  fee_amount := greatest(0, coalesce(p_fee, 0)::bigint);
  points_used := 0;
  if loyalty_enabled and p_customer_id is not null and coalesce(p_points_redeemed, 0) > 0 then
    points_used := least(
      greatest(0, p_points_redeemed),
      points_balance,
      floor(greatest(0, net_before_discount - note_discount) / redeem_value)::integer
    );
  end if;

  total := greatest(0, net_before_discount - note_discount - (points_used * redeem_value) + fee_amount);
  if total > 2147483647 then
    return json_build_object('error', 'Total transaksi terlalu besar');
  end if;
  paid := case when p_payment_method = 'utang'
    then least(total, greatest(0, coalesce(p_paid_amount, 0)))
    else total end;
  tx_number := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  begin
    insert into transactions (
      store_id, total, payment_method, customer_id, discount, fee, paid_amount,
      status, number, user_id, cashier_name, idempotency_key
    ) values (
      sid, total::integer, p_payment_method, p_customer_id, note_discount::integer,
      fee_amount::integer, paid::integer,
      case when paid >= total then 'lunas' else 'utang' end,
      tx_number, auth.uid(),
      split_part(coalesce((select email from auth.users where id = auth.uid()), ''), '@', 1),
      nullif(trim(p_idempotency_key), '')
    ) returning id into transaction_id;
  exception when unique_violation then
    if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
      select id into existing_id
      from transactions
      where store_id = sid and idempotency_key = trim(p_idempotency_key);
      if existing_id is not null then
        return json_build_object('error', null, 'id', existing_id, 'duplicate', true);
      end if;
    end if;
    raise;
  end;

  for item in select * from jsonb_array_elements(normalized)
  loop
    insert into transaction_items (
      store_id, transaction_id, product_id, variant_id, variant_name, unit_name,
      factor, qty, price_sell, subtotal, discount, price_buy
    ) values (
      sid, transaction_id, (item->>'product_id')::uuid,
      nullif(item->>'variant_id', '')::uuid,
      nullif(item->>'variant_name', ''), nullif(item->>'unit_name', ''),
      (item->>'factor')::integer, (item->>'qty')::integer,
      (item->>'price_sell')::integer, (item->>'subtotal')::integer,
      (item->>'discount')::integer, (item->>'price_buy')::integer
    );

    update products as product
    set stock = product.stock - (item->>'base_qty')::integer, updated_at = now()
    where product.id = (item->>'product_id')::uuid
      and product.store_id = sid
      and product.stock >= (item->>'base_qty')::integer;
    if not found then
      raise exception 'Stok barang tidak cukup';
    end if;

    insert into stock_movements (store_id, product_id, type, qty, note)
    values (sid, (item->>'product_id')::uuid, 'out', -(item->>'base_qty')::integer, 'Penjualan');
  end loop;

  if p_payment_method = 'utang' and paid > 0 then
    insert into payments (store_id, transaction_id, amount, method, note)
    values (sid, transaction_id, paid, 'cash', 'DP');
  end if;

  if points_used > 0 then
    select redeem_loyalty_points(p_customer_id, points_used, transaction_id) into loyalty_result;
    if coalesce(loyalty_result->>'error', '') <> '' then
      raise exception '%', loyalty_result->>'error';
    end if;
  end if;

  earned := least(1000, floor(total / earn_per)::integer);
  if loyalty_enabled and p_customer_id is not null and earned > 0 then
    select award_loyalty_points(p_customer_id, earned, transaction_id) into loyalty_result;
    if coalesce(loyalty_result->>'error', '') <> '' then
      raise exception '%', loyalty_result->>'error';
    end if;
  end if;

  return json_build_object('error', null, 'id', transaction_id, 'duplicate', false);
end;
$$;

revoke execute on function create_transaction(jsonb, text, uuid, integer, integer, integer, integer, text) from public;
grant execute on function create_transaction(jsonb, text, uuid, integer, integer, integer, integer, text) to authenticated;

-- Pembayaran utang memakai row lock agar dua kasir tidak bisa mengaplikasikan
-- pembayaran berdasarkan saldo lama yang sama.
create or replace function record_payment(
  p_transaction_id uuid,
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
  tx transactions%rowtype;
  applied integer;
  new_paid integer;
begin
  if auth.uid() is null then return json_build_object('error', 'Tidak ada sesi'); end if;
  select current_store_id() into sid;
  if sid is null then return json_build_object('error', 'Toko aktif tidak ditemukan'); end if;
  if p_amount is null or p_amount <= 0 then return json_build_object('error', 'Nominal tidak valid'); end if;

  select * into tx from transactions
  where id = p_transaction_id and store_id = sid
  for update;
  if not found then return json_build_object('error', 'Transaksi tidak ditemukan'); end if;
  if tx.status <> 'utang' then return json_build_object('error', 'Transaksi sudah lunas'); end if;

  applied := least(p_amount, greatest(0, tx.total - tx.paid_amount));
  if applied <= 0 then return json_build_object('error', 'Utang sudah lunas'); end if;

  insert into payments (store_id, transaction_id, amount, method, note)
  values (sid, p_transaction_id, applied, coalesce(nullif(trim(p_method), ''), 'cash'), p_note);
  new_paid := tx.paid_amount + applied;
  update transactions
  set paid_amount = new_paid, status = case when new_paid >= total then 'lunas' else 'utang' end
  where id = p_transaction_id and store_id = sid;

  return json_build_object(
    'error', null,
    'paid_amount', new_paid,
    'status', case when new_paid >= tx.total then 'lunas' else 'utang' end
  );
end;
$$;

revoke execute on function record_payment(uuid, integer, text, text) from public;
grant execute on function record_payment(uuid, integer, text, text) to authenticated;

create or replace function open_shift(p_opening integer default 0)
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
  if sid is null then return json_build_object('error', 'Toko aktif tidak ditemukan'); end if;
  if exists (select 1 from cash_sessions where store_id = sid and closed_at is null) then
    return json_build_object('error', 'Masih ada shift yang terbuka.');
  end if;
  begin
    insert into cash_sessions (store_id, opening) values (sid, greatest(0, coalesce(p_opening, 0)));
  exception when unique_violation then
    return json_build_object('error', 'Masih ada shift yang terbuka.');
  end;
  return json_build_object('error', null);
end;
$$;

revoke execute on function open_shift(integer) from public;
grant execute on function open_shift(integer) to authenticated;

create or replace function close_shift(p_id uuid, p_closing integer, p_note text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  session cash_sessions%rowtype;
  cash_sales integer;
  expected_amount integer;
  closing_amount integer;
begin
  if auth.uid() is null then return json_build_object('error', 'Tidak ada sesi'); end if;
  select current_store_id() into sid;
  if sid is null then return json_build_object('error', 'Toko aktif tidak ditemukan'); end if;

  select * into session from cash_sessions
  where id = p_id and store_id = sid
  for update;
  if not found then return json_build_object('error', 'Shift tidak ditemukan.'); end if;
  if session.closed_at is not null then return json_build_object('error', 'Shift sudah ditutup.'); end if;

  select coalesce((
    select sum(total) from transactions
    where payment_method = 'cash' and created_at >= session.opened_at and store_id = sid
  ), 0) + coalesce((
    select sum(amount) from payments
    where method = 'cash' and created_at >= session.opened_at and store_id = sid
  ), 0)::integer into cash_sales;
  expected_amount := session.opening + cash_sales;
  closing_amount := greatest(0, coalesce(p_closing, 0));

  update cash_sessions
  set closing = closing_amount,
       expected = expected_amount,
       diff = closing_amount - expected_amount,
      note = nullif(trim(p_note), ''),
      closed_at = now()
  where id = p_id and store_id = sid;
  return json_build_object('error', null);
end;
$$;

revoke execute on function close_shift(uuid, integer, text) from public;
grant execute on function close_shift(uuid, integer, text) to authenticated;
