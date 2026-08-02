-- Fase C: Loyalitas poin + follow-up pembeli.
-- customers.points + loyalty_ledger (jejak) + RPC award/redeem.
-- Rasio poin dibaca dari settings per toko (default di kode bila kosong).

alter table customers add column if not exists points integer not null default 0;

create table if not exists loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade default current_store_id(),
  customer_id uuid not null references customers(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete set null,
  type text not null check (type in ('earn', 'redeem')),
  points integer not null,
  note text,
  created_at timestamptz not null default now()
);

alter table loyalty_ledger enable row level security;

drop policy if exists store_all_loyalty_ledger on loyalty_ledger;
create policy store_all_loyalty_ledger on loyalty_ledger
  for all to authenticated
  using (store_id = current_store_id())
  with check (store_id = current_store_id());

create index if not exists idx_loyalty_ledger_store on loyalty_ledger (store_id);
create index if not exists loyalty_ledger_customer_idx on loyalty_ledger (customer_id, created_at desc);
create index if not exists loyalty_ledger_transaction_idx on loyalty_ledger (transaction_id);

-- Tambah poin (earn) + jejak. Dipanggil server action setelah transaksi dibuat.
create or replace function award_loyalty_points(
  p_customer_id uuid,
  p_points int,
  p_transaction_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
begin
  if auth.uid() is null then
    return json_build_object('error', 'Tidak ada sesi');
  end if;
  if p_points <= 0 then
    return json_build_object('error', null);
  end if;

  select current_store_id() into sid;
  if sid is null then
    return json_build_object('error', 'Toko aktif tidak ditemukan');
  end if;

  if not exists (select 1 from customers where id = p_customer_id and store_id = sid) then
    return json_build_object('error', 'Pembeli tidak ditemukan');
  end if;

  update customers set points = points + p_points
  where id = p_customer_id and store_id = sid;

  insert into loyalty_ledger (store_id, customer_id, transaction_id, type, points, note)
  values (sid, p_customer_id, p_transaction_id, 'earn', p_points, 'Belanja');

  return json_build_object('error', null);
end;
$$;

-- Kurangi poin (redeem) + jejak; balikin berapa poin terpakai & nilai rupiahnya
-- (nilai per poin dibaca dari settings loyalty_redeem_value, default 100).
create or replace function redeem_loyalty_points(
  p_customer_id uuid,
  p_points int,
  p_transaction_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  bal int;
  used int;
  unit int;
begin
  if auth.uid() is null then
    return json_build_object('error', 'Tidak ada sesi');
  end if;
  if p_points <= 0 then
    return json_build_object('error', 'Poin tidak valid');
  end if;

  select current_store_id() into sid;
  if sid is null then
    return json_build_object('error', 'Toko aktif tidak ditemukan');
  end if;

  select points into bal from customers
  where id = p_customer_id and store_id = sid;
  if not found then
    return json_build_object('error', 'Pembeli tidak ditemukan');
  end if;

  unit := coalesce((
    select nullif(value, '')::int from settings where key = 'loyalty_redeem_value' and store_id = sid
  ), 100);

  used := least(p_points, bal);
  if used <= 0 then
    return json_build_object('error', 'Poin tidak cukup');
  end if;

  update customers set points = points - used
  where id = p_customer_id and store_id = sid;

  insert into loyalty_ledger (store_id, customer_id, transaction_id, type, points, note)
  values (sid, p_customer_id, p_transaction_id, 'redeem', -used, 'Tukar poin di kasir');

  return json_build_object('error', null, 'used', used, 'value', used * unit);
end;
$$;

grant execute on function award_loyalty_points(uuid, int, uuid) to authenticated;
grant execute on function redeem_loyalty_points(uuid, int, uuid) to authenticated;
