# Rencana Upgrade Fitur — Saberaha (Mobile POS)

> Dokumen perencanaan. Belum ada kode yang diubah. Tujuan: memetakan upgrade
> fitur berikutnya berdasarkan kondisi aplikasi saat ini dan kebutuhan nyata
> warung/UMKM. Bahasa & istilah mengikuti PRD (Barang, Pembeli, Simpan, dst).

Tanggal disusun: 2026-07-31

---

## 1. Kondisi saat ini (sudah berjalan)

- **Auth**: username + passcode (tanpa email).
- **Dashboard**: ringkasan penjualan hari ini + RPC agregasi + index.
- **Kasir**: cari/filter, keranjang realtime (sinkron antar-perangkat), floating cart.
- **Barang**: CRUD, kategori, gambar, **barcode** (scan kamera + generate EAN-13), cetak label.
- **Pembeli**: CRUD + riwayat.
- **Transaksi**: daftar + detail, pencarian (RPC), nomor transaksi, **cetak struk** (browser print) + **share** (Web Share).
- **Laporan**: harian/mingguan/bulanan/rentang tanggal (RPC agregasi).
- **Pengaturan**: profil toko, **QRIS** (payload + preview), auto-save.
- **Pembayaran**: tunai, QRIS, DANA.
- **App-shell**: terkunci ke viewport, pull-to-refresh, fix navbar PWA.

## 2. Gap utama (belum ada)

| Area | Status | Dampak |
|---|---|---|
| Offline / PWA penuh (manifest + service worker) | ❌ | NFR wajib; warung sering sinyal buruk |
| Utang / kasbon pembeli | ❌ | Kebutuhan #1 warung |
| Stok masuk (restock) & stok opname | ❌ | Stok tidak pernah bertambah otomatis |
| Peringatan stok menipis | ❌ | Kehabisan barang tak terpantau |
| Pengeluaran (expenses) | ❌ | Laba bersih tidak akurat |
| Diskon per item / nota | ❌ | Umum di transaksi harian |
| Export laporan (PDF/Excel/CSV) | ❌ | Roadmap V2 |
| Shift kasir & saldo laci | ❌ | Kontrol kas |
| Printer Bluetooth thermal (ESC/POS) | ❌ | Cetak struk asli, bukan print browser |
| Multi-user / multi-toko | ❌ | Roadmap V3 (RLS masih single-user) |

## 3. Prinsip prioritas

1. **Nyalakan yang wajib dulu** — NFR offline/PWA dan kebutuhan warung sehari-hari.
2. **Perubahan aman & bertahap** — tiap fase punya migrasi DB sendiri, bisa rilis terpisah.
3. **Hemat effort tinggi-dampak** — dahulukan fitur yang sering dipakai kasir.
4. **Jaga performa** — tetap pakai pola query client langsung + RPC agregasi + cache TTL.

---

## 4. Roadmap bertahap

### FASE 0 — PWA & Offline (P0, fondasi)
**Masalah:** Diinstal sebagai PWA tapi belum ada `manifest` & service worker; tidak bisa dipakai saat sinyal hilang.

- **Kerjakan:**
  - `app/manifest.ts` (nama, ikon, `display: standalone`, theme/background sesuai Notion, `orientation: portrait`).
  - Service worker (mis. `next-pwa`/Serwist): cache app-shell + aset; strategi *stale-while-revalidate* untuk data baca.
  - Antrean transaksi offline: simpan transaksi di IndexedDB saat offline, sinkronkan saat online (tandai status `pending/synced`).
  - Indikator status koneksi + badge "menunggu sinkron".
- **DB:** tidak wajib; opsional kolom `client_uuid` di `transactions` untuk idempotensi sinkron.
- **Effort:** M–L. **Dampak:** Tinggi (NFR).

### FASE 1 — Utang / Kasbon Pembeli (P0)
**Masalah:** Warung sering melayani "bon dulu". Belum ada pencatatan utang.

- **Kerjakan:**
  - Metode bayar baru `utang` di kasir (transaksi tercatat, tapi belum lunas).
  - Halaman "Utang" per pembeli: total utang, riwayat, tombol **Bayar/Cicil**.
  - Ringkasan total piutang di dashboard.
- **DB:**
  - `transactions.paid_amount integer`, `transactions.status` (`lunas`/`utang`).
  - Tabel `payments` (transaction_id, amount, method, created_at) untuk cicilan.
- **Effort:** M. **Dampak:** Sangat tinggi.

### FASE 2 — Manajemen Stok (P1)
**Masalah:** Stok hanya berkurang saat jual; tidak ada penambahan/koreksi terkontrol.

- **Kerjakan:**
  - **Stok masuk** (restock/pembelian): tambah stok + catat harga beli baru (rata-rata/terakhir).
  - **Stok opname**: koreksi manual dengan alasan (rusak, hilang, hitung ulang).
  - **Peringatan stok menipis**: ambang `min_stock` per barang + badge di daftar & dashboard.
- **DB:**
  - `products.min_stock integer default 0`.
  - Tabel `stock_movements` (product_id, type: `in`/`out`/`adjust`, qty, note, created_at) → jejak audit stok.
- **Effort:** M. **Dampak:** Tinggi.

### FASE 3 — Pengeluaran & Laba Bersih (P1)
**Masalah:** Laba di dashboard/laporan hanya dari margin jual-beli; biaya operasional tak terhitung.

- **Kerjakan:**
  - Catatan **Pengeluaran** (kategori: belanja, listrik, sewa, dll) + tanggal.
  - Dashboard/laporan: **Laba bersih = laba kotor − pengeluaran**.
- **DB:** tabel `expenses` (amount, category, note, created_at).
- **Effort:** S–M. **Dampak:** Tinggi.

### FASE 4 — Diskon & Export Laporan (P1)
- **Diskon:** diskon per item dan/atau per nota (nominal/persen) di kasir & checkout; tersimpan di transaksi.
  - **DB:** `transaction_items.discount`, `transactions.discount`.
- **Export laporan:** PDF (ringkas) + Excel/CSV (rinci) + tombol **Kirim WhatsApp**.
  - Library: `jspdf`/`jspdf-autotable` atau render HTML→print; CSV native.
- **Effort:** M. **Dampak:** Menengah–tinggi.

### FASE 5 — Shift Kasir & Printer Bluetooth (P2)
- **Shift/laci kas:** buka kas (saldo awal) → tutup kas (hitung selisih), laporan per shift.
  - **DB:** tabel `cash_sessions` (opening, closing, expected, diff, opened_at, closed_at).
- **Printer Bluetooth thermal (ESC/POS):** cetak struk asli via Web Bluetooth (58/80mm), pengganti print browser.
- **Effort:** L. **Dampak:** Menengah (tergantung perangkat pemilik).

### FASE 6 — Multi-user & Multi-toko (P3, scaling)
**Masalah:** RLS masih single-user (`using (true)`), tak bisa dipakai banyak pemilik/kasir.

- **Kerjakan:**
  - `owner_id`/`store_id` di semua tabel + **RLS per pemilik**.
  - Peran: **Pemilik** vs **Kasir** (batasi akses laporan/pengaturan/hapus).
  - (Lanjutan) multi-toko dalam satu akun + pilih toko aktif.
- **Effort:** L (migrasi menyeluruh + audit RLS). **Dampak:** Tinggi untuk pertumbuhan.

---

## 5. Urutan yang disarankan

1. **Fase 0 (PWA/Offline)** — tuntaskan janji "PWA installable + offline" (NFR).
2. **Fase 1 (Utang)** — nilai bisnis tertinggi untuk warung.
3. **Fase 2 (Stok)** → **Fase 3 (Pengeluaran)** — melengkapi akurasi operasional & laba.
4. **Fase 4 (Diskon + Export)** — pengalaman kasir & pelaporan.
5. **Fase 5–6** — sesuai kebutuhan skala (hardware / multi-user).

## 6. Backlog ide (belum diprioritaskan)

- Satuan & varian produk (pcs/lusin/kg, konversi satuan).
- Struk digital via link publik (tanpa cetak).
- Analitik lanjutan: margin per produk, jam sibuk, tren mingguan, saran restock.
- Barang favorit/quick-add di kasir; kategori cepat.
- Pajak/biaya layanan opsional per nota.
- Backup/restore data (export–import JSON) sebelum multi-user.
- Supplier & harga beli per supplier.

## 7. Catatan teknis (jaga konsistensi kode)

- Migrasi DB lanjut dari **`00014_*`** ke atas; agregasi berat pakai **RPC** (pola `00009/00013`).
- Baca data pakai **query client langsung** + cache TTL 60s; hindari server action untuk data latency-sensitif.
- Nilai uang tetap **integer** (rupiah) + format lokal `id-ID`.
- Tetap patuhi Notion Design System (canvas-soft, primary blue hanya untuk CTA, micro-shadow).
- Setiap fase: sertakan empty state, skeleton, dan toast sesuai konvensi yang ada.
