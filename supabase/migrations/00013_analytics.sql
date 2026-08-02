-- Fase B: Analitik lanjutan & saran restock.
-- Tanpa tabel baru; satu RPC agregasi (pola get_reports_summary, 00001):
-- bukan security definer -> pemfilteran toko otomatis via RLS store_all_*.
-- Semua agregasi dibatasi 10 item per daftar; uang integer rupiah.

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
      ti.qty,
      coalesce(ti.subtotal, 0) - coalesce(ti.discount, 0) as revenue,
      coalesce(ti.qty, 0) * coalesce(ti.price_buy, 0) as cost
    from transaction_items ti
    where (p_from is null or ti.created_at >= p_from)
      and (p_to is null or ti.created_at <= p_to)
  ),
  margins as (
    select
      p.id,
      p.name,
      p.stock,
      sum(i.qty)::bigint as qty,
      sum(i.revenue)::bigint as revenue,
      sum(i.cost)::bigint as cost
    from items i
    join products p on p.id = i.product_id
    group by p.id, p.name, p.stock
  ),
  busy_hours as (
    select
      to_char((t.created_at at time zone p_tz), 'HH24')::int as hour,
      sum(t.total)::bigint as value
    from transactions t
    where (p_from is null or t.created_at >= p_from)
      and (p_to is null or t.created_at <= p_to)
    group by 1
  ),
  busy_days as (
    select
      extract(isodow from (t.created_at at time zone p_tz))::int as day,
      sum(t.total)::bigint as value
    from transactions t
    where (p_from is null or t.created_at >= p_from)
      and (p_to is null or t.created_at <= p_to)
    group by 1
  ),
  sales_recent as (
    select
      product_id,
      sum(qty) as sold_qty,
      max(created_at) as last_sold
    from transaction_items
    where created_at >= now() - (p_restock_days || ' days')::interval
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
        then floor(p.stock / (s.sold_qty::numeric / p_restock_days))
        else null end as days_left
    from products p
    left join sales_recent s on s.product_id = p.id
    where p.stock <= greatest(
      p.min_stock,
      ceil(coalesce(s.sold_qty, 0)::numeric / p_restock_days * 7)
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
    left join sales_recent s on s.product_id = p.id
    where p.stock > 0
      and (s.last_sold is null or s.last_sold < now() - (p_dead_days || ' days')::interval)
    order by days_idle desc nulls first
    limit 10
  )
  select jsonb_build_object(
    'margins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'stock', stock,
        'qty', qty,
        'revenue', revenue,
        'cost', cost,
        'profit', revenue - cost,
        'marginPct', case when revenue > 0 then round((revenue - cost)::numeric / revenue * 100, 1) else 0 end
      ) order by (revenue - cost) desc)
      from margins
    ), '[]'::jsonb),
    'busyHours', coalesce((
      select jsonb_agg(jsonb_build_object('hour', hour, 'value', value) order by hour)
      from busy_hours
    ), '[]'::jsonb),
    'busyDays', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'value', value) order by day)
      from busy_days
    ), '[]'::jsonb),
    'restock', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'stock', stock,
        'minStock', min_stock,
        'sold', sold,
        'daysLeft', days_left
      ))
      from restock
    ), '[]'::jsonb),
    'deadStock', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'stock', stock,
        'lastSold', last_sold,
        'daysIdle', days_idle
      ))
      from dead_stock
    ), '[]'::jsonb)
  );
$$;

grant execute on function get_analytics_summary(timestamptz, timestamptz, text, int, int) to authenticated;
