-- Fase 4: Diskon per nota
-- Diskon tingkat transaksi (nominal). total sudah disimpan sebagai nilai NETO
-- (setelah diskon) sehingga omzet & laba di dashboard/laporan tetap akurat tanpa
-- perubahan RPC. Kolom discount menyimpan besar potongan untuk ditampilkan di struk.

alter table transactions
  add column if not exists discount integer not null default 0;
