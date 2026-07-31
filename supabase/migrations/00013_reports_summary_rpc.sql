-- Agregasi laporan di sisi database (menggantikan fetch mentah + agregasi di browser).
-- Klien mengirim batas waktu periode (dihitung di zona lokal) + mode bucket tren,
-- Postgres mengembalikan satu JSON kecil siap render (tanpa mengirim transaksi mentah).
--
-- p_from   : awal periode (inklusif); null = tanpa batas bawah (periode "Semua")
-- p_to     : akhir periode (inklusif); null = tanpa batas atas
-- p_bucket : 'hour' (Hari Ini) atau 'day' (lainnya) untuk pengelompokan tren omzet
-- p_tz     : zona waktu klien agar batas hari/jam tren benar (mis. 'Asia/Jakarta')
--
-- Cost/laba memakai snapshot transaction_items.price_buy (konsisten dgn dashboard 00009),
-- bukan products.price_buy live, agar laba historis akurat.

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
    select ti.qty, ti.subtotal, coalesce(ti.price_buy, 0) as price_buy, ti.product_id
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
      sum(i.subtotal)::bigint as total
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
