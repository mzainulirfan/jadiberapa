# Rencana Implementasi — Aksi Cepat (Quick Actions) di Dashboard

> Fase baru, mandiri. Mengikuti pola kode repo: komponen client + state lokal +
> localStorage (pola `welcome-checklist`), ikon dari `components/ui/icons.tsx`,
> bahasa Indonesia. Tidak menambah migrasi DB.

## 1. Tujuan

Mengurangi langkah untuk membuka menu yang paling sering dipakai: menaruh
shortcut menu (dari halaman **Lainnya**) sebagai deretan **Aksi Cepat** di puncak
Dashboard. Pengguna bisa **menyesuaikan sendiri** (aktif/nonaktif + urutan).

## 2. Kandidat menu yang paling sering dibuka

Belum ada analitik kunjungan halaman, jadi pemeringkatan memakai logika pola
pakai POS warung/ritel + peran:

### Pemilik (default 6 aksi)
| # | Menu | Alasan sering dibuka |
| --- | --- | --- |
| 1 | **Laporan** (`/reports`) | Dicek harian untuk lihat omzet/laba. |
| 2 | **Shift Kasir** (`/shift`) | Dibuka tiap buka/tutup kas. |
| 3 | **Pengeluaran** (`/expenses`) | Dicatat hampir tiap hari. |
| 4 | **Pembeli** (`/customers`) | Cek/tambah pembeli langganan. |
| 5 | **Kategori** (`/categories`) | Diutak-atik saat menambah barang baru. |
| 6 | **Kelola Kasir** (`/staff`) | Tambah/kelola kasir (lebih jarang, tapi penting). |

Cadangan (bisa diaktifkan pengguna): **Diskon**, **Supplier**, **Pembelian**,
**Utang**, **Pengaturan**, **Cadangan Data**, **Bantuan & FAQ**.

### Kasir (default 4 aksi)
| # | Menu |
| --- | --- |
| 1 | **Shift Kasir** (`/shift`) |
| 2 | **Pembeli** (`/customers`) |
| 3 | **Utang** (`/debts`) |
| 4 | **Bantuan & FAQ** (`/bantuan`) |

## 3. Desain data — localStorage, per toko per user

- Kunci: `saberaha:quick-actions:<storeId>:<userId>`
- Nilai: JSON array key aksi, urut sesuai pilihan user, mis. `["shift","expenses","reports"]`.
- **Bawaan**: dihitung dari peran saat render (owner/kasir) bila tidak ada nilai tersimpan.
- Alasan localStorage: preferensi UI, ringan, offline-friendly, sudah jadi pola
  repo (`welcome-checklist`), tanpa migrasi DB. Sinkron antar perangkat = fase lanjut.
- Mapping key → label, href, ikon, dan peran yang boleh (diambil dari data
  `OWNER_GROUPS`/`KASIR_GROUPS` agar satu sumber kebenaran — diekstrak ke modul
  bersama `lib/quick-actions.ts`).

## 4. UI Dashboard

- Bagian **"Aksi Cepat"** ditaruh di atas kartu pendapatan (di bawah sapaan), berisi:
  - Header kecil `Aksi Cepat` + tombol **Atur**.
  - Deretan tombol **horizontal scroll** (chip bundar): ikon + label 2 kata.
  - Tiap chip = `Link` ke href menu; tampil sesuai urutan tersimpan.
- Komponen baru `components/dashboard/quick-actions.tsx` (client):
  - Baca role (`useRole`) + store id (`current_store_id`) → resolve konfigurasi
    tersimpan atau bawaan.
  - Skeleton singkat saat role masih dimuat.
- Tidak tampil untuk kasir/owner tanpa toko aktif (dijaga `NoStoreGuard`).

## 5. UI Pengaturan (costumble) — `QuickActionsSheet`

- Tombol **Atur** membuka **Drawer** (pola `product-dialog`/Drawer ui/drawer):
  - Daftar **semua aksi yang boleh untuk peran** (owner/kasir).
  - Setiap aksi: ikon + label + **toggle** aktif/nonaktif.
  - **Urutan**: tombol ↑/↓ per item untuk memindah (tanpa library drag).
  - Tombol **Reset ke bawaan** untuk kembali ke preset peran.
  - Simpan ke localStorage, lalu refresh chip di Dashboard.

## 6. Yang TIDAK dikerjakan

- Tidak ada tracking kunjungan halaman / rekomendasi otomatis "sering dibuka"
  (fase lanjut; bisa memakai localStorage counter klik lalu menawarkan saran).
- Tidak sinkron antar perangkat (belum pakai DB).
- Tidak menambah aksi di luar menu Lainnya (mis. "Tambah Barang" — tetap via
  halaman Barang).
- Tidak drag-and-drop (pakai ↑/↓ demi kesederhanaan).

## 7. Pengujian (checklist)

1. `npm run lint` & `npm run build` lolos.
2. Owner: 6 aksi bawaan tampil; kasir: 4 aksi bawaan.
3. Chip menuju halaman yang benar.
4. Atur: toggle mati → chip hilang; toggle nyala → chip muncul.
5. Atur: ↑/↓ mengubah urutan chip; hasil tersimpan setelah reload.
6. Reset ke bawaan mengembalikan preset peran.
7. Berpindah toko → konfigurasi aksi mengikuti toko (kunci per store).
8. Role kasir → aksi owner (Kelola Kasir, Laporan) tidak muncul di daftar Atur.
