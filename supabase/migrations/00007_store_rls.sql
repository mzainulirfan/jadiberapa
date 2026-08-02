-- Fase multi-toko (bagian 3/6): RLS store-aware menggantikan kebijakan lama.

-- Store-aware RLS.
drop policy if exists stores_member on stores;
create policy stores_member on stores
  for all to authenticated
  using (exists (select 1 from store_members sm where sm.store_id = stores.id and sm.user_id = auth.uid()))
  with check (exists (select 1 from store_members sm where sm.store_id = stores.id and sm.user_id = auth.uid()));

drop policy if exists store_members_own on store_members;
drop policy if exists store_members_select_own on store_members;
create policy store_members_select_own on store_members
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_active_store_own on user_active_store;
create policy user_active_store_own on user_active_store
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "authenticated_all" on products;
drop policy if exists "authenticated_all" on categories;
drop policy if exists "authenticated_all" on customers;
drop policy if exists "authenticated_all" on transactions;
drop policy if exists "authenticated_all" on transaction_items;
drop policy if exists "authenticated_all" on settings;
drop policy if exists "payments_all" on payments;
drop policy if exists "stock_movements_all" on stock_movements;
drop policy if exists "expenses_all" on expenses;
drop policy if exists "discounts_all" on discounts;
drop policy if exists "discount_products_all" on discount_products;
drop policy if exists "cash_sessions_all" on cash_sessions;
drop policy if exists "Semua akses product_variants" on product_variants;

do $$
declare
  t text;
begin
  foreach t in array array[
    'products','categories','customers','transactions','transaction_items',
    'settings','payments','stock_movements','expenses','discounts',
    'discount_products','cash_sessions','product_variants'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated using (store_id = current_store_id()) with check (store_id = current_store_id())',
      'store_all_' || t, t
    );
  end loop;
end $$;
