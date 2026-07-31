-- Fase 3: Pengeluaran & Laba Bersih
-- Catatan biaya operasional (belanja stok, listrik, sewa, gaji, dll) agar laba
-- bersih = laba kotor (omzet - HPP) - pengeluaran bisa dihitung.

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  amount integer not null check (amount > 0),
  category text not null default 'lainnya',
  note text,
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'expenses' and policyname = 'expenses_all'
  ) then
    create policy "expenses_all" on expenses
      for all to authenticated using (true) with check (true);
  end if;
end $$;

create index if not exists expenses_created_at_idx on expenses (created_at desc);

-- Laporan kini menyertakan total pengeluaran periode agar laba bersih bisa
-- dihitung di klien (netProfit = laba kotor - totalExpenses).
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
    'totalExpenses', (select total_expenses from expense_agg),
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
