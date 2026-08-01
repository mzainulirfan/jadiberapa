-- Squashed pre-multi-store schema for fresh install.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Categories
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references categories(id) on delete set null,
  price_buy integer not null default 0,
  price_sell integer not null default 0,
  stock integer not null default 0,
  sku text,
  barcode text,
  image_url text,
  unit text not null default 'pcs',
  min_stock integer not null default 5,
  is_low_stock boolean generated always as (stock <= min_stock) stored,
  is_favorite boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Customers
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  created_at timestamptz default now()
);

-- Product variants
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  sku text,
  price_buy integer not null default 0,
  price_sell integer not null default 0,
  created_at timestamptz not null default now()
);

-- Transactions
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  total integer not null default 0,
  payment_method text default 'cash',
  customer_id uuid references customers(id) on delete set null,
  discount integer not null default 0,
  fee integer not null default 0,
  paid_amount integer not null default 0,
  status text not null default 'lunas' check (status in ('lunas', 'utang')),
  number text,
  share_token uuid not null default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  cashier_name text,
  created_at timestamptz default now()
);

-- Transaction items
create table if not exists transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty integer not null default 1,
  price_sell integer not null,
  subtotal integer not null,
  discount integer not null default 0,
  price_buy integer not null default 0,
  variant_id uuid references product_variants(id) on delete set null,
  variant_name text,
  created_at timestamptz default now()
);

-- Settings
create table if not exists settings (
  key text primary key,
  value text not null
);

insert into settings (key, value) values
  ('store_name', 'Toko Saya'),
  ('store_address', ''),
  ('store_phone', '')
on conflict (key) do nothing;

-- Payments
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  amount integer not null check (amount > 0),
  method text not null default 'cash',
  note text,
  created_at timestamptz not null default now()
);

-- Stock movements
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  type text not null check (type in ('in', 'out', 'adjust')),
  qty integer not null,
  note text,
  created_at timestamptz not null default now()
);

-- Expenses
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  amount integer not null check (amount > 0),
  category text not null default 'lainnya',
  note text,
  created_at timestamptz not null default now()
);

-- Discount rules
create table if not exists discounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('product', 'category', 'global')),
  value_type text not null check (value_type in ('percent', 'amount')),
  value integer not null check (value > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists discount_products (
  discount_id uuid not null references discounts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (discount_id, product_id)
);

-- Cash sessions
create table if not exists cash_sessions (
  id uuid primary key default gen_random_uuid(),
  opening integer not null default 0,
  closing integer,
  expected integer,
  diff integer,
  note text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Carts
create table if not exists carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]',
  customer jsonb,
  updated_at timestamptz default now()
);

-- RLS
alter table products enable row level security;
alter table categories enable row level security;
alter table customers enable row level security;
alter table product_variants enable row level security;
alter table transactions enable row level security;
alter table transaction_items enable row level security;
alter table settings enable row level security;
alter table payments enable row level security;
alter table stock_movements enable row level security;
alter table expenses enable row level security;
alter table discounts enable row level security;
alter table discount_products enable row level security;
alter table cash_sessions enable row level security;
alter table carts enable row level security;

drop policy if exists "authenticated_all" on products;
drop policy if exists "authenticated_all" on categories;
drop policy if exists "authenticated_all" on customers;
drop policy if exists "authenticated_all" on transactions;
drop policy if exists "authenticated_all" on transaction_items;
drop policy if exists "authenticated_all" on settings;
create policy "authenticated_all" on products for all to authenticated using (true) with check (true);
create policy "authenticated_all" on categories for all to authenticated using (true) with check (true);
create policy "authenticated_all" on customers for all to authenticated using (true) with check (true);
create policy "authenticated_all" on transactions for all to authenticated using (true) with check (true);
create policy "authenticated_all" on transaction_items for all to authenticated using (true) with check (true);
create policy "authenticated_all" on settings for all to authenticated using (true) with check (true);

drop policy if exists "Semua akses product_variants" on product_variants;
create policy "Semua akses product_variants" on product_variants for all using (true) with check (true);

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'payments_all') then
    create policy "payments_all" on payments for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'stock_movements' and policyname = 'stock_movements_all') then
    create policy "stock_movements_all" on stock_movements for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'expenses' and policyname = 'expenses_all') then
    create policy "expenses_all" on expenses for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'discounts' and policyname = 'discounts_all') then
    create policy "discounts_all" on discounts for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'discount_products' and policyname = 'discount_products_all') then
    create policy "discount_products_all" on discount_products for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'cash_sessions' and policyname = 'cash_sessions_all') then
    create policy cash_sessions_all on cash_sessions for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'carts' and policyname = 'cart_own') then
    create policy "cart_own" on carts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- Storage bucket for product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "product_images_auth_insert" on storage.objects;
create policy "product_images_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "product_images_auth_update" on storage.objects;
create policy "product_images_auth_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images');

drop policy if exists "product_images_auth_delete" on storage.objects;
create policy "product_images_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'carts'
  ) then
    alter publication supabase_realtime add table public.carts;
  end if;
end $$;

-- Indexes
create index if not exists idx_transactions_created_at on transactions (created_at desc);
create index if not exists transactions_utang_idx on transactions (created_at) where status = 'utang';
create index if not exists idx_transaction_items_created_at on transaction_items (created_at);
create index if not exists idx_transaction_items_transaction_id on transaction_items (transaction_id);
create index if not exists idx_transaction_items_product_id on transaction_items (product_id);
create index if not exists idx_products_stock on products (stock);
create index if not exists products_favorite_idx on products (is_favorite);
create index if not exists product_variants_product_idx on product_variants (product_id);
create index if not exists payments_transaction_id_idx on payments (transaction_id);
create index if not exists stock_movements_product_idx on stock_movements (product_id, created_at desc);
create index if not exists expenses_created_at_idx on expenses (created_at desc);
create index if not exists cash_sessions_open_idx on cash_sessions (closed_at, opened_at desc);
create index if not exists discount_products_product_idx on discount_products (product_id);
create index if not exists discounts_active_idx on discounts (active);

create extension if not exists pg_trgm;
create index if not exists idx_transactions_number_trgm on transactions using gin (number gin_trgm_ops);
create index if not exists idx_customers_name_trgm on customers using gin (name gin_trgm_ops);
create index if not exists idx_products_name_trgm on products using gin (name gin_trgm_ops);
create index if not exists idx_products_sku_trgm on products using gin (sku gin_trgm_ops);
create index if not exists idx_products_barcode_trgm on products using gin (barcode gin_trgm_ops);

create unique index if not exists products_barcode_unique on products (barcode) where barcode is not null;
create unique index if not exists transactions_share_token_idx on transactions (share_token);

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
