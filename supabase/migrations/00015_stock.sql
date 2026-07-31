-- Fase 2: Manajemen Stok (stok masuk, opname, ambang menipis, jejak audit)

-- Ambang stok menipis per barang + kolom turunan agar bisa difilter di PostgREST
-- (perbandingan antar-kolom stock <= min_stock tidak didukung filter biasa).
alter table products
  add column if not exists min_stock integer not null default 5;

alter table products
  add column if not exists is_low_stock boolean
  generated always as (stock <= min_stock) stored;

-- Jejak audit pergerakan stok: in (masuk/restock), out (terjual), adjust (opname).
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  type text not null check (type in ('in', 'out', 'adjust')),
  qty integer not null,
  note text,
  created_at timestamptz not null default now()
);

alter table stock_movements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'stock_movements' and policyname = 'stock_movements_all'
  ) then
    create policy "stock_movements_all" on stock_movements
      for all to authenticated using (true) with check (true);
  end if;
end $$;

create index if not exists stock_movements_product_idx
  on stock_movements (product_id, created_at desc);

-- Tambah stok secara atomik (kebalikan decrement_stock).
create or replace function increment_stock(pid uuid, qty int)
returns void as $$
begin
  update products set stock = stock + qty, updated_at = now() where id = pid;
end;
$$ language plpgsql security definer;

-- Ringkasan inventaris kini memakai ambang per-barang (min_stock), bukan angka 5 tetap.
create or replace function get_inventory_summary()
returns table (count bigint, stock_value bigint, low_stock bigint)
language sql
stable
as $$
  select
    count(*)::bigint,
    coalesce(sum(price_buy::bigint * stock::bigint), 0)::bigint,
    count(*) filter (where stock <= min_stock)::bigint
  from products;
$$;

-- Kartu "stok menipis" dashboard juga ikut ambang per-barang (semula tetap <= 3).
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
    where stock <= min_stock
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
