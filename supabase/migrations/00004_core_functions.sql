-- Fase skema inti (bagian 4/4): fungsi utilitas, trigger barcode, dan RPC
-- pelaporan/pencarian.

-- Utility functions
create or replace function decrement_stock(pid uuid, qty int)
returns void as $$
begin
  update products set stock = greatest(0, stock - qty), updated_at = now() where id = pid;
end;
$$ language plpgsql security definer;

create or replace function increment_stock(pid uuid, qty int)
returns void as $$
begin
  update products set stock = stock + qty, updated_at = now() where id = pid;
end;
$$ language plpgsql security definer;

create or replace function ean13_check_digit(base12 text)
returns text as $$
declare
  s int := 0;
  i int;
  d int;
begin
  for i in 1..12 loop
    d := substr(base12, i, 1)::int;
    if i % 2 = 1 then
      s := s + d;
    else
      s := s + d * 3;
    end if;
  end loop;
  return ((10 - (s % 10)) % 10)::text;
end;
$$ language plpgsql immutable;

create or replace function gen_ean13_internal()
returns text as $$
declare
  base12 text;
  code text;
begin
  loop
    base12 := '200' || lpad((floor(random() * 1000000000))::bigint::text, 9, '0');
    code := base12 || ean13_check_digit(base12);
    exit when not exists (select 1 from products where barcode = code);
  end loop;
  return code;
end;
$$ language plpgsql volatile;

create or replace function set_product_barcode()
returns trigger as $$
begin
  if new.barcode is null or new.barcode = '' then
    new.barcode := gen_ean13_internal();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_product_barcode on products;
create trigger trg_set_product_barcode
  before insert or update on products
  for each row execute function set_product_barcode();

-- Reporting and search RPCs
create or replace function get_transactions_summary(
  p_search text default null,
  p_date_from timestamptz default null
)
returns table (count bigint, total bigint)
language sql
stable
as $$
  select count(*)::bigint, coalesce(sum(t.total), 0)::bigint
  from transactions t
  left join customers c on c.id = t.customer_id
  where (p_date_from is null or t.created_at >= p_date_from)
    and (
      p_search is null
      or t.number ilike '%' || p_search || '%'
      or c.name ilike '%' || p_search || '%'
    );
$$;

create or replace function search_transactions(
  p_search text default null,
  p_date_from timestamptz default null,
  p_limit int default 21,
  p_offset int default 0
)
returns table (
  id uuid,
  number text,
  total integer,
  payment_method text,
  customer_id uuid,
  created_at timestamptz,
  item_count int,
  customer_name text
)
language sql
stable
as $$
  select
    t.id,
    t.number,
    t.total,
    t.payment_method,
    t.customer_id,
    t.created_at,
    coalesce((select count(*)::int from transaction_items ti where ti.transaction_id = t.id), 0) as item_count,
    c.name as customer_name
  from transactions t
  left join customers c on c.id = t.customer_id
  where (p_date_from is null or t.created_at >= p_date_from)
    and (
      p_search is null
      or t.number ilike '%' || p_search || '%'
      or c.name ilike '%' || p_search || '%'
    )
  order by t.created_at desc
  limit p_limit offset p_offset;
$$;

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
    'profit', jsonb_build_object('value', a.cur_gross_profit - e.cur_expenses, 'prev', a.prev_gross_profit - e.prev_expenses),
    'count', jsonb_build_object('value', a.cur_cnt, 'prev', a.prev_cnt),
    'items', jsonb_build_object('value', a.cur_items, 'prev', a.prev_items),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('day', to_char(day, 'YYYY-MM-DD'), 'total', total) order by day) from trend), '[]'::jsonb),
    'topProducts', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'revenue', revenue) order by qty desc) from top), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'number', number, 'total', total, 'payment_method', payment_method, 'created_at', created_at, 'customers', case when cust_name is null then null else jsonb_build_object('name', cust_name) end) order by created_at desc) from recent), '[]'::jsonb),
    'lowStock', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'stock', stock) order by stock asc) from low), '[]'::jsonb)
  )
  from agg a cross join expenses e;
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
      (sum(i.subtotal) - sum(i.discount))::bigint as total
    from items i
    left join products p on p.id = i.product_id
    group by coalesce(p.name, 'Produk dihapus')
    order by qty desc
    limit 8
  ),
  trend_raw as (
    select
      case when p_bucket = 'hour' then to_char((tx.created_at at time zone p_tz), 'HH24') else to_char((tx.created_at at time zone p_tz)::date, 'YYYY-MM-DD') end as t,
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

create or replace function get_shift_summary(p_opened_at timestamptz)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'cashSales', coalesce((select sum(total) from transactions where payment_method = 'cash' and created_at >= p_opened_at), 0)
    + coalesce((select sum(amount) from payments where method = 'cash' and created_at >= p_opened_at), 0),
    'txCount', coalesce((select count(*) from transactions where created_at >= p_opened_at), 0)
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
        'name',    coalesce((select value from settings where key = 'store_name'), ''),
        'address', coalesce((select value from settings where key = 'store_address'), ''),
        'phone',   coalesce((select value from settings where key = 'store_phone'), '')
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
        'name',         coalesce(p.name, 'Produk dihapus'),
        'variant_name', coalesce(ti.variant_name, ''),
        'qty',          ti.qty,
        'price_sell',   ti.price_sell,
        'subtotal',     ti.subtotal,
        'discount',     coalesce(ti.discount, 0)
      )), '[]'::json)
      from transaction_items ti
      left join products p on p.id = ti.product_id
      where ti.transaction_id = t.id
    ),
    'payments', (
      select coalesce(json_agg(json_build_object('amount', pm.amount, 'method', pm.method, 'created_at', pm.created_at)), '[]'::json)
      from payments pm
      where pm.transaction_id = t.id
    )
  )
  from transactions t
  where t.share_token = p_token;
$$;

grant execute on function get_public_receipt(uuid) to anon, authenticated, service_role;
