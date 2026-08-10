# Panduan Migrasi Database

Skema database dikelola lewat 30 file SQL berurutan (`00001`–`00030`) di folder ini.
Setiap file dibuat **idempoten** (aman dijalankan ulang) namun punya **dependensi
urutan**, jadi wajib diterapkan dari nomor terkecil ke terbesar.

## Status penerapan

Repository berisi migration sampai `00030`. Status production harus diverifikasi
di `supabase_migrations.schema_migrations` sebelum deploy; jangan mengasumsikan
database production sudah memiliki migration terakhir.

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
| 00016 | `00016_store_member_approval.sql` | Persetujuan member kasir |
| 00017 | `00017_cart_store.sql` | Isolasi keranjang per toko |
| 00018 | `00018_atomic_checkout_security.sql` | Checkout atomic, idempotensi, integrity, dan security policy |
| 00019 | `00019_audit_logs.sql` | Audit trail aktivitas sensitif |
| 00020 | `00020_fix_store_link_trigger.sql` | Perbaikan trigger relasi lintas toko |
| 00021 | `00021_fix_ambiguous_stock.sql` | Perbaikan referensi kolom stok dan shift |
| 00022 | `00022_fix_product_table_reference.sql` | Perbaikan referensi tabel produk pada checkout |
| 00023 | `00023_fix_checkout_update_alias.sql` | Hotfix alias UPDATE checkout |
| 00024 | `00024_fix_checkout_product_alias.sql` | Hotfix alias produk checkout |
| 00025 | `00025_fix_checkout_customer_and_supplier_payment.sql` | Pulihkan validasi pembeli checkout + lock pembayaran supplier |
| 00026 | `00026_preserve_history_and_fix_cogs.sql` | Snapshot produk historis + perbaikan modal satuan turunan |
| 00027 | `00027_financial_rpc_boundary.sql` | Batas RPC/RLS finansial + stok dan pembeli atomik |
| 00028 | `00028_checkout_errors_and_overflow.sql` | Checkout kanonik, proteksi overflow, dan kode error antrean |
| 00029 | `00029_fix_security_definer_ownership.sql` | Normalisasi owner RPC setelah hardening privilege tabel |
| 00030 | `00030_allow_internal_rpc_writes.sql` | Policy internal khusus role SECURITY DEFINER |

## Cara 1 — Manual (Supabase SQL Editor)

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) → project → **SQL Editor** → **New query**.
2. Salin **seluruh isi** satu file, tempel, lalu **Run**. Tunggu pesan sukses sebelum lanjut.
3. Ulangi untuk file berikutnya sesuai urutan nomor.

**DB yang sudah berjalan**: jalankan hanya migration yang belum tercatat, urut,
dimulai dari versi terakhir yang berhasil.

**DB baru / fresh install**: jalankan semua file dari `00001` sampai migration terakhir berurutan.

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

Agar `db push` hanya menjalankan yang tertunda, pastikan versi yang sudah
terpasang tercatat di `supabase_migrations.schema_migrations`. Gunakan
`migration repair` hanya untuk versi yang benar-benar sudah diterapkan:

```bash
supabase migration repair <versi-yang-sudah-diterapkan> --status applied
```

### 3. Terapkan migrasi yang tertunda

```bash
supabase db push --dry-run   # lihat dulu apa yang akan dijalankan
supabase db push
```

`db push` menjalankan migration yang belum tercatat lalu mencatatnya di tabel
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
