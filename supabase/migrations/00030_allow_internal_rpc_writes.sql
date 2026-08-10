-- SECURITY DEFINER di project hosted berjalan sebagai postgres, tetapi role ini
-- tetap membutuhkan policy eksplisit pada tabel ber-RLS. Policy hanya berlaku
-- untuk role postgres; authenticated tetap tidak memiliki write policy langsung.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'products', 'categories', 'customers', 'settings',
    'transactions', 'transaction_items', 'payments', 'stock_movements',
    'product_variants', 'product_units',
    'suppliers', 'purchases', 'purchase_items', 'supplier_payments',
    'expenses', 'discounts', 'discount_products', 'cash_sessions',
    'loyalty_ledger', 'audit_logs'
  ]
  loop
    execute format('drop policy if exists internal_rpc_all on %I', table_name);
    execute format(
      'create policy internal_rpc_all on %I for all to postgres using (true) with check (true)',
      table_name
    );
  end loop;
end;
$$;
