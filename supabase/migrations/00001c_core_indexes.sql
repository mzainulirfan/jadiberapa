-- Fase skema inti (bagian 3/4): index performa, pencarian trgm, dan unik.
-- Dipecah dari 00001_core.sql.

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
