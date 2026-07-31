# PRD - Mobile POS (Kasir Sederhana)

## 1. Ringkasan

**Nama Proyek:** Mobile POS\
**Target:** Pemilik warung, UMKM, toko kecil\
**Platform:** Progressive Web App (PWA)

### Tujuan

Membangun aplikasi kasir yang cepat, ringan, dan mudah digunakan di
perangkat mobile.

## 2. Tech Stack

-   Next.js (App Router)
-   Tailwind CSS
-   shadcn/ui
-   Notion Design System (DESIGN-notion.md)
-   Boxicons (ikon)
-   PWA
-   Supabase (Auth + Database)
    -   Auth: Username + Passcode (tanpa email/konfirmasi)

## 3. Target Pengguna

-   Warung
-   Toko kelontong
-   Toko sembako
-   UMKM

## 4. Ruang Lingkup MVP

### Dashboard

-   Ringkasan penjualan hari ini
-   Jumlah transaksi
-   Total barang terjual
-   Estimasi laba
-   Transaksi terbaru
-   Produk terlaris

### Kasir

-   Cari barang
-   Filter kategori
-   Tambah barang ke keranjang
-   Ubah qty
-   Hapus item
-   Hitung total
-   Pilih pembeli (opsional)
-   Selesaikan transaksi

### Barang

-   Daftar barang
-   Cari barang
-   Tambah/Edit/Hapus
-   Kelola stok
-   Barcode (opsional)

### Pembeli

-   Daftar pembeli
-   Tambah/Edit/Hapus
-   Riwayat transaksi

### Laporan

-   Harian
-   Mingguan
-   Bulanan
-   Rentang tanggal
-   Ringkasan penjualan
-   Produk terlaris
-   Export PDF/Excel (V2)

### Pengaturan

-   Nama toko
-   Alamat
-   Logo
-   Backup/Restore
-   Tentang aplikasi

## 5. Navigasi

Bottom Navigation

-   Dashboard
-   Kasir
-   Barang
-   Lainnya

Menu "Lainnya" - Pembeli - Laporan - Pengaturan

## 6. User Flow

### Transaksi

1.  Buka aplikasi
2.  Masuk ke Kasir
3.  Cari barang
4.  Tambahkan ke keranjang
5.  Atur jumlah
6.  Konfirmasi pembayaran
7.  Simpan transaksi
8.  Dashboard & laporan diperbarui

## 7. UI/UX Principles

-   Mobile First
-   Thumb Friendly
-   Maksimal dua tap menuju aksi utama
-   Bottom Sheet untuk Cart
-   Floating Cart
-   Empty State yang informatif
-   Loading Skeleton
-   Toast untuk feedback
-   **Notion Design System:** Terapkan prinsip Notion — warm paper-soft canvas (#f6f5f4), near-black Inter type, single structural accent Notion Blue (#0075de), decorative multi-color sticker palette untuk ilustrasi

## 8. Copywriting

Gunakan istilah sederhana.

  Jangan          Gunakan
  --------------- -------------------
  Master Barang   Barang
  Customer        Pembeli
  Save            Simpan
  Sales Report    Laporan Penjualan

## 9. Notion Design System

Mengacu pada **DESIGN-notion.md** sebagai sumber design token utama.

### 9.1 Warna

| Token | Value | Penggunaan |
|---|---|---|
| `primary` | `#0075de` | Primary CTA, link aktif, focus signal |
| `primary-active` | `#005bab` | Pressed state primary CTA |
| `secondary` | `#213183` | Dark hero band (jika ada) |
| `canvas` | `#ffffff` | Kartu, panel, nav bar, form field |
| `canvas-soft` | `#f6f5f4` | Halaman canvas utama — warm off-white |
| `ink` | `#000000` | Heading & body text utama |
| `ink-secondary` | `#31302e` | Secondary body copy |
| `ink-muted` | `#615d59` | Supporting / muted copy |
| `ink-faint` | `#a39e98` | Caption, placeholder, metadata |
| `hairline` | `#e6e6e6` | Border 1px, divider |

**Sticker Palette** (dekorasi saja — bukan untuk CTA atau structural fill):
`accent-sky` (#62aef0), `accent-purple` (#d6b6f6), `accent-pink` (#ff64c8), `accent-orange` (#dd5b00), `accent-teal` (#2a9d99), `accent-green` (#1aae39), `accent-brown` (#523410)

### 9.2 Tipografi

Font: **Inter** (NotionInter — gunakan Inter dengan negative tracking eksplisit)

| Token | Size | Weight | Line H | Letter Spacing | Use |
|---|---|---|---|---|---|
| `display-1` | 64px | 700 | 1.0 | -2.125px | — |
| `display-2` | 54px | 700 | 1.04 | -1.875px | — |
| `heading-1` | 40px | 700 | 1.1 | -1px | Section headline |
| `heading-2` | 26px | 700 | 1.23 | -0.625px | Sub-section heading |
| `heading-3` | 22px | 700 | 1.27 | -0.25px | Card title |
| `title` | 20px | 600 | 1.4 | -0.125px | Feature title |
| `body-md` | 16px | 400 | 1.5 | 0 | Body copy default |
| `body-sm` | 15px | 400 | 1.33 | 0 | Tabel, nav, dense text |
| `button` | 16px | 500 | 1.5 | 0 | Label tombol |
| `caption` | 14px | 400 | 1.43 | 0 | Caption, footnote |
| `eyebrow` | 12px | 600 | 1.33 | +0.125px | Badge, label kecil |

### 9.3 Spacing

Base unit 8px: `xxs` 4px · `xs` 8px · `sm` 12px · `md` 16px · `lg` 24px · `xl` 28px · `xxl` 32px

### 9.4 Border Radius

| Token | Value | Use |
|---|---|---|
| `xs` | 4px | Form field, tag |
| `sm` | 5px | Menu item, list row |
| `md` | 8px | Utility/nav button, card kecil |
| `lg` | 12px | Feature card, ilustrasi frame |
| `xl` | 16px | Container besar |
| `full` | 9999px | Pill CTA, badge, icon circular |

### 9.5 Elevation

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | Hairline border, no shadow | Kartu default di canvas |
| 1 — Soft | Layered micro-shadow | Raised card, floating button |
| 2 — Elevated | Deeper shadow stack | Modal, popover |

### 9.6 Komponen (dari DESIGN-notion.md)

| Komponen | Style |
|---|---|
| `nav-bar` | Canvas white, ink text, body-sm |
| `button-primary` | Primary blue, full pill, 16px/500 |
| `button-secondary` | White surface, ink text, full pill + hairline + shadow |
| `button-utility` | White surface, ink text, rounded md, 4px 14px padding |
| `text-input` | Surface white, ink, body-sm, rounded xs (4px) |
| `badge-pill` | Surface white, primary text, eyebrow type, pill |
| `feature-card` | Surface white, rounded lg, padding 24px |
| `ex-cart-drawer` | Surface white, rounded xl, padding lg |
| `ex-data-table-cell` | Header canvas-soft + eyebrow, body body-sm, hairline row |
| `ex-empty-state-card` | Canvas-soft, rounded xl, padding xxl |
| `ex-toast` | Surface white, rounded xl, body-sm |

### 9.7 Integrasi Tailwind + shadcn/ui

- Semua design token Notion diatas akan dikonfigurasi di `tailwind.config.ts` (extend colors, fontFamily, fontSize, borderRadius, spacing).
- Komponen shadcn/ui akan di-custom menggunakan token Notion, bukan token default shadcn.
- Customisasi shadcn di `components.json` dan file global CSS.

### 9.8 Do's & Don'ts

- **Do:** Gunakan `canvas-soft` (#f6f5f4) sebagai background halaman utama
- **Do:** Primary blue hanya untuk CTA dan link — tidak untuk dekorasi
- **Do:** Sticker palette hanya untuk ilustrasi, ikon, badge kategori
- **Do:** Pill (`rounded-full`) untuk CTA, rounded md (8px) untuk utility button
- **Don't:** Jangan gunakan warna sticker palette untuk CTA atau structural fill
- **Don't:** Jangan gunakan heavy drop-shadow — Notion elevation itu micro-shadow
- **Don't:** Form field tetap rounded xs (4px), bukan pill

## 10. Komponen shadcn/ui & Ikon

### Ikon
-   **Boxicons** (`@boxicons/react`) — semua ikon UI

### Komponen shadcn/ui

-   Button (custom Notion)
-   Card (custom Notion)
-   Input (custom Notion)
-   Sheet (custom Notion)
-   Drawer (custom Notion)
-   Dialog (custom Notion)
-   Tabs (custom Notion)
-   Badge (custom Notion)
-   Command
-   Dropdown Menu
-   Popover
-   Calendar
-   Sonner (toast)
-   Skeleton

## 11. Database (Supabase)

### 11.1 Tabel

| Tabel | Keterangan |
|---|---|
| `products` | Barang (nama, harga beli, harga jual, stok, kategori, sku, barcode, created_at, updated_at) |
| `customers` | Pembeli (nama, telepon, alamat, created_at) |
| `transactions` | Transaksi (total, payment_method, customer_id, created_at) |
| `transaction_items` | Item transaksi (transaction_id, product_id, qty, harga_jual, subtotal) |
| `settings` | Pengaturan toko (key, value) |

### 11.2 Relasi

```
transactions -> customers (optional)
transaction_items -> transactions (cascade delete)
transaction_items -> products
```

### 11.3 Auth

Menggunakan Supabase Auth dengan **Username + Passcode** (tanpa email).

| Fitur | Detail |
|---|---|
| Login | Username + passcode (6 digit) |
| Register | Username + passcode saja, no email |
| Session | Persistent session (localStorage) |
| Logout | Hapus session |

**Approach:**
- Gunakan Supabase Auth dengan `phone` sebagai penyimpanan username (atau custom `users` table + `supabase.auth.signUp` dengan email dummy)
- Passcode disimpan sebagai password
- Skip email confirmation (`email_confirm: false`)

### 11.4 RLS Policy

Semua tabel menggunakan Row Level Security dengan policy:
- **Select/Insert/Update/Delete** hanya untuk authenticated user (single-user MVP)
- Nantinya di V3 akan diperluas untuk multi-user

## 12. Struktur Folder

``` text
app/
 ├── dashboard/
 ├── cashier/
 ├── products/
 ├── customers/
 ├── reports/
 ├── settings/
 └── layout.tsx

components/
 ├── dashboard/
 ├── cashier/
 ├── products/
 ├── customers/
 ├── reports/
 ├── settings/
 └── ui/

lib/
 ├── utils/
 ├── hooks/
 └── constants/
```

## 13. Non Functional Requirements

-   Responsive
-   PWA Installable
-   Offline cache
-   Performa \< 2 detik untuk membuka halaman utama
-   Mendukung Android & iOS modern

## 14. Roadmap

### MVP

-   Dashboard
-   Kasir
-   Barang
-   Pembeli
-   Laporan
-   Pengaturan

### V2

-   Barcode Scanner
-   Export PDF/Excel
-   Backup Cloud
-   Offline Sync

### V3

-   Multi User
-   Multi Toko
-   Printer Bluetooth
-   QRIS
-   Analitik lanjutan

## 15. Success Metrics

-   Waktu transaksi \< 30 detik
-   Maksimal 2 tap untuk menambah barang
-   Aplikasi dapat digunakan penuh di layar ponsel
-   Waktu muat awal \< 2 detik
