-- Fase multi-toko (bagian 4/6): trigger keanggotaan + override fungsi security
-- definer agar sadar toko.

-- Keep active store valid when memberships change.
create or replace function store_members_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_active_store (user_id, store_id)
  values (new.user_id, new.store_id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function store_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from user_active_store where user_id = old.user_id and store_id = old.store_id;
  if not exists (select 1 from user_active_store where user_id = old.user_id) then
    insert into user_active_store (user_id, store_id)
    select user_id, store_id
    from store_members
    where user_id = old.user_id
    order by created_at asc
    limit 1;
  end if;
  return old;
end;
$$;

drop trigger if exists store_members_after_insert_trigger on store_members;
create trigger store_members_after_insert_trigger
  after insert on store_members
  for each row execute function store_members_after_insert();

drop trigger if exists store_members_after_delete_trigger on store_members;
create trigger store_members_after_delete_trigger
  after delete on store_members
  for each row execute function store_members_after_delete();

-- Store-scoped security definer functions.
create or replace function decrement_stock(pid uuid, qty int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update products
  set stock = greatest(0, stock - qty), updated_at = now()
  where id = pid and store_id = current_store_id();
end;
$$;

create or replace function increment_stock(pid uuid, qty int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update products
  set stock = stock + qty, updated_at = now()
  where id = pid and store_id = current_store_id();
end;
$$;

create or replace function get_shift_summary(p_opened_at timestamptz)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'cashSales', coalesce((
      select sum(total) from transactions
      where payment_method = 'cash' and created_at >= p_opened_at and store_id = current_store_id()
    ), 0)
    + coalesce((
      select sum(amount) from payments
      where method = 'cash' and created_at >= p_opened_at and store_id = current_store_id()
    ), 0),
    'txCount', coalesce((
      select count(*) from transactions
      where created_at >= p_opened_at and store_id = current_store_id()
    ), 0)
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
        'name',    coalesce((select value from settings where key = 'store_name' and store_id = t.store_id), ''),
        'address', coalesce((select value from settings where key = 'store_address' and store_id = t.store_id), ''),
        'phone',   coalesce((select value from settings where key = 'store_phone' and store_id = t.store_id), '')
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
