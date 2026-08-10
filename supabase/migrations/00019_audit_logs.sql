-- Audit trail untuk aktivitas sensitif. Nilai rahasia dan payload penuh tidak
-- disimpan; metadata hanya berisi ringkasan yang dibutuhkan untuk investigasi.

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  entity_type text not null check (char_length(entity_type) between 1 and 100),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table audit_logs enable row level security;

drop policy if exists audit_logs_owner_read on audit_logs;
create policy audit_logs_owner_read on audit_logs
  for select to authenticated
  using (
    exists (
      select 1 from store_members sm
      where sm.store_id = audit_logs.store_id
        and sm.user_id = auth.uid()
        and sm.role = 'owner'
        and sm.approved
    )
  );

create index if not exists audit_logs_store_created_idx
  on audit_logs (store_id, created_at desc);
create index if not exists audit_logs_entity_idx
  on audit_logs (entity_type, entity_id, created_at desc);

-- Tidak diberi grant ke authenticated. Hanya function security definer internal
-- dan trigger database yang boleh menulis audit trail.
create or replace function write_audit_log(
  p_store_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_store_id is null then return; end if;
  insert into audit_logs (store_id, user_id, action, entity_type, entity_id, metadata)
  values (
    p_store_id,
    auth.uid(),
    left(coalesce(p_action, 'unknown'), 100),
    left(coalesce(p_entity_type, 'unknown'), 100),
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke execute on function write_audit_log(uuid, text, text, uuid, jsonb) from public;

create or replace function audit_business_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  entity_id uuid;
  action_name text;
  metadata jsonb := '{}'::jsonb;
begin
  if tg_op = 'DELETE' then
    sid := old.store_id;
  else
    sid := new.store_id;
  end if;

  if tg_table_name = 'products' then
    entity_id := case when tg_op = 'DELETE' then old.id else new.id end;
    if tg_op = 'INSERT' then
      action_name := 'product.create';
      metadata := jsonb_build_object('name', new.name, 'stock', new.stock, 'price_sell', new.price_sell);
    elsif tg_op = 'DELETE' then
      action_name := 'product.delete';
      metadata := jsonb_build_object('name', old.name, 'stock', old.stock);
    elsif old.stock is distinct from new.stock then
      action_name := 'stock.change';
      metadata := jsonb_build_object('name', new.name, 'old_stock', old.stock, 'new_stock', new.stock);
    elsif old.price_buy is distinct from new.price_buy
       or old.price_sell is distinct from new.price_sell then
      action_name := 'product.price_change';
      metadata := jsonb_build_object(
        'name', new.name,
        'old_price_buy', old.price_buy,
        'new_price_buy', new.price_buy,
        'old_price_sell', old.price_sell,
        'new_price_sell', new.price_sell
      );
    else
      action_name := 'product.update';
      metadata := jsonb_build_object('name', new.name);
    end if;
  elsif tg_table_name = 'transactions' then
    entity_id := case when tg_op = 'DELETE' then old.id else new.id end;
    action_name := case when tg_op = 'INSERT' then 'transaction.create'
                        when tg_op = 'DELETE' then 'transaction.delete'
                        else 'transaction.update' end;
    metadata := jsonb_build_object(
      'total', case when tg_op = 'DELETE' then old.total else new.total end,
      'status', case when tg_op = 'DELETE' then old.status else new.status end,
      'paid_amount', case when tg_op = 'DELETE' then old.paid_amount else new.paid_amount end
    );
  elsif tg_table_name = 'payments' then
    action_name := case when tg_op = 'DELETE' then 'payment.delete' else 'payment.create' end;
    entity_id := case when tg_op = 'DELETE' then old.transaction_id else new.transaction_id end;
    metadata := jsonb_build_object(
      'amount', case when tg_op = 'DELETE' then old.amount else new.amount end,
      'method', case when tg_op = 'DELETE' then old.method else new.method end
    );
  elsif tg_table_name = 'cash_sessions' then
    entity_id := case when tg_op = 'DELETE' then old.id else new.id end;
    action_name := case
      when tg_op = 'INSERT' then 'shift.open'
      when tg_op = 'DELETE' then 'shift.delete'
      when old.closed_at is null and new.closed_at is not null then 'shift.close'
      else 'shift.update'
    end;
    metadata := jsonb_build_object(
      'opening', case when tg_op = 'DELETE' then old.opening else new.opening end,
      'closing', case when tg_op = 'DELETE' then old.closing else new.closing end,
      'diff', case when tg_op = 'DELETE' then old.diff else new.diff end
    );
  elsif tg_table_name = 'store_members' then
    action_name := case when tg_op = 'DELETE' then 'member.remove' else 'member.add' end;
    entity_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    metadata := jsonb_build_object(
      'role', case when tg_op = 'DELETE' then old.role else new.role end,
      'approved', case when tg_op = 'DELETE' then old.approved else new.approved end
    );
  elsif tg_table_name = 'settings' then
    action_name := 'settings.update';
    entity_id := null;
    metadata := jsonb_build_object('key', case when tg_op = 'DELETE' then old.key else new.key end);
  elsif tg_table_name in ('categories', 'customers', 'suppliers', 'expenses', 'discounts', 'purchases', 'supplier_payments') then
    action_name := lower(tg_table_name) || '.' || lower(tg_op);
    metadata := jsonb_build_object('operation', lower(tg_op));
  else
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  perform write_audit_log(sid, action_name, tg_table_name, entity_id, metadata);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists audit_products_mutation on products;
create trigger audit_products_mutation after insert or update or delete on products
  for each row execute function audit_business_mutation();

drop trigger if exists audit_transactions_mutation on transactions;
create trigger audit_transactions_mutation after insert or update or delete on transactions
  for each row execute function audit_business_mutation();

drop trigger if exists audit_payments_mutation on payments;
create trigger audit_payments_mutation after insert or update or delete on payments
  for each row execute function audit_business_mutation();

drop trigger if exists audit_cash_sessions_mutation on cash_sessions;
create trigger audit_cash_sessions_mutation after insert or update or delete on cash_sessions
  for each row execute function audit_business_mutation();

drop trigger if exists audit_store_members_mutation on store_members;
create trigger audit_store_members_mutation after insert or update or delete on store_members
  for each row execute function audit_business_mutation();

drop trigger if exists audit_settings_mutation on settings;
create trigger audit_settings_mutation after insert or update or delete on settings
  for each row execute function audit_business_mutation();

drop trigger if exists audit_categories_mutation on categories;
create trigger audit_categories_mutation after insert or update or delete on categories
  for each row execute function audit_business_mutation();

drop trigger if exists audit_customers_mutation on customers;
create trigger audit_customers_mutation after insert or update or delete on customers
  for each row execute function audit_business_mutation();

drop trigger if exists audit_suppliers_mutation on suppliers;
create trigger audit_suppliers_mutation after insert or update or delete on suppliers
  for each row execute function audit_business_mutation();

drop trigger if exists audit_expenses_mutation on expenses;
create trigger audit_expenses_mutation after insert or update or delete on expenses
  for each row execute function audit_business_mutation();

drop trigger if exists audit_discounts_mutation on discounts;
create trigger audit_discounts_mutation after insert or update or delete on discounts
  for each row execute function audit_business_mutation();

drop trigger if exists audit_purchases_mutation on purchases;
create trigger audit_purchases_mutation after insert or update or delete on purchases
  for each row execute function audit_business_mutation();

drop trigger if exists audit_supplier_payments_mutation on supplier_payments;
create trigger audit_supplier_payments_mutation after insert or update or delete on supplier_payments
  for each row execute function audit_business_mutation();
