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

**Keputusan desain (dipilih user): Aksi Cepat disatukan ke dalam kartu hero
Pendapatan**, bukan kartu/baris terpisah di puncak maupun di bawah angka.

| # | Seksi | Alasan |
| --- | --- | --- |
| 1 | Sapaan + [onboarding owner baru] | Tetap seperti sekarang. |
| 2 | **Hero Pendapatan** (kartu gelap): Pendapatan + delta + 3 metrik (Laba Bersih, Transaksi, Barang Terjual) + **strip Aksi Cepat** (dipisah garis, ikon compact di atas bg gelap, tombol Atur) | Angka utama duluan; aksi sebagai "dock" ringkas di dasar hero, tidak menyaingi ringkasan. |
| 3 | Kartu statistik, Grafik, Stok Menipis, Transaksi, Produk | Urutan tetap. |

Block onboarding (`TemplateOnboarding` + `WelcomeChecklist`) tetap di atas hero
hanya untuk pemilik baru (perlu panduan duluan).

## 4. Desain Aksi Cepat di dalam hero

- Di dalam kartu gelap `bg-ink`, di bawah metrik: pemisah `border-white/10`,
  label kecil "Aksi Cepat" (white/40) + tombol **Atur** (pil translusen white/10).
- Baris item **horizontal scroll**: lingkaran `bg-white/10` + ikon putih +
  label `text-[10px] white/70`; maks 6 (owner) / 4 (kasir).
- Kosong → teks "Belum ada aksi cepat." di atas bg gelap.
- Logika localStorage, preset peran, & `QuickActionsSheet` **tidak berubah**.

## 5. Perubahan komponen

1. **`components/dashboard/dashboard-view.tsx`**
   - Hapus `<QuickActions>` dari puncak halaman.
   - Teruskan `role` ke `DashboardContent`; render `<QuickActions role={role} />`
     di dalam kartu hero, setelah grid 3 metrik.
2. **`components/dashboard/quick-actions.tsx`**
   - Ubah tampilan luar jadi **strip di atas bg gelap** (untuk dipakai di hero),
     tanpa `<section>`/header sendiri.
   - Tanpa perubahan logika data/sheet.
3. **(Opsional, fase 3)** Banner status **Shift** (Buka/Tutup) di hero — query shift terakhir; berguna utk kasir & owner.

## 6. Yang TIDAK dikerjakan

- Tidak menambah/pindah metrik baru.
- Tidak mengubah logika Quick Actions & sheet.
- Tidak menyentuh Header, BottomNav, atau halaman lain.
- Tidak menambah analitik kunjungan (fase lanjut, terpisah).

## 7. Pengujian (checklist)

1. `npm run lint`, `npm run build`, `npm run test` lolos.
2. Strip Aksi Cepat tampil di dasar kartu hero (bukan di puncak halaman).
3. Owner: 6 aksi; kasir: 4 aksi; tap → halaman benar.
4. Atur/toggle/urutkan/reset masih berfungsi & tersimpan (localStorage).
5. Periode dropdown tetap mengontrol hero/stat/grafik.
6. Aksi kosong → tampil teks "Belum ada aksi cepat.".
7. Teks & ikon aksi tetap terbaca di atas bg gelap (white/70 + bg-white/10).
