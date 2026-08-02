-- Suppliers, purchases (nota beli), and supplier debt (hutang dagang).
-- Mirrors the customer debt model: purchases.paid_amount + status + supplier_payments.

-- Suppliers
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade default current_store_id(),
  name text not null,
  phone text,
  note text,
  created_at timestamptz not null default now()
);

-- Purchases (purchase order / nota beli)
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade default current_store_id(),
  number text not null,
  supplier_id uuid references suppliers(id) on delete set null,
  total integer not null default 0,
  paid_amount integer not null default 0,
  status text not null default 'lunas' check (status in ('lunas', 'utang')),
  note text,
  user_id uuid references auth.users(id) on delete set null,
  cashier_name text,
  created_at timestamptz not null default now()
);

-- Purchase items
create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade default current_store_id(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty integer not null,
  price_buy integer not null default 0,
  subtotal integer not null default 0,
  created_at timestamptz not null default now()
);

-- Payments toward a purchase (DP + installments)
create table if not exists supplier_payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade default current_store_id(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  amount integer not null check (amount > 0),
  method text not null default 'cash',
  note text,
  created_at timestamptz not null default now()
);

alter table suppliers enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table supplier_payments enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['suppliers', 'purchases', 'purchase_items', 'supplier_payments'] loop
    execute format('drop policy if exists %I on %I', 'store_all_' || t, t);
    execute format(
      'create policy %I on %I for all to authenticated using (store_id = current_store_id()) with check (store_id = current_store_id())',
      'store_all_' || t, t
    );
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['suppliers', 'purchases', 'purchase_items', 'supplier_payments'] loop
    execute format('create index if not exists %I on %I (store_id)', 'idx_' || t || '_store', t);
  end loop;
end $$;

create index if not exists purchases_supplier_idx on purchases (supplier_id);
create index if not exists purchases_status_idx on purchases (status);
create index if not exists purchase_items_purchase_idx on purchase_items (purchase_id);
create index if not exists purchase_items_product_idx on purchase_items (product_id);
create index if not exists supplier_payments_purchase_idx on supplier_payments (purchase_id);
create unique index if not exists purchases_store_number_key on purchases (store_id, number);
create index if not exists idx_suppliers_name_trgm on suppliers using gin (name gin_trgm_ops);

-- Create a purchase atomically: nota + items + stock in + last buy cost + audit trail + DP.
create or replace function create_purchase(
  p_supplier_id uuid,
  p_items jsonb,
  p_paid_amount integer default 0,
  p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  item jsonb;
  total integer := 0;
  paid integer;
  pur_id uuid;
begin
  if auth.uid() is null then
    return json_build_object('error', 'Tidak ada sesi');
  end if;

  select current_store_id() into sid;
  if sid is null then
    return json_build_object('error', 'Toko aktif tidak ditemukan');
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return json_build_object('error', 'Pembelian minimal 1 item');
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    if (item->>'product_id') is null or (item->>'qty') is null or (item->>'price_buy') is null then
      return json_build_object('error', 'Item pembelian tidak lengkap');
    end if;
    if (item->>'qty')::int <= 0 then
      return json_build_object('error', 'Jumlah item harus lebih dari 0');
    end if;
    if not exists (select 1 from products where id = (item->>'product_id')::uuid and store_id = sid) then
      return json_build_object('error', 'Barang tidak ditemukan di toko ini');
    end if;
    total := total + (item->>'qty')::int * greatest(0, (item->>'price_buy')::int);
  end loop;

  paid := greatest(0, least(total, p_paid_amount));

  insert into purchases (store_id, number, supplier_id, total, paid_amount, status, note, user_id, cashier_name)
  values (
    sid,
    'PB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    p_supplier_id,
    total,
    paid,
    case when paid >= total then 'lunas' else 'utang' end,
    p_note,
    auth.uid(),
    split_part(coalesce((select email from auth.users where id = auth.uid()), ''), '@', 1)
  )
  returning id into pur_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    insert into purchase_items (store_id, purchase_id, product_id, qty, price_buy, subtotal)
    values (
      sid,
      pur_id,
      (item->>'product_id')::uuid,
      (item->>'qty')::int,
      greatest(0, (item->>'price_buy')::int),
      (item->>'qty')::int * greatest(0, (item->>'price_buy')::int)
    );

    update products
    set stock = stock + (item->>'qty')::int,
        price_buy = greatest(0, (item->>'price_buy')::int),
        updated_at = now()
    where id = (item->>'product_id')::uuid and store_id = sid;

    insert into stock_movements (store_id, product_id, type, qty, note)
    values (sid, (item->>'product_id')::uuid, 'in', (item->>'qty')::int, 'Pembelian');
  end loop;

  if paid > 0 then
    insert into supplier_payments (store_id, purchase_id, amount, method, note)
    values (sid, pur_id, paid, 'cash', 'DP');
  end if;

  return json_build_object('error', null, 'id', pur_id);
end;
$$;

grant execute on function create_purchase(uuid, jsonb, integer, text) to authenticated;

-- Record a payment (installment/settlement) toward a purchase.
create or replace function record_supplier_payment(
  p_purchase_id uuid,
  p_amount integer,
  p_method text default 'cash',
  p_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  pur purchases%rowtype;
  applied integer;
  new_paid integer;
  new_status text;
begin
  if auth.uid() is null then
    return json_build_object('error', 'Tidak ada sesi');
  end if;

  select current_store_id() into sid;
  if sid is null then
    return json_build_object('error', 'Toko aktif tidak ditemukan');
  end if;

  if p_amount <= 0 then
    return json_build_object('error', 'Nominal tidak valid');
  end if;

  select * into pur from purchases where id = p_purchase_id and store_id = sid;
  if not found then
    return json_build_object('error', 'Pembelian tidak ditemukan');
  end if;

  applied := least(p_amount, greatest(0, pur.total - pur.paid_amount));
  if applied <= 0 then
    return json_build_object('error', 'Utang sudah lunas');
  end if;

  insert into supplier_payments (store_id, purchase_id, amount, method, note)
  values (sid, p_purchase_id, applied, coalesce(p_method, 'cash'), p_note);

  new_paid := pur.paid_amount + applied;
  new_status := case when new_paid >= pur.total then 'lunas' else 'utang' end;

  update purchases
  set paid_amount = new_paid, status = new_status
  where id = p_purchase_id and store_id = sid;

  return json_build_object('error', null, 'paid_amount', new_paid, 'status', new_status);
end;
$$;

grant execute on function record_supplier_payment(uuid, integer, text, text) to authenticated;

-- Purchase totals in a period + current outstanding supplier debt.
create or replace function get_purchases_summary(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'totalPurchases', coalesce((
      select sum(total) from purchases
      where (p_from is null or created_at >= p_from)
        and (p_to is null or created_at <= p_to)
        and store_id = current_store_id()
    ), 0),
    'outstandingDebt', coalesce((
      select sum(total - paid_amount) from purchases
      where status = 'utang' and store_id = current_store_id()
    ), 0)
  );
$$;

grant execute on function get_purchases_summary(timestamptz, timestamptz) to authenticated;
