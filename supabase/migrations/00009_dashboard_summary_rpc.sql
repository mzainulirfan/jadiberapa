-- Agregasi dashboard di sisi database (menggantikan fetch mentah + agregasi di browser).
-- Klien mengirim batas waktu (dihitung di zona waktu lokal) agar batas hari tetap benar,
-- lalu Postgres mengembalikan angka jadi dalam satu JSON kecil.
--
-- p_cur_start   : awal periode berjalan (inklusif)
-- p_prev_start  : awal periode pembanding (inklusif); jendela prev = [p_prev_start, p_cur_start)
-- p_trend_start : awal jendela grafik tren (inklusif)
-- p_tz          : zona waktu klien (mis. 'Asia/Jakarta') untuk pengelompokan tren per hari

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
      sum(ti.subtotal) as revenue
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
