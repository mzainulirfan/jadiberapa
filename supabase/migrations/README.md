# Panduan Migrasi Database

Skema database dikelola lewat 15 file SQL berurutan (`00001`–`00015`) di folder ini.
Setiap file dibuat **idempoten** (aman dijalankan ulang) namun punya **dependensi
urutan**, jadi wajib diterapkan dari nomor terkecil ke terbesar.

## Status penerapan saat ini

- **Sudah diterapkan** di DB produksi: `00001`–`00013`
- **Tertunda (belum dijalankan):** `00014_loyalty.sql` dan `00015_product_units.sql`

## Daftar file (urutan wajib)

| # | File | Isi |
|---|------|-----|
| 00001 | `00001_core_tables.sql` | Ekstensi, tabel bisnis, seed pengaturan |
| 00002 | `00002_core_rls_storage.sql` | RLS + kebijakan akses, storage gambar produk, realtime |
| 00003 | `00003_core_indexes.sql` | Index performa & pencarian (trgm) |
| 00004 | `00004_core_functions.sql` | Fungsi utilitas, trigger barcode, RPC pelaporan |
| 00005 | `00005_stores.sql` | Toko, keanggotaan, kode toko, seeding default store |
| 00006 | `00006_store_isolation.sql` | `store_id` di semua tabel bisnis + PK/constraint |
| 00007 | `00007_store_rls.sql` | RLS store-aware menggantikan kebijakan lama |
| 00008 | `00008_store_triggers.sql` | Trigger keanggotaan + fungsi security definer |
| 00009 | `00009_store_rpcs.sql` | RPC kelola toko & kasir |
| 00010 | `00010_held_carts_auth.sql` | Keranjang tertahan + hook auth signup |
| 00011 | `00011_store_deletion.sql` | Hapus toko & buat toko baru |
| 00012 | `00012_suppliers_purchases.sql` | Supplier, pembelian, hutang dagang |
| 00013 | `00013_analytics.sql` | Analitik lanjutan & saran restock |
| 00014 | `00014_loyalty.sql` | Poin loyalitas & follow-up pembeli |
| 00015 | `00015_product_units.sql` | Satuan produk (eceran/bulk) |

## Cara 1 — Manual (Supabase SQL Editor)

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) → project → **SQL Editor** → **New query**.
2. Salin **seluruh isi** satu file, tempel, lalu **Run**. Tunggu pesan sukses sebelum lanjut.
3. Ulangi untuk file berikutnya sesuai urutan nomor.

**DB yang sudah berjalan** (skema sudah terpasang): cukup jalankan yang tertunda, urut:
1. `00014_loyalty.sql`
2. `00015_product_units.sql`

**DB baru / fresh install**: jalankan semua file dari `00001` sampai `00015` berurutan.

> Aturan aman:
> - Jangan mengubah atau menjalankan ulang migrasi lama di DB yang sudah terisi.
> - Jika satu file gagal, perbaiki kesalahannya lalu **Run ulang file yang sama**
>   (file idempoten, aman tanpa merusak objek yang sudah ada).

## Cara 2 — Supabase CLI

Prasyarat: CLI terpasang (`supabase --version`) dan sudah `supabase login`.

### 1. Init & link (sekali saja)

```bash
supabase init
supabase link --project-ref <PROJECT_REF>
```

`PROJECT_REF` = kode di URL dashboard (`https://supabase.com/dashboard/project/<PROJECT_REF>/...`).
CLI akan menanyakan password database.

### 2. Tandai migrasi yang sudah ter-apply

Agar `db push` hanya menjalankan yang tertunda, tandai dulu versi yang sudah
terpasang di DB (di sini `00001`–`00013`):

```bash
supabase migration repair 00001 00002 00003 00004 00005 00006 00007 00008 00009 00010 00011 00012 00013 --status applied
```

### 3. Terapkan migrasi yang tertunda

```bash
supabase db push --dry-run   # lihat dulu apa yang akan dijalankan
supabase db push
```

`db push` menjalankan `00014` & `00015` lalu mencatatnya di tabel
`supabase_migrations.schema_migrations`. Migrasi yang sudah tercatat tidak
dijalankan ulang.

### 4. Migrasi baru ke depan

```bash
supabase migration new nama_perubahan
```

Isi file SQL-nya, lalu `supabase db push`. CLI hanya mengenali file bernama
`<angka>_<nama>.sql` dengan **prefix angka murni** — nama seperti `00001a_...`
(sisipan huruf) tidak dikenali dan dilewati. Semua file di repo ini sudah
memakai angka murni.

## Catatan tambahan

- Semua file aman dijalankan ulang berkat `if not exists` / `create or replace` /
  `drop policy if exists` / pengecekan constraint sebelum mengubah struktur.
- `SUPABASE_SERVICE_ROLE_KEY` (di `.env.local`) dibutuhkan aplikasi untuk fitur
  admin seperti reset passcode kasir — tidak terkait migrasi, tapi wajib diisi.
