-- Pertahankan item historis saat produk dihapus dan hitung modal berdasarkan
-- satuan dasar: qty jual * factor * price_buy per satuan dasar.

alter table transaction_items add column if not exists product_name text;
alter table purchase_items add column if not exists product_name text;

do $$
begin
  if exists (
    select 1
    from transaction_items ti
    join transactions t on t.id = ti.transaction_id
    join products p on p.id = ti.product_id
    where t.store_id is distinct from ti.store_id
       or p.store_id is distinct from ti.store_id
  ) then
    raise exception 'Migration dibatalkan: ada item transaksi dengan relasi lintas toko';
  end if;

  if exists (
    select 1
    from purchase_items pi
    join purchases pu on pu.id = pi.purchase_id
    join products p on p.id = pi.product_id
    where pu.store_id is distinct from pi.store_id
       or p.store_id is distinct from pi.store_id
  ) then
    raise exception 'Migration dibatalkan: ada item pembelian dengan relasi lintas toko';
  end if;
end;
$$;

update transaction_items ti
set product_name = p.name
from products p
where p.id = ti.product_id
  and p.store_id = ti.store_id
  and ti.product_name is null;

update purchase_items pi
set product_name = p.name
from products p
where p.id = pi.product_id
  and p.store_id = pi.store_id
  and pi.product_name is null;

alter table transaction_items alter column product_name set not null;
alter table purchase_items alter column product_name set not null;
alter table transaction_items alter column product_id drop not null;
alter table purchase_items alter column product_id drop not null;

alter table transaction_items drop constraint if exists transaction_items_product_id_fkey;
alter table purchase_items drop constraint if exists purchase_items_product_id_fkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transaction_items'::regclass
      and conname = 'transaction_items_product_id_fkey'
  ) then
    alter table transaction_items
      add constraint transaction_items_product_id_fkey
      foreign key (product_id) references products(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.purchase_items'::regclass
      and conname = 'purchase_items_product_id_fkey'
  ) then
    alter table purchase_items
      add constraint purchase_items_product_id_fkey
      foreign key (product_id) references products(id) on delete set null;
  end if;
end;
$$;

create or replace function snapshot_history_product_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_name text;
begin
  if new.product_name is null and new.product_id is not null then
    select name into resolved_name
    from products
    where id = new.product_id and store_id = new.store_id;

    if resolved_name is null then
      raise exception 'Barang bukan bagian dari toko aktif';
    end if;
    new.product_name := resolved_name;
  end if;

  if new.product_name is null or btrim(new.product_name) = '' then
    raise exception 'Nama barang historis wajib diisi';
  end if;
  return new;
end;
$$;

drop trigger if exists snapshot_transaction_item_product_name on transaction_items;
create trigger snapshot_transaction_item_product_name
  before insert or update of product_id, product_name on transaction_items
  for each row execute function snapshot_history_product_name();

drop trigger if exists snapshot_purchase_item_product_name on purchase_items;
create trigger snapshot_purchase_item_product_name
  before insert or update of product_id, product_name on purchase_items
  for each row execute function snapshot_history_product_name();

comment on column transaction_items.product_name is
  'Snapshot nama produk saat transaksi; tetap ada setelah produk dihapus.';
comment on column purchase_items.product_name is
  'Snapshot nama produk saat pembelian; tetap ada setelah produk dihapus.';
comment on column transaction_items.price_buy is
  'Snapshot modal per satuan dasar. COGS = qty * factor * price_buy.';
comment on column transaction_items.factor is
  'Jumlah satuan dasar per satuan jual pada saat transaksi.';

-- FK SET NULL memicu UPDATE pada item historis. Validasi relasi produk harus
-- dilewati ketika product_id sudah null, sedangkan parent tetap divalidasi.
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
    if new.product_id is not null then
      select store_id into related_store from products where id = new.product_id;
      if related_store is distinct from new.store_id then
        raise exception 'Barang bukan bagian dari toko aktif';
      end if;
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
    if new.product_id is not null then
      select store_id into related_store from products where id = new.product_id;
      if related_store is distinct from new.store_id then
        raise exception 'Barang pembelian bukan bagian dari toko aktif';
      end if;
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

create or replace function get_dashboard_summary(
  p_cur_start timestamptz,
  p_prev_start timestamptz,
  p_trend_start timestamptz,
  p_tz text default 'Asia/Jakarta'
)
returns jsonb
language sql
stable
as $$
  with tx as (
    select
      t.id,
      t.total,
      t.created_at,
      coalesce(sum(ti.qty::numeric * greatest(coalesce(ti.factor, 1), 1)::numeric), 0) as items_qty,
      coalesce(sum(
        ti.qty::numeric
        * greatest(coalesce(ti.factor, 1), 1)::numeric
        * coalesce(ti.price_buy, 0)::numeric
      ), 0) as cost
    from transactions t
    left join transaction_items ti on ti.transaction_id = t.id
    where t.created_at >= least(p_prev_start, p_trend_start)
    group by t.id, t.total, t.created_at
  ),
  agg as (
    select
      coalesce(sum(total) filter (where created_at >= p_cur_start), 0) as cur_rev,
      coalesce(sum(total - cost) filter (where created_at >= p_cur_start), 0) as cur_gross_profit,
      count(*) filter (where created_at >= p_cur_start) as cur_cnt,
      coalesce(sum(items_qty) filter (where created_at >= p_cur_start), 0) as cur_items,
      coalesce(sum(total) filter (where created_at >= p_prev_start and created_at < p_cur_start), 0) as prev_rev,
      coalesce(sum(total - cost) filter (where created_at >= p_prev_start and created_at < p_cur_start), 0) as prev_gross_profit,
      count(*) filter (where created_at >= p_prev_start and created_at < p_cur_start) as prev_cnt,
      coalesce(sum(items_qty) filter (where created_at >= p_prev_start and created_at < p_cur_start), 0) as prev_items
    from tx
  ),
  expense_totals as (
    select
      coalesce(sum(amount) filter (where created_at >= p_cur_start), 0) as cur_expenses,
      coalesce(sum(amount) filter (where created_at >= p_prev_start and created_at < p_cur_start), 0) as prev_expenses
    from expenses
    where created_at >= p_prev_start
  ),
  trend as (
    select (created_at at time zone p_tz)::date as day, sum(total) as total
    from tx
    where created_at >= p_trend_start
    group by 1
  ),
  top as (
    select
      ti.product_name as name,
      sum(ti.qty::numeric * greatest(coalesce(ti.factor, 1), 1)::numeric) as qty,
      sum(ti.subtotal) - sum(coalesce(ti.discount, 0)) as revenue
    from transaction_items ti
    where ti.created_at >= p_cur_start
    group by ti.product_name
    order by qty desc
    limit 5
  ),
  recent as (
    select t.id, t.number, t.total, t.payment_method, t.created_at, c.name as cust_name
    from transactions t
    left join customers c on c.id = t.customer_id
    order by t.created_at desc
    limit 5
  ),
  low as (
    select id, name, stock
    from products
    where stock <= min_stock
    order by stock asc
    limit 10
  )
  select jsonb_build_object(
    'revenue', jsonb_build_object('value', a.cur_rev, 'prev', a.prev_rev),
    'grossProfit', jsonb_build_object('value', a.cur_gross_profit, 'prev', a.prev_gross_profit),
    'expenses', jsonb_build_object('value', e.cur_expenses, 'prev', e.prev_expenses),
    'profit', jsonb_build_object('value', a.cur_gross_profit - e.cur_expenses, 'prev', a.prev_gross_profit - e.prev_expenses),
    'count', jsonb_build_object('value', a.cur_cnt, 'prev', a.prev_cnt),
    'items', jsonb_build_object('value', a.cur_items, 'prev', a.prev_items),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('day', to_char(day, 'YYYY-MM-DD'), 'total', total) order by day) from trend), '[]'::jsonb),
    'topProducts', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'revenue', revenue) order by qty desc) from top), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'number', number, 'total', total, 'payment_method', payment_method, 'created_at', created_at, 'customers', case when cust_name is null then null else jsonb_build_object('name', cust_name) end) order by created_at desc) from recent), '[]'::jsonb),
    'lowStock', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'stock', stock) order by stock asc) from low), '[]'::jsonb)
  )
  from agg a cross join expense_totals e;
$$;

create or replace function get_reports_summary(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_bucket text default 'day',
  p_tz text default 'Asia/Jakarta'
)
returns jsonb
language sql
stable
as $$
  with tx as (
    select t.id, t.total, t.created_at, coalesce(t.payment_method, 'cash') as payment_method
    from transactions t
    where (p_from is null or t.created_at >= p_from)
      and (p_to is null or t.created_at <= p_to)
  ),
  items as (
    select
      ti.qty,
      greatest(coalesce(ti.factor, 1), 1) as factor,
      ti.subtotal,
      coalesce(ti.discount, 0) as discount,
      coalesce(ti.price_buy, 0) as price_buy,
      ti.product_name
    from transaction_items ti
    where (p_from is null or ti.created_at >= p_from)
      and (p_to is null or ti.created_at <= p_to)
  ),
  summary as (
    select coalesce(sum(total), 0)::bigint as total_revenue, count(*)::int as cnt
    from tx
  ),
  item_agg as (
    select
      coalesce(sum(qty::numeric * factor::numeric), 0) as total_items,
      coalesce(sum(qty::numeric * factor::numeric * price_buy::numeric), 0) as total_cost
    from items
  ),
  expense_agg as (
    select coalesce(sum(amount), 0)::bigint as total_expenses
    from expenses e
    where (p_from is null or e.created_at >= p_from)
      and (p_to is null or e.created_at <= p_to)
  ),
  payment as (
    select payment_method as key, sum(total)::bigint as value
    from tx
    group by payment_method
  ),
  top_products as (
    select
      i.product_name as name,
      sum(i.qty::numeric * i.factor::numeric) as qty,
      (sum(i.subtotal) - sum(i.discount))::bigint as total
    from items i
    group by i.product_name
    order by qty desc
    limit 8
  ),
  trend_raw as (
    select
      case when p_bucket = 'hour'
        then to_char((tx.created_at at time zone p_tz), 'HH24')
        else to_char((tx.created_at at time zone p_tz)::date, 'YYYY-MM-DD')
      end as t,
      sum(tx.total)::bigint as value
    from tx
    group by 1
  ),
  trend as (
    select t, value from trend_raw order by t desc limit 14
  )
  select jsonb_build_object(
    'totalRevenue', (select total_revenue from summary),
    'count', (select cnt from summary),
    'totalItems', (select total_items from item_agg),
    'totalCost', (select total_cost from item_agg),
    'totalExpenses', (select total_expenses from expense_agg),
    'payment', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'value', value) order by value desc) from payment), '[]'::jsonb),
    'topProducts', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'total', total) order by qty desc) from top_products), '[]'::jsonb),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('t', t, 'value', value) order by t asc) from trend), '[]'::jsonb)
  );
$$;

create or replace function get_analytics_summary(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_tz text default 'Asia/Jakarta',
  p_restock_days int default 14,
  p_dead_days int default 30
)
returns jsonb
language sql
stable
as $$
  with items as (
    select
      ti.product_id,
      ti.product_name,
      ti.qty::numeric * greatest(coalesce(ti.factor, 1), 1)::numeric as base_qty,
      coalesce(ti.subtotal, 0)::numeric - coalesce(ti.discount, 0)::numeric as revenue,
      ti.qty::numeric * greatest(coalesce(ti.factor, 1), 1)::numeric
        * coalesce(ti.price_buy, 0)::numeric as cost
    from transaction_items ti
    where (p_from is null or ti.created_at >= p_from)
      and (p_to is null or ti.created_at <= p_to)
  ),
  margins as (
    select
      i.product_id as id,
      i.product_name as name,
      p.stock,
      sum(i.base_qty) as qty,
      sum(i.revenue) as revenue,
      sum(i.cost) as cost
    from items i
    left join products p on p.id = i.product_id
    group by i.product_id, i.product_name, p.stock
  ),
  busy_hours as (
    select to_char((t.created_at at time zone p_tz), 'HH24')::int as hour, sum(t.total)::bigint as value
    from transactions t
    where (p_from is null or t.created_at >= p_from)
      and (p_to is null or t.created_at <= p_to)
    group by 1
  ),
  busy_days as (
    select extract(isodow from (t.created_at at time zone p_tz))::int as day, sum(t.total)::bigint as value
    from transactions t
    where (p_from is null or t.created_at >= p_from)
      and (p_to is null or t.created_at <= p_to)
    group by 1
  ),
  sales_stats as (
    select
      product_id,
      sum(qty::numeric * greatest(coalesce(factor, 1), 1)::numeric)
        filter (where created_at >= now() - (greatest(p_restock_days, 1) || ' days')::interval) as sold_qty,
      max(created_at) as last_sold
    from transaction_items
    where product_id is not null
    group by product_id
  ),
  restock as (
    select
      p.id,
      p.name,
      p.stock,
      p.min_stock,
      coalesce(s.sold_qty, 0) as sold,
      case when coalesce(s.sold_qty, 0) > 0
        then floor(p.stock / (s.sold_qty::numeric / greatest(p_restock_days, 1)))
        else null end as days_left
    from products p
    left join sales_stats s on s.product_id = p.id
    where p.stock <= greatest(
      p.min_stock,
      ceil(coalesce(s.sold_qty, 0)::numeric / greatest(p_restock_days, 1) * 7)
    )
    order by days_left asc nulls last, sold desc
    limit 10
  ),
  dead_stock as (
    select
      p.id,
      p.name,
      p.stock,
      s.last_sold,
      case when s.last_sold is null then null
        else floor(extract(epoch from (now() - s.last_sold)) / 86400)::int end as days_idle
    from products p
    left join sales_stats s on s.product_id = p.id
    where p.stock > 0
      and (s.last_sold is null or s.last_sold < now() - (greatest(p_dead_days, 1) || ' days')::interval)
    order by days_idle desc nulls first
    limit 10
  )
  select jsonb_build_object(
    'margins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'stock', stock, 'qty', qty,
        'revenue', revenue, 'cost', cost, 'profit', revenue - cost,
        'marginPct', case when revenue > 0 then round((revenue - cost)::numeric / revenue * 100, 1) else 0 end
      ) order by (revenue - cost) desc)
      from margins
    ), '[]'::jsonb),
    'busyHours', coalesce((select jsonb_agg(jsonb_build_object('hour', hour, 'value', value) order by hour) from busy_hours), '[]'::jsonb),
    'busyDays', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'value', value) order by day) from busy_days), '[]'::jsonb),
    'restock', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'stock', stock, 'minStock', min_stock,
        'sold', sold, 'daysLeft', days_left
      )) from restock
    ), '[]'::jsonb),
    'deadStock', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'stock', stock,
        'lastSold', last_sold, 'daysIdle', days_idle
      )) from dead_stock
    ), '[]'::jsonb)
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
        'name', coalesce((select value from settings where key = 'store_name' and store_id = t.store_id), ''),
        'address', coalesce((select value from settings where key = 'store_address' and store_id = t.store_id), ''),
        'phone', coalesce((select value from settings where key = 'store_phone' and store_id = t.store_id), '')
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
        'name', ti.product_name,
        'variant_name', coalesce(ti.variant_name, ''),
        'unit_name', coalesce(ti.unit_name, ''),
        'factor', greatest(coalesce(ti.factor, 1), 1),
        'qty', ti.qty,
        'price_sell', ti.price_sell,
        'subtotal', ti.subtotal,
        'discount', coalesce(ti.discount, 0)
      )), '[]'::json)
      from transaction_items ti
      where ti.transaction_id = t.id
    ),
    'payments', (
      select coalesce(json_agg(json_build_object(
        'amount', pm.amount, 'method', pm.method, 'created_at', pm.created_at
      )), '[]'::json)
      from payments pm
      where pm.transaction_id = t.id
    )
  )
  from transactions t
  where t.share_token = p_token;
$$;

-- Ganti loop restore lama yang terbaca sebagai satu nama tabel array oleh
-- plpgsql_check. Normalisasi factor juga dilakukan di DB untuk pemanggil lama.
create or replace function restore_store_backup(p_bundle jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  table_name text;
  table_index integer;
  row jsonb;
  rows jsonb;
  delete_tables text[] := array[
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

  for table_index in 1..array_length(delete_tables, 1)
  loop
    table_name := delete_tables[table_index];
    execute format('delete from %I where store_id = $1', table_name) using sid;
  end loop;

  for table_index in 1..array_length(insert_tables, 1)
  loop
    table_name := insert_tables[table_index];
    rows := '[]'::jsonb;
    for row in
      select value from jsonb_array_elements(coalesce(p_bundle->table_name, '[]'::jsonb))
    loop
      row := jsonb_set(row, '{store_id}', to_jsonb(sid), true);
      if table_name = 'products' then row := row - 'is_low_stock'; end if;
      if table_name = 'transaction_items' and not (row ? 'factor') then
        row := jsonb_set(row, '{factor}', '1'::jsonb, true);
      end if;
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

revoke execute on function get_dashboard_summary(timestamptz, timestamptz, timestamptz, text) from public, anon;
revoke execute on function get_reports_summary(timestamptz, timestamptz, text, text) from public, anon;
revoke execute on function get_analytics_summary(timestamptz, timestamptz, text, int, int) from public, anon;
revoke execute on function restore_store_backup(jsonb) from public, anon;
revoke execute on function award_loyalty_points(uuid, int, uuid) from public, anon, authenticated;
revoke execute on function redeem_loyalty_points(uuid, int, uuid) from public, anon, authenticated;
grant execute on function get_dashboard_summary(timestamptz, timestamptz, timestamptz, text) to authenticated;
grant execute on function get_reports_summary(timestamptz, timestamptz, text, text) to authenticated;
grant execute on function get_analytics_summary(timestamptz, timestamptz, text, int, int) to authenticated;
grant execute on function get_public_receipt(uuid) to anon, authenticated, service_role;
grant execute on function restore_store_backup(jsonb) to authenticated;
