# Rencana: Template Toko Saat Baru Buka

> Dokumen perencanaan. Belum ada kode yang diubah. Tujuan: ketika pemilik membuat
> toko baru, aplikasi menawarkan **template isi awal** (kategori, barang, diskon,
> pengaturan) sesuai jenis usaha — mis. **Kelontong**, **Warung**, **Kios**, dll —
> sehingga toko tidak mulai kosong. Bahasa & istilah mengikuti PRD (Barang, Pembeli,
> dst).

Tanggal disusun: 2026-08-01
Status: proposal

---

## 1. Latar belakang & masalah

Saat ini toko baru benar-benar kosong:

- Trigger `handle_new_user` (migrasi `00026`/`00028`) hanya membuat `stores`,
  `store_members` (owner), dan 3 baris `settings` (`store_name`, `store_address`,
  `store_phone`).
- Satu-satunya seed barang (`00002_seed_products.sql`) dibuat era single-store
  (tanpa `store_id`) dan harus dijalankan manual di SQL Editor — tidak pernah
  tersedia untuk toko baru.
- Akibatnya: halaman Barang, Kategori, Diskon, dan Kasir tampil kosong. Pemilik
  harus mengetik semuanya dari nol sebelum bisa berjualan.

## 2. Tujuan

1. Saat pemilik membuat toko, muncul pilihan **template jenis usaha**.
2. Memilih template mengisi toko dengan **kategori**, **contoh barang** (harga
   beli/jual + stok), **diskon bawaan**, dan **pengaturan awal** (`min_stock`
   default) yang langsung bisa dipakai/diubah.
3. Tetap ada opsi **"Mulai Kosong"** untuk pemilik yang tidak ingin data contoh.
4. Aman: hanya pemilik, hanya sekali, hanya untuk toko yang benar-benar kosong.

## 3. Konsep template

Sebuah **template** adalah sekumpulan data awal bertanda toko yang terdiri dari:

- `key` (id unik, mis. `kelontong`).
- `name` + `desc` + `icon` (untuk kartu pilihan di UI).
- `categories: string[]` — nama kategori yang akan dibuat.
- `products: { name, category, price_buy, price_sell, stock, unit, sku }[]`.
- `discounts?: { name, type, value_type, value, active, product_names? }[]`
  — opsional, diikat ke produk/kategori yang sudah dibuat.
- `settings?: Record<string, string>` — mis. `default_min_stock`.

> Catatan: harga & stok di template adalah **contoh realistis** yang harus
> disesuaikan pemilik. Stok awal 0–100 tergantung barang agar tidak muncul salah
> di peringatan stok menipis.

## 4. Katalog template (rilis pertama)

Diusulkan 4 template + 1 opsi kosong. Isi tiap template dirangkum di bawah
(detail produk di file data saat implementasi).

### 4.1 Kelontong (default)
- **Kategori:** Makanan Pokok, Sembako, Minuman, Makanan Ringan, Rumah Tangga.
- **Barang (± 20):** beras 5kg, telur, gula, minyak goreng, tepung, garam, kecap,
  mi instan (2 varian), biskuit, roti tawar, air mineral, teh botol, kopi sachet,
  teh celup, sabun mandi, deterjen, shampoo sachet, pasta gigi.
- **Diskon:** contoh 1 aturan global non-aktif (mis. "Promo Akhir Pekan 5%").
- **Pengaturan:** `default_min_stock = 5`.

### 4.2 Warung Makan
- **Kategori:** Lauk, Sayur, Nasi & Olahan, Minuman, Bumbu.
- **Barang (± 18):** nasi bungkus, ayam goreng, tempe/tahu goreng, telur dadar,
  sayur sop, sambal, es teh, es jeruk, air mineral, kopi, dll.
- **Diskon:** opsional.
- **Pengaturan:** `default_min_stock = 3`.

### 4.3 Kios / Minimarket
- **Kategori:** Makanan, Minuman, Rokok, Sembako, Pulsa & Isi Ulang, Lainnya.
- **Barang (± 20):** minuman botol, jajanan, rokok (beberapa), beras 1kg,
  gula 250g, pulsa voucher, token listrik, dll.
- **Diskon:** opsional.
- **Pengaturan:** `default_min_stock = 10`.

### 4.4 Toserba / Perabot Rumah
- **Kategori:** Perabot, Alat Dapur, Kebersihan, Elektronik Kecil, Perawatan Diri.
- **Barang (± 15):** ember, gayung, panci, sabun cuci piring, sapu, kipas kecil,
  lampu, dll.
- **Diskon:** opsional.
- **Pengaturan:** `default_min_stock = 3`.

> Katalog bisa bertambah tanpa migrasi DB (lihat §6). Template di luar daftar di
> atas cukup menambah satu file data TS + satu entri registry.

## 5. Desain teknis

### 5.1 Penyimpanan data template

Template disimpan sebagai **modul TS** (data statis di codebase), bukan tabel DB:

- `lib/templates/kelontong.ts`, `warung-makan.ts`, `kios.ts`, `toserba.ts`.
- `lib/templates/index.ts` — registry `{ key, name, desc, icon, ... }[]` untuk UI.

**Alasan vs tabel DB:**
- Mudah ditinjau/diubah saat review (harga produk dalam PR).
- Tidak perlu migrasi setiap menambah barang template.
- Data template hanya dipakai **sekali saat apply** (bukan dibaca berulang), jadi
  tidak butuh cache/RPC.

### 5.2 Server action `applyStoreTemplate`

File baru `lib/actions/templates.ts` (pola sama dengan `products.ts`):

```
export async function applyStoreTemplate(templateKey: string): Promise<{ error: string | null }>
```

Alur:

1. `isOwner()` — hanya pemilik toko aktif.
2. Ambil template dari registry; `templateKey` tak dikenal → error.
3. **Idempotensi:** cek `products` milik toko aktif (via `current_store_id()`);
   jika sudah ada barang → tolak (`"Toko sudah memiliki barang"`).
4. Insert `categories` (dengan `store_id`), ambil kembali `id` per nama.
5. Insert `products` memakai `category_id` hasil langkah 4 + `store_id`.
6. Insert `discounts` (+ `discount_products` untuk aturan per-produk) bila ada.
7. Upsert `settings` default bila kunci belum ada (jangan timpa nilai yang sudah
   diisi pengguna).
8. `revalidatePath` untuk `/products`, `/categories`, `/discounts`, `/more`.

Semua insert berjalan dalam satu blok; jika ada error → return `{ error }` dan
jangan sebagian terisi (opsional: bungkus transaksi `rpc` jika mau atomic; tahap
awal cukup return error + user bisa tekan ulang karena idempoten).

### 5.3 Alur daftar (register)

Perubahan di `components/auth/register-form.tsx` (mode owner):

- Setelah input "Nama Toko", tambahkan **pemilih template** (grid kartu):
  - Template dari `lib/templates/index.ts` + opsi **"Mulai Kosong"**.
  - State `templateKey` default = `kelontong`.
- Saat `signUp` sukses (mode owner):
  - Ambil `store_id` via RPC `current_store_id()` (toko sudah dibuat trigger).
  - Panggil `applyStoreTemplate(templateKey)`.
  - Jika `templateKey` = "kosong" → lewati apply.
  - Tampilkan state loading **"Menyiapkan toko..."** sebelum `router.push("/dashboard")`.
- Error apply → toast, tetap lanjut ke dashboard (toko tetap hidup, kosong).

> Kenapa tidak lewat `user_metadata` + trigger? Mengisi puluhan barang di dalam
> trigger PL/pgSQL sulit dimaintain & bikin migrasi besar. Apply dari client via
> server action memakai kode TS yang sama dengan CRUD barang biasa. Kelemahannya
> ada satu round-trip ekstra setelah signup — di-cover oleh loading state.

### 5.4 Onboarding pengganti (jika toko kosong)

**Fallback penting:** pemilik yang membuat toko lalu keluar di tengah proses
(mis. koneksi putus setelah signup) tidak boleh tersangkut di toko kosong tanpa
pilihan.

- Deteksi di `/dashboard` (atau komponen `onboarding`): `isOwner` **dan**
  belum ada `categories` **dan** belum ada `products` untuk toko aktif
  (query murah: `count` dua tabel, cache TTL 60s seperti pola `getProducts`).
- Jika terpenuhi → tampilkan layar **"Pilih template"** (modal/drawer di atas
  dashboard) dengan kartu template + "Mulai Kosong" + tombol **"Lewati"**.
- Pilih template → `applyStoreTemplate` → invalidate cache → UI terisi.
- Tolok ukur hanya `categories` + `products` kosong (bukan flag di `settings`)
  sehingga kompatibel dengan toko lama yang memang sengaja kosong.

### 5.5 Keamanan & batasan

- `applyStoreTemplate` guard `isOwner()` (kasir ditolak).
- RLS per toko tetap berlaku: semua insert memakai `store_id` hasil
  `current_store_id()` milik sesi server.
- Idempoten: tidak bisa apply dua kali ke toko yang sudah punya barang.

## 6. DB / migrasi

- **Tanpa tabel baru** — template hidup di kode TS.
- **Opsional (disarankan):** migrasi kecil `00032_store_template.sql` untuk
  mencatat pilihan sebagai referensi & analitik:
  - `alter table stores add column if not exists template_key text;`
  - Diisi saat apply (server action update `stores`).
  - Tidak mengubah perilaku; hanya jejak.
- Tidak mengubah `handle_new_user` — tetap hanya bikin toko + settings kosong.

## 7. UI/UX

- **Kartu template** di form daftar & onboarding: ikon (dari `ui/icons` yang ada,
  mis. `Store`, `ShoppingBag`, `Tag`), nama, deskripsi singkat, pilihan tunggal
  dengan tanda centang; mengikuti gaya kartu halaman Lainnya (`rounded-xl border
  border-hairline bg-canvas`).
- **Empty state** halaman Barang/Kategori tetap ada untuk kasus "Mulai Kosong".
- **Toast** pada sukses ("Template diterapkan") dan error (pola `sonner` yang
  sudah dipakai).
- Loading state pada tombol saat apply ("Menyiapkan toko…").

## 8. Rencana implementasi

1. **Data template:** buat `lib/templates/*.ts` (kelontong dulu sebagai pilot)
   + registry.
2. **Server action:** `lib/actions/templates.ts` `applyStoreTemplate` + guard +
   idempotensi + revalidate.
3. **Register:** tambah pemilih template di mode owner + apply setelah signup.
4. **Onboarding fallback:** deteksi toko kosong di dashboard + layar pilih
   template.
5. (Opsional) migrasi `stores.template_key`.
6. **Verifikasi:** lint + `tsc --noEmit` + `npm run build`; uji manual: daftar
   pemilik (Kelontong), daftar kasir (tidak terpengaruh), "Mulai Kosong", ganti
   toko (tidak menerapkan template ke toko lain).

## 9. Effort

| Bagian | Effort |
|---|---|
| Data template (4 template) | M |
| Server action + guard/idempotensi | S |
| Register: pemilih template + apply | M |
| Onboarding fallback di dashboard | M |
| Migrasi `template_key` (opsional) | XS |
| Verifikasi & build | S |
| **Total** | **M** |

## 10. Catatan

- Template isi produk **tidak** menyertakan gambar (tanpa upload otomatis).
- Jangan menyalin isi `00002_seed_products.sql` apa adanya — data itu global dan
  tanpa `store_id`; template harus per-toko.
- Harga template pakai angka realistis agar margin default wajar, tapi pemilik
  wajib menyesuaikan — tampilkan catatan "Contoh harga, sesuaikan dengan toko
  Anda".
- Setiap template: pastikan `stock` di bawah `min_stock` untuk beberapa barang
  tidak sengaja membuat dashboard "stok menipis" berisi di hari pertama.
