-- Fase skema inti (bagian 2/4): RLS + kebijakan akses, storage gambar produk,
-- dan publikasi realtime carts.

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
