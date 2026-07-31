-- Dashboard performance: index kolom yang dipakai untuk filter/sort/join.
-- Tanpa index ini, tiap load dashboard melakukan sequential scan seluruh tabel.

-- Filter .gte("created_at", ...) & .order("created_at") pada transactions
create index if not exists idx_transactions_created_at
  on transactions (created_at desc);

-- Filter .gte("created_at", ...) pada transaction_items (produk terlaris)
create index if not exists idx_transaction_items_created_at
  on transaction_items (created_at);

-- Join nested transaction_items -> transactions / products (FK tidak auto-index)
create index if not exists idx_transaction_items_transaction_id
  on transaction_items (transaction_id);

create index if not exists idx_transaction_items_product_id
  on transaction_items (product_id);

-- .order("stock") untuk kartu "Stok Menipis"
create index if not exists idx_products_stock
  on products (stock);
