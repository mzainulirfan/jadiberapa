# Rencana Implementasi — Fase B: Analitik Lanjutan & Saran Restock

> Bagian dari [rencana-upgrade-fitur-2.md](./rencana-upgrade-fitur-2.md) (Fase B, P1).
> Setelah Fase A (Supplier & Pembelian) selesai. Menyusul pola kode repo: agregasi
> berat via RPC (pola `get_reports_summary`), query client + cache, UI patuh
> Notion Design System. Bahasa Indonesia.

## 1. Tujuan

Memakai data yang sudah terkumpul untuk memberi insight yang bisa ditindak:

1. **Margin per produk** — laba absolut & % tiap produk pada periode, tandai produk rugi/mendekati modal.
2. **Jam & hari sibuk** — heatmap sederhana dari `transactions.created_at` (periode).
3. **Saran restock** — barang laju jual tinggi + stok mendekati `min_stock` (lookback 14 hari).
4. **Barang mati** — produk tidak terjual dalam 30 hari tapi masih ada stok.

Tanpa tabel baru; cukup satu **RPC agregasi** `get_analytics_summary`.

## 2. Desain data — migrasi `00005_analytics.sql`

### RPC `get_analytics_summary(p_from, p_to, p_tz, p_restock_days, p_dead_days)`

- Pola sama seperti `get_reports_summary` (00001): `language sql`, `stable`, **bukan**
  `security definer` → pemfilteran toko otomatis via RLS `store_all_*`
  (`store_id = current_store_id()`), sudah terbukti di laporan.
- Isi (semua integer rupiah, margin %) — batasi 10 item per daftar:

| Bagian | Sumber | Logika |
| --- | --- | --- |
| `margins` | `transaction_items` + `products` (periode) | `profit = Σ(subtotal − discount) − Σ(qty·price_buy)`; `marginPct = profit/revenue·100`; urut profit desc |
| `busyHours` | `transactions` (periode) | group per jam (`to_char(created_at at time zone p_tz,'HH24')`), `value = Σ total` |
| `busyDays` | `transactions` (periode) | group per hari (`extract(isodow ...)` 1=Sen..7=Min) |
| `restock` | `products` + penjualan 14 hari | `daysLeft = floor(stock / (sold/14))`; rekomendasikan bila `stock ≤ greatest(min_stock, ceil(sold/14·7))`; urut `daysLeft asc nulls last, sold desc` |
| `deadStock` | `products` + penjualan 30 hari | `stock > 0` DAN `last_sold < now()−30 hari` atau belum pernah terjual; urut `daysIdle desc` |

- `grant execute ... to authenticated` (konsisten dengan 00004).

Catatan: `margins`, `busyHours`, `busyDays` mengikuti range laporan (p_from).
`restock`/`deadStock` memakai lookback tetap (14/30 hari) dan diberi label di UI.

## 3. Query client — `lib/db/queries.ts`

- Tipe baru: `BxAnalytics`, `BxMarginProduct`, `BxBusyHour`, `BxBusyDay`,
  `BxRestockSuggestion`, `BxDeadStock`.
- `getAnalytics(from?: string): Promise<BxAnalytics>` — panggil RPC, normalisasi
  angka (`Number() || 0`), isi array kosong default. TZ diambil dari browser.

## 4. UI — `components/reports/reports-view.tsx`

- Tambah **tab segmented** di bawah bar periode: **Ringkasan** | **Analitik**.
- `ReportsView` memuat laporan **dan** analitik bersama (satu `Promise.all`),
  keduanya ikut range; satu state loading.
- Tombol Ekspor/Bagikan/WhatsApp hanya tampil di tab **Ringkasan** (datanya
  khusus laporan).
- Komponen baru `AnalyticsContent` dengan kartu (pola kartu laporan):
  1. **Saran Restock** (`AlertTriangle`) — daftar: nama, `±N hari lagi`/`Stok rendah`,
     stok & min, jumlah terjual 14 hari. Label "14 hari terakhir".
  2. **Barang Mati** (`Package`) — nama, stok, `N hari tidak terjual`/`Belum pernah terjual`.
     Label "30 hari terakhir".
  3. **Margin Produk** (`BarChart`) — tiap produk: nama, laba (merah jika profit ≤ 0),
     margin %, bar laba relatif; tandai "Rugi"/"Tipis".
  4. **Jam Sibuk** (`TrendingUp`) — heatmap grid 6×4 jam 0–23, intensitas via
     `rgba(0,117,222,α)`; + kartu kecil "Puncak" (jam & hari tersibuk).
- Bagian 1–2 selalu tampil; bagian 3–4 hanya jika ada penjualan di periode
  (sebaliknya empty state "Belum ada transaksi pada periode ini").

## 5. Yang TIDAK dikerjakan

- Tidak menambah tabel baru / kolom.
- Tidak mengubah rumus laba laporan (margin per produk hanya insight, tidak
  memengaruhi `get_reports_summary`).
- Tidak ada saran restock otomatis saat kasir (hanya di halaman laporan).
- Ekspor/PDF belum menyertakan analitik (cukup ringkasan laporan).

## 6. Pengujian (checklist)

1. `npm run lint` & `npm run build` lolos.
2. Tab Analitik menampilkan 4 kartu; range Hari Ini/7 Hari/Bulan Ini/Semua ikut
   mengubah margin & jam/hari sibuk.
3. Saran restock memunculkan barang stok ≤ min_stock walau belum pernah terjual.
4. Barang yang laku tinggi + stok menipis → muncul `±N hari lagi`.
5. Barang stok > 0 tak terjual 30 hari → muncul di Barang Mati.
6. Multi-toko: angka analitik hanya dari toko aktif (RLS).
7. Migrasi `00005` diterapkan via dashboard SQL editor (belum ada link CLI).
