# Rencana Implementasi — Redesign Halaman Dashboard

> Fase baru, mandiri. Hanya mengubah komponen Dashboard (`dashboard-view.tsx`,
> `quick-actions.tsx`); tidak menyentuh layout global (Header/BottomNav) maupun
> logika penyimpanan Aksi Cepat.

## 1. Tujuan

Membuat halaman Dashboard punya **hierarki visual yang benar**: angka bisnis
dulu, lalu aksi, lalu detail — bukan navigasi di puncak. Hasil akhir: halaman
lebih padat, terfokus, dan selaras pola aplikasi kasir.

## 2. Review: masalah layout saat ini

Urutan sekarang: **Sapaan → Aksi Cepat → [onboarding owner] → Hero → Stat →
Grafik → Stok Menipis → Transaksi → Produk**.

| # | Masalah |
| --- | --- |
| 1 | **Aksi Cepat di puncak kurang cocok.** Metrik terpenting (Pendapatan) terdorong ke bawah lipatan; pemilik/kasir mencari angka dulu, navigasi belakangan. |
| 2 | Bentuk baris chip ikon horizontal **lebar** memakan tinggi & terlihat seperti menu duplikat, bukan ringkasan. |
| 3 | **Sapaan + judul Header ganda** ("Dashboard" di header, "Selamat pagi, X 👋" + tanggal + badge peran di konten) boros ruang vertikal. |
| 4 | **Stok Menipis** (alert prioritas restock) ditaruh jauh di bawah grafik, kurang menonjol. |
| 5 | Semua kartu mengalir tanpa cerita/seksi yang jelas. |

## 3. Struktur baru (urutan & alasan)

**Keputusan desain (dipilih user, mengikuti review):**
- **Aksi Cepat jadi section terpisah di bawah Hero Card** (bukan di dalam hero).
- Scope pertama = paket **High**: hero ringkas + CTA + KPI sederhana.
- Medium/Low (greeting, filter, grafik, bottom nav, warna, copywriting) = fase lanjut.

Urutan Dashboard:

| # | Seksi |
| --- | --- |
| 1 | Sapaan + [onboarding owner baru] |
| 2 | **Hero Card** penuh: baris "Penjualan · {periode}" + **tombol Mulai Transaksi** (kanan), revenue + delta, 3 sub-metrik (Laba Bersih, Transaksi, Barang Terjual) |
| 3 | **Aksi Cepat** (section terpisah, kartu terang) |
| 4 | **Stat 2×2**: Laba kotor, Pengeluaran, Rata-rata/transaksi, Item/transaksi |
| 5 | Grafik Penjualan |
| 6 | Stok Menipis, Transaksi Terbaru, Produk Terlaris |

## 4. Aksi Cepat — section terpisah

- Kartu `rounded-xl border bg-canvas` dengan header **Aksi Cepat** + tombol **Atur**.
- Baris item **horizontal scroll** (lingkaran `bg-canvas-soft` + ikon + label);
  maks 6 (owner) / 4 (kasir). Kosong → teks "Belum ada aksi cepat.".
- Logika localStorage, preset peran, & `QuickActionsSheet` tidak berubah.

## 5. Perubahan komponen (selesai)

1. **`components/dashboard/dashboard-view.tsx`**
   - Hero: baris header = "Penjualan · {periode}" (kiri) + **Mulai Transaksi**
     (kanan, primary kompak → `/cashier`); revenue + delta; **3 sub-metrik
     dipulihkan** (Laba Bersih, Transaksi, Barang Terjual) via `HeroStat`.
   - `QuickActions` tetap section terpisah di antara hero dan stat.
   - Stat kembali ke **grid 2×2 orisinal** (Laba kotor, Pengeluaran,
     Rata-rata/transaksi, Item/transaksi) — tanpa duplikasi dengan hero.
   - Pulihkan `HeroStat` & `fmtShort`.
2. **`components/dashboard/quick-actions.tsx`** — kartu terang (section
   terpisah); logika data/sheet tidak berubah.
3. **Fase lanjut (belum dikerjakan):** greeting ringkas, chip filter menonjol,
   evaluasi bottom nav, white space, copywriting ("Kelola Kasir"→"Kasir" dsb.).

## 6. Yang TIDAK dikerjakan

- Tidak menambah/pindah metrik baru.
- Tidak mengubah logika Quick Actions & sheet.
- Tidak menyentuh Header, BottomNav, atau halaman lain.
- Tidak menambah analitik kunjungan (fase lanjut, terpisah).

## 7. Pengujian (checklist)

1. `npm run lint`, `npm run build`, `npm run test` lolos.
2. Hero: "Penjualan · {periode}" kiri + **Mulai Transaksi** kanan (satu garis),
   revenue + delta, lalu 3 sub-metrik (Laba Bersih, Transaksi, Barang Terjual).
3. Tombol **Mulai Transaksi** menuju `/cashier`.
4. Aksi Cepat tampil section terpisah di bawah hero; Atur/toggle/urutkan/reset berfungsi.
5. Stat grid 2×2: Laba kotor, Pengeluaran, Rata-rata/transaksi, Item/transaksi.
6. Periode dropdown tetap mengontrol hero/stat/grafik.
