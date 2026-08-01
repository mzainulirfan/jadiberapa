-- Dashboard: hitung laba bersih dengan mengurangi pengeluaran periode.
-- Sekaligus pulihkan low stock agar memakai ambang per barang (min_stock), bukan angka tetap.

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
      coalesce(sum(total - cost) filter (where created_at >= p_cur_start), 0) as cur_gross_profit,
      count(*) filter (where created_at >= p_cur_start) as cur_cnt,
      coalesce(sum(items_qty) filter (where created_at >= p_cur_start), 0) as cur_items,
      coalesce(sum(total) filter (where created_at >= p_prev_start and created_at < p_cur_start), 0) as prev_rev,
      coalesce(sum(total - cost) filter (where created_at >= p_prev_start and created_at < p_cur_start), 0) as prev_gross_profit,
      count(*) filter (where created_at >= p_prev_start and created_at < p_cur_start) as prev_cnt,
      coalesce(sum(items_qty) filter (where created_at >= p_prev_start and created_at < p_cur_start), 0) as prev_items
    from tx
  ),
  expenses as (
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
    where stock <= min_stock
    order by stock asc
    limit 10
  )
  select jsonb_build_object(
    'revenue', jsonb_build_object('value', a.cur_rev, 'prev', a.prev_rev),
    'grossProfit', jsonb_build_object('value', a.cur_gross_profit, 'prev', a.prev_gross_profit),
    'expenses', jsonb_build_object('value', e.cur_expenses, 'prev', e.prev_expenses),
    'profit', jsonb_build_object(
      'value', a.cur_gross_profit - e.cur_expenses,
      'prev', a.prev_gross_profit - e.prev_expenses
    ),
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
  from agg a cross join expenses e;
$$;
