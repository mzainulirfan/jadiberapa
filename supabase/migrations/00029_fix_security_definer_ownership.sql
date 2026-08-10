-- Deployment melalui login role sementara dapat membuat SECURITY DEFINER tidak
-- memiliki privilege tabel setelah REVOKE di 00027. Normalisasi owner fungsi
-- internal ke postgres. Privilege DML role API dikembalikan sebagai prasyarat;
-- write langsung tetap ditolak karena tabel finansial tidak memiliki policy
-- INSERT/UPDATE/DELETE.

do $$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname::text = any(array[
        'create_transaction',
        'record_payment',
        'add_stock',
        'adjust_stock',
        'create_customer_contact',
        'update_customer_contact',
        'delete_customer_contact',
        'create_purchase',
        'record_supplier_payment',
        'restore_store_backup',
        'open_shift',
        'close_shift',
        'award_loyalty_points',
        'redeem_loyalty_points',
        'enforce_transaction_store_links',
        'snapshot_history_product_name',
        'audit_business_mutation',
        'write_audit_log'
      ])
  loop
    execute format('alter function %s owner to postgres', function_row.signature);
  end loop;
end;
$$;

grant insert, update, delete on
  customers, transactions, transaction_items, payments, stock_movements,
  purchases, purchase_items, supplier_payments, loyalty_ledger, cash_sessions
to authenticated;

-- Pastikan RPC publik tetap memiliki ACL minimum setelah pergantian owner.
revoke execute on function create_transaction(jsonb, text, uuid, integer, integer, integer, integer, text) from public, anon;
revoke execute on function record_payment(uuid, integer, text, text) from public, anon;
grant execute on function create_transaction(jsonb, text, uuid, integer, integer, integer, integer, text) to authenticated;
grant execute on function record_payment(uuid, integer, text, text) to authenticated;
