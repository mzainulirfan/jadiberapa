-- Definisi checkout kanonik setelah hotfix 00021-00025. Semua validasi yang
-- dapat gagal dilakukan sebelum INSERT agar business error tidak menyisakan
-- transaksi parsial dan dapat diklasifikasikan oleh antrean offline.

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
  role_name text;
  existing_id uuid;
  item jsonb;
  stock_check jsonb;
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
  base_qty bigint;
  gross bigint;
  requested_discount bigint;
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
    return json_build_object('error', 'Tidak ada sesi', 'error_code', 'AUTH_REQUIRED', 'retryable', false);
  end if;
  select current_store_id(), current_user_role() into sid, role_name;
  if sid is null then
    return json_build_object('error', 'Toko aktif tidak ditemukan', 'error_code', 'STORE_NOT_FOUND', 'retryable', false);
  end if;
  if role_name is null or role_name not in ('owner', 'kasir') then
    return json_build_object('error', 'Akses ditolak', 'error_code', 'FORBIDDEN', 'retryable', false);
  end if;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    if length(btrim(p_idempotency_key)) > 128 then
      return json_build_object('error', 'Kunci transaksi tidak valid', 'error_code', 'INVALID_IDEMPOTENCY_KEY', 'retryable', false);
    end if;
    select id into existing_id from transactions
    where store_id = sid and idempotency_key = btrim(p_idempotency_key);
    if existing_id is not null then
      return json_build_object('error', null, 'id', existing_id, 'duplicate', true);
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return json_build_object('error', 'Format keranjang tidak valid', 'error_code', 'INVALID_ITEMS', 'retryable', false);
  end if;
  if jsonb_array_length(p_items) = 0 then
    return json_build_object('error', 'Keranjang minimal 1 item', 'error_code', 'EMPTY_CART', 'retryable', false);
  end if;
  if jsonb_array_length(p_items) > 500 then
    return json_build_object('error', 'Jumlah item transaksi terlalu banyak', 'error_code', 'TOO_MANY_ITEMS', 'retryable', false);
  end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'qris', 'dana', 'utang') then
    return json_build_object('error', 'Metode pembayaran tidak valid', 'error_code', 'INVALID_PAYMENT_METHOD', 'retryable', false);
  end if;

  if p_customer_id is not null then
    select points into points_balance
    from customers
    where id = p_customer_id and customers.store_id = sid
    for update;
    if not found then
      return json_build_object('error', 'Pembeli tidak ditemukan di toko ini', 'error_code', 'CUSTOMER_NOT_FOUND', 'retryable', false);
    end if;
  end if;

  select value into setting_value from settings where store_id = sid and key = 'loyalty_enabled';
  loyalty_enabled := coalesce(setting_value <> '0', true);
  select value into setting_value from settings where store_id = sid and key = 'loyalty_redeem_value';
  if setting_value ~ '^\d{1,10}$' then
    if setting_value::bigint between 1 and 2147483647 then
      redeem_value := setting_value::integer;
    end if;
  end if;
  select value into setting_value from settings where store_id = sid and key = 'loyalty_earn_per';
  if setting_value ~ '^\d{1,10}$' then
    if setting_value::bigint between 1 and 2147483647 then
      earn_per := setting_value::integer;
    end if;
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    variant_name := null;
    unit_name := null;
    begin
      pid := (item->>'product_id')::uuid;
      qty := (item->>'qty')::integer;
      requested_discount := coalesce((item->>'discount')::bigint, 0);
    exception when invalid_text_representation or numeric_value_out_of_range then
      return json_build_object('error', 'Format item transaksi tidak valid', 'error_code', 'INVALID_ITEM', 'retryable', false);
    end;
    if pid is null or qty is null then
      return json_build_object('error', 'Item transaksi tidak lengkap', 'error_code', 'INVALID_ITEM', 'retryable', false);
    end if;
    if qty <= 0 or qty > 1000000 then
      return json_build_object('error', 'Jumlah barang tidak valid', 'error_code', 'INVALID_QTY', 'retryable', false);
    end if;
    if requested_discount < 0 then
      return json_build_object('error', 'Diskon item tidak valid', 'error_code', 'INVALID_DISCOUNT', 'retryable', false);
    end if;

    select p.store_id, p.category_id, p.price_sell, p.price_buy, p.stock
      into product_store, product_category, price_sell, price_buy, stock
    from products p
    where p.id = pid and p.store_id = sid
    for update;
    if not found then
      return json_build_object('error', 'Barang tidak ditemukan di toko ini', 'error_code', 'PRODUCT_NOT_FOUND', 'retryable', false);
    end if;

    vid := null;
    if nullif(item->>'variant_id', '') is not null then
      begin
        vid := (item->>'variant_id')::uuid;
      exception when invalid_text_representation then
        return json_build_object('error', 'ID varian tidak valid', 'error_code', 'INVALID_VARIANT_ID', 'retryable', false);
      end;
      select v.store_id, v.price_sell, v.price_buy, v.name
        into variant_store, price_sell, price_buy, variant_name
      from product_variants v
      where v.id = vid and v.product_id = pid and v.store_id = sid;
      if not found or variant_store is distinct from sid then
        return json_build_object('error', 'Varian tidak ditemukan di toko ini', 'error_code', 'VARIANT_NOT_FOUND', 'retryable', false);
      end if;
    end if;

    factor := 1;
    uid := null;
    if nullif(item->>'unit_id', '') is not null then
      begin
        uid := (item->>'unit_id')::uuid;
      exception when invalid_text_representation then
        return json_build_object('error', 'ID satuan tidak valid', 'error_code', 'INVALID_UNIT_ID', 'retryable', false);
      end;
      select u.store_id, u.factor, u.name, u.price_sell
        into unit_store, factor, unit_name, price_sell
      from product_units u
      where u.id = uid and u.product_id = pid and u.store_id = sid;
      if not found or unit_store is distinct from sid then
        return json_build_object('error', 'Satuan tidak ditemukan di toko ini', 'error_code', 'UNIT_NOT_FOUND', 'retryable', false);
      end if;
    elsif nullif(btrim(item->>'unit_name'), '') is not null then
      select u.id, u.store_id, u.factor, u.name, u.price_sell
        into uid, unit_store, factor, unit_name, price_sell
      from product_units u
      where u.product_id = pid and u.store_id = sid and u.name = btrim(item->>'unit_name');
      if not found then
        return json_build_object('error', 'Satuan tidak ditemukan di toko ini', 'error_code', 'UNIT_NOT_FOUND', 'retryable', false);
      end if;
    end if;

    factor := greatest(1, coalesce(factor, 1));
    if price_sell is null or price_sell <= 0 or price_buy is null or price_buy < 0 then
      return json_build_object('error', 'Harga barang tidak valid', 'error_code', 'INVALID_PRODUCT_PRICE', 'retryable', false);
    end if;
    base_qty := qty::bigint * factor::bigint;
    if base_qty > 1000000000 then
      return json_build_object('error', 'Jumlah stok terlalu besar', 'error_code', 'BASE_QTY_TOO_LARGE', 'retryable', false);
    end if;

    select coalesce((
      select least(
        case when d.value_type = 'percent'
          then round(price_sell::numeric * d.value::numeric / 100)
          else d.value::numeric end,
        price_sell::numeric
      )
      from discounts d
      left join discount_products dp on dp.discount_id = d.id and dp.product_id = pid
      where d.store_id = sid and d.active
        and (d.type = 'global' or dp.product_id is not null)
      order by case d.type when 'product' then 0 when 'category' then 1 else 2 end,
        case when d.value_type = 'percent'
          then round(price_sell::numeric * d.value::numeric / 100)
          else d.value::numeric end desc
      limit 1
    ), 0) into line_auto_discount;

    gross := price_sell::bigint * qty::bigint;
    if gross > 2147483647 then
      return json_build_object('error', 'Subtotal item terlalu besar', 'error_code', 'LINE_TOTAL_TOO_LARGE', 'retryable', false);
    end if;
    line_auto_discount := greatest(0, least(gross, line_auto_discount * qty::bigint));
    line_manual_discount := greatest(
      0,
      least(
        gross - line_auto_discount,
        case when item->>'discount_mode' = 'manual'
          then requested_discount
          else greatest(0, requested_discount - line_auto_discount)
        end
      )
    );
    net_before_discount := net_before_discount + gross - line_auto_discount - line_manual_discount;

    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'product_id', pid, 'variant_id', vid, 'variant_name', variant_name,
      'unit_id', uid, 'unit_name', unit_name, 'factor', factor,
      'qty', qty, 'base_qty', base_qty, 'price_sell', price_sell,
      'price_buy', price_buy, 'subtotal', gross,
      'discount', line_auto_discount + line_manual_discount
    ));
  end loop;

  if net_before_discount > 2147483647 then
    return json_build_object('error', 'Total transaksi terlalu besar', 'error_code', 'TOTAL_TOO_LARGE', 'retryable', false);
  end if;

  -- Semua baris produk sudah terkunci. Periksa kebutuhan gabungan agar kegagalan
  -- stok terjadi sebelum transaksi dan item ditulis.
  for stock_check in
    select jsonb_build_object(
      'product_id', value->>'product_id',
      'required', sum((value->>'base_qty')::bigint)
    )
    from jsonb_array_elements(normalized)
    group by value->>'product_id'
  loop
    select p.stock into stock
    from products p
    where p.id = (stock_check->>'product_id')::uuid and p.store_id = sid;
    if stock::bigint < (stock_check->>'required')::bigint then
      return json_build_object('error', 'Stok barang tidak cukup', 'error_code', 'INSUFFICIENT_STOCK', 'retryable', false);
    end if;
  end loop;

  note_discount := greatest(0, least(net_before_discount, coalesce(p_discount, 0)::bigint));
  fee_amount := greatest(0, coalesce(p_fee, 0)::bigint);
  if loyalty_enabled and p_customer_id is not null and coalesce(p_points_redeemed, 0) > 0 then
    points_used := least(
      greatest(0, p_points_redeemed), points_balance,
      floor(greatest(0, net_before_discount - note_discount) / redeem_value)::integer
    );
  end if;

  total := greatest(
    0,
    net_before_discount - note_discount - points_used::bigint * redeem_value::bigint + fee_amount
  );
  if total > 2147483647 then
    return json_build_object('error', 'Total transaksi terlalu besar', 'error_code', 'TOTAL_TOO_LARGE', 'retryable', false);
  end if;
  earned := least(1000, floor(total / earn_per)::integer);
  if loyalty_enabled and p_customer_id is not null and (
    points_balance < 0
    or points_balance::bigint - points_used::bigint + earned::bigint > 2147483647
  ) then
    return json_build_object('error', 'Saldo poin tidak valid', 'error_code', 'LOYALTY_BALANCE_OVERFLOW', 'retryable', false);
  end if;
  paid := case when p_payment_method = 'utang'
    then least(total, greatest(0, coalesce(p_paid_amount, 0)))::integer
    else total::integer end;
  tx_number := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  begin
    insert into transactions (
      store_id, total, payment_method, customer_id, discount, fee, paid_amount,
      status, number, user_id, cashier_name, idempotency_key
    ) values (
      sid, total::integer, p_payment_method, p_customer_id, note_discount::integer,
      fee_amount::integer, paid,
      case when paid >= total then 'lunas' else 'utang' end,
      tx_number, auth.uid(),
      split_part(coalesce((select email from auth.users where id = auth.uid()), ''), '@', 1),
      nullif(btrim(p_idempotency_key), '')
    ) returning id into transaction_id;
  exception when unique_violation then
    if nullif(btrim(p_idempotency_key), '') is not null then
      select id into existing_id from transactions
      where store_id = sid and idempotency_key = btrim(p_idempotency_key);
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
    where product.id = (item->>'product_id')::uuid and product.store_id = sid;

    insert into stock_movements (store_id, product_id, type, qty, note)
    values (sid, (item->>'product_id')::uuid, 'out', -(item->>'base_qty')::integer, 'Penjualan');
  end loop;

  if p_payment_method = 'utang' and paid > 0 then
    insert into payments (store_id, transaction_id, amount, method, note)
    values (sid, transaction_id, paid, 'cash', 'DP');
  end if;

  if points_used > 0 then
    select redeem_loyalty_points(p_customer_id, points_used, transaction_id) into loyalty_result;
    if coalesce(loyalty_result->>'error', '') <> '' then raise exception '%', loyalty_result->>'error'; end if;
  end if;
  if loyalty_enabled and p_customer_id is not null and earned > 0 then
    select award_loyalty_points(p_customer_id, earned, transaction_id) into loyalty_result;
    if coalesce(loyalty_result->>'error', '') <> '' then raise exception '%', loyalty_result->>'error'; end if;
  end if;

  return json_build_object('error', null, 'id', transaction_id, 'duplicate', false);
end;
$$;

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
  role_name text;
  tx transactions%rowtype;
  applied integer;
  new_paid integer;
begin
  if auth.uid() is null then return json_build_object('error', 'Tidak ada sesi'); end if;
  select current_store_id(), current_user_role() into sid, role_name;
  if sid is null or role_name is null or role_name not in ('owner', 'kasir') then
    return json_build_object('error', 'Akses ditolak');
  end if;
  if p_amount is null or p_amount <= 0 then return json_build_object('error', 'Nominal tidak valid'); end if;

  select * into tx from transactions
  where id = p_transaction_id and store_id = sid
  for update;
  if not found then return json_build_object('error', 'Transaksi tidak ditemukan'); end if;
  if tx.status <> 'utang' then return json_build_object('error', 'Transaksi sudah lunas'); end if;
  applied := least(p_amount, greatest(0, tx.total - tx.paid_amount));
  if applied <= 0 then return json_build_object('error', 'Utang sudah lunas'); end if;

  insert into payments (store_id, transaction_id, amount, method, note)
  values (sid, p_transaction_id, applied, coalesce(nullif(btrim(p_method), ''), 'cash'), nullif(btrim(p_note), ''));
  new_paid := tx.paid_amount + applied;
  update transactions
  set paid_amount = new_paid, status = case when new_paid >= total then 'lunas' else 'utang' end
  where id = p_transaction_id and store_id = sid;
  return json_build_object(
    'error', null, 'paid_amount', new_paid,
    'status', case when new_paid >= tx.total then 'lunas' else 'utang' end
  );
end;
$$;

revoke execute on function create_transaction(jsonb, text, uuid, integer, integer, integer, integer, text) from public, anon;
revoke execute on function record_payment(uuid, integer, text, text) from public, anon;
grant execute on function create_transaction(jsonb, text, uuid, integer, integer, integer, integer, text) to authenticated;
grant execute on function record_payment(uuid, integer, text, text) to authenticated;
