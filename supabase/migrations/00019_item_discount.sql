-- Fase 4 (lanjutan): Diskon per item
-- Potongan nominal per baris item (Rp). `subtotal` tetap GROSS (harga × qty);
-- nilai NETO baris = subtotal − discount. `transactions.discount` tetap diskon
-- per nota, dan `transactions.total` tetap NETO total (gross − item − nota),
-- sehingga omzet/laba dashboard & laporan tetap akurat.

alter table transaction_items
  add column if not exists discount integer not null default 0;

-- Dashboard: "produk terlaris" memakai neto (kurangi diskon item).
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
      coalesce(sum(ti.qty), 0) as items_qty,
      coalesce(sum(ti.qty * ti.price_buy), 0) as cost
    from transactions t
    left join transaction_items ti on ti.transaction_id = t.id
    where t.created_at >= least(p_prev_start, p_trend_start)
    group by t.id, t.total, t.created_at
  ),
  agg as (
    select
      coalesce(sum(total) filter (where created_at >= p_cur_start), 0) as cur_rev,
      coalesce(sum(total - cost) filter (where created_at >= p_cur_start), 0) as cur_profit,
      count(*) filter (where created_at >= p_cur_start) as cur_cnt,
      coalesce(sum(items_qty) filter (where created_at >= p_cur_start), 0) as cur_items,
      coalesce(sum(total) filter (where created_at >= p_prev_start and created_at < p_cur_start), 0) as prev_rev,
      coalesce(sum(total - cost) filter (where created_at >= p_prev_start and created_at < p_cur_start), 0) as prev_profit,
      count(*) filter (where created_at >= p_prev_start and created_at < p_cur_start) as prev_cnt,
      coalesce(sum(items_qty) filter (where created_at >= p_prev_start and created_at < p_cur_start), 0) as prev_items
    from tx
  ),
  trend as (
    select (created_at at time zone p_tz)::date as day, sum(total) as total
    from tx
    where created_at >= p_trend_start
    group by 1
  ),
  top as (
    select
      coalesce(p.name, 'Produk dihapus') as name,
      sum(ti.qty) as qty,
      sum(ti.subtotal) - sum(coalesce(ti.discount, 0)) as revenue
    from transaction_items ti
    left join products p on p.id = ti.product_id
    where ti.created_at >= p_cur_start
    group by coalesce(p.name, 'Produk dihapus')
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
    where stock <= 3
    order by stock asc
    limit 10
  )
  select jsonb_build_object(
    'revenue', jsonb_build_object('value', a.cur_rev, 'prev', a.prev_rev),
    'profit', jsonb_build_object('value', a.cur_profit, 'prev', a.prev_profit),
    'count', jsonb_build_object('value', a.cur_cnt, 'prev', a.prev_cnt),
    'items', jsonb_build_object('value', a.cur_items, 'prev', a.prev_items),
    'trend', coalesce(
      (select jsonb_agg(jsonb_build_object('day', to_char(day, 'YYYY-MM-DD'), 'total', total) order by day) from trend),
      '[]'::jsonb
    ),
    'topProducts', coalesce(
      (select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'revenue', revenue) order by qty desc) from top),
      '[]'::jsonb
    ),
    'recent', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'number', number,
          'total', total,
          'payment_method', payment_method,
          'created_at', created_at,
          'customers', case when cust_name is null then null else jsonb_build_object('name', cust_name) end
        ) order by created_at desc
      ) from recent),
      '[]'::jsonb
    ),
    'lowStock', coalesce(
      (select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'stock', stock) order by stock asc) from low),
      '[]'::jsonb
    )
  )
  from agg a;
$$;

-- Laporan: "produk terlaris" memakai neto (kurangi diskon item).
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
    select ti.qty, ti.subtotal, coalesce(ti.discount, 0) as discount, coalesce(ti.price_buy, 0) as price_buy, ti.product_id
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
      coalesce(sum(qty), 0)::bigint as total_items,
      coalesce(sum(qty * price_buy), 0)::bigint as total_cost
    from items
  ),
  payment as (
    select payment_method as key, sum(total)::bigint as value
    from tx
    group by payment_method
  ),
  top_products as (
    select
      coalesce(p.name, 'Produk dihapus') as name,
      sum(i.qty)::bigint as qty,
      (sum(i.subtotal) - sum(i.discount))::bigint as total
    from items i
    left join products p on p.id = i.product_id
    group by coalesce(p.name, 'Produk dihapus')
    order by qty desc
    limit 8
  ),
  trend_raw as (
    select
      case
        when p_bucket = 'hour' then to_char((tx.created_at at time zone p_tz), 'HH24')
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
    'payment', coalesce(
      (select jsonb_agg(jsonb_build_object('key', key, 'value', value) order by value desc) from payment),
      '[]'::jsonb
    ),
    'topProducts', coalesce(
      (select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'total', total) order by qty desc) from top_products),
      '[]'::jsonb
    ),
    'trend', coalesce(
      (select jsonb_agg(jsonb_build_object('t', t, 'value', value) order by t asc) from trend),
      '[]'::jsonb
    )
  );
$$;
