-- Fase 6 (tahap 4): simpan pembeli terpilih di keranjang aktif & pesanan ditahan.
-- Sebelumnya pilihan pembeli hanya state lokal di halaman checkout sehingga hilang
-- saat kasir kembali ke kasir/cart lalu masuk checkout lagi. Dengan kolom ini
-- pembeli ikut tersimpan di carts (per user) dan held_carts (per pesanan ditahan).

alter table carts add column if not exists customer jsonb;

alter table held_carts add column if not exists customer jsonb;
