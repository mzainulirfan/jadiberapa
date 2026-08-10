-- Perbaikan migration 00018.
-- Trigger dipakai oleh beberapa tabel berbeda; jangan membaca field NEW sebelum
-- memastikan nama tabel karena tidak semua tabel memiliki customer_id.

create or replace function enforce_transaction_store_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_store uuid;
begin
  if tg_table_name = 'transactions' then
    if new.customer_id is not null then
      select store_id into related_store from customers where id = new.customer_id;
      if related_store is distinct from new.store_id then
        raise exception 'Pembeli bukan bagian dari toko aktif';
      end if;
    end if;
  elsif tg_table_name = 'transaction_items' then
    select store_id into related_store from transactions where id = new.transaction_id;
    if related_store is distinct from new.store_id then
      raise exception 'Transaksi bukan bagian dari toko aktif';
    end if;
    select store_id into related_store from products where id = new.product_id;
    if related_store is distinct from new.store_id then
      raise exception 'Barang bukan bagian dari toko aktif';
    end if;
    if new.variant_id is not null then
      select store_id into related_store from product_variants where id = new.variant_id;
      if related_store is distinct from new.store_id then
        raise exception 'Varian bukan bagian dari toko aktif';
      end if;
    end if;
  elsif tg_table_name = 'payments' then
    select store_id into related_store from transactions where id = new.transaction_id;
    if related_store is distinct from new.store_id then
      raise exception 'Pembayaran bukan bagian dari toko aktif';
    end if;
  elsif tg_table_name = 'stock_movements' then
    select store_id into related_store from products where id = new.product_id;
    if related_store is distinct from new.store_id then
      raise exception 'Pergerakan stok bukan bagian dari toko aktif';
    end if;
  elsif tg_table_name = 'product_variants' or tg_table_name = 'product_units' then
    select store_id into related_store from products where id = new.product_id;
    if related_store is distinct from new.store_id then
      raise exception 'Detail produk bukan bagian dari toko aktif';
    end if;
  elsif tg_table_name = 'discount_products' then
    select store_id into related_store from discounts where id = new.discount_id;
    if related_store is distinct from new.store_id then
      raise exception 'Diskon bukan bagian dari toko aktif';
    end if;
    select store_id into related_store from products where id = new.product_id;
    if related_store is distinct from new.store_id then
      raise exception 'Produk diskon bukan bagian dari toko aktif';
    end if;
  elsif tg_table_name = 'purchases' then
    if new.supplier_id is not null then
      select store_id into related_store from suppliers where id = new.supplier_id;
      if related_store is distinct from new.store_id then
        raise exception 'Supplier bukan bagian dari toko aktif';
      end if;
    end if;
  elsif tg_table_name = 'purchase_items' then
    select store_id into related_store from purchases where id = new.purchase_id;
    if related_store is distinct from new.store_id then
      raise exception 'Pembelian bukan bagian dari toko aktif';
    end if;
    select store_id into related_store from products where id = new.product_id;
    if related_store is distinct from new.store_id then
      raise exception 'Barang pembelian bukan bagian dari toko aktif';
    end if;
  elsif tg_table_name = 'supplier_payments' then
    select store_id into related_store from purchases where id = new.purchase_id;
    if related_store is distinct from new.store_id then
      raise exception 'Pembayaran supplier bukan bagian dari toko aktif';
    end if;
  elsif tg_table_name = 'loyalty_ledger' then
    select store_id into related_store from customers where id = new.customer_id;
    if related_store is distinct from new.store_id then
      raise exception 'Ledger loyalty bukan bagian dari toko aktif';
    end if;
  end if;
  return new;
end;
$$;
