# Rencana Implementasi — Upload Massal Barang

> Fase baru, mandiri. Hanya untuk pemilik toko (owner). Menambah parser +
> server action + dialog import; tidak menyentuh form produk per barang.

## 1. Tujuan

Memasukkan banyak barang sekaligus tanpa membuka form 1×1 — berguna untuk
stok awal toko atau penambahan besar. Mendukung **tempel dari Excel/Sheets**,
**upload file CSV**, dan **unduh template**.

## 2. Alur

1. Di halaman Barang, di samping tombol "+", tambah tombol **Upload Massal**
   (hanya owner; kasir sudah dilarang via `canManage`).
2. Dialog **Upload Barang Massal** (Drawer):
   - **Tempel dari Excel/Sheets** (textarea) — salin baris, tempel.
   - **Unggah file CSV** (input file) + tombol **Unduh Template CSV**.
3. **Pratinjau & validasi (client-side)**: tabel ringkas + ringkasan
   "X valid · Y error", baris error di-highlight. Tidak ada yang dikirim
   sebelum diverifikasi.
4. **Kirim** → server action `bulkCreateProducts`:
   - Guard `isOwner()`.
   - Kategori otomatis: cari nama → id; buat kategori baru bila belum ada.
   - Insert batch produk dalam satu panggilan; batas **500 baris/import**.
   - Response: jumlah sukses + daftar error → toast + reload list.

## 3. Kolom template

`Nama*`, `Kategori`, `Harga Beli`, `Harga Jual*`, `Stok`, `Stok Minimum`,
`Satuan`, `SKU`, `Barcode`.

Aturan angka: tanpa pemisah ribuan; pakai **koma** untuk desimal
(mis. `1500,5`). Satuan default `pcs`. Harga Jual wajib > 0, Nama wajib.

## 4. Perubahan komponen/file

1. **`lib/import/products.ts`** (baru) — parser murni:
   - Deteksi delimiter (tab vs koma) dari baris header.
   - Deteksi header (baris berisi "nama"/"harga"); bila tidak ada, pakai urutan
     kolom default.
   - Normalisasi header (lowercase, hapus spasi/underscore) → map kolom.
   - Validasi per baris: nama wajib, harga jual valid & > 0, angka numerik.
   - Return `{ rows, headerError? }`; tiap row punya `error?`.
2. **`lib/actions/products.ts`** — tambah `bulkCreateProducts(rows)`.
3. **`components/products/bulk-import-dialog.tsx`** (baru) — Drawer:
   input (paste/CSV) → pratinjau → kirim → hasil.
4. **`components/products/product-list.tsx`** — tombol Upload Massal di header.

## 5. Batasan / tidak dikerjakan v1

- Varian & satuan turunan tidak di-support di upload massal (tetap via form per
  barang).
- Gambar produk tidak via upload massal.
- Tidak ada dedupe otomatis SKU/barcode (fase lanjut dengan konfirmasi).
- CSV sederhana: nilai tanpa delimiter tertanam / baris baru di dalam tanda kutip.

## 6. Pengujian

1. `npm run lint`, `npm run build`, `npm run test` lolos.
2. Unit test parser: baris valid, header salah/kosong, angka koma desimal,
   kategori kosong, tanpa header (urutan default), delimiter tab vs koma.
3. Import ≤500 baris; kategori otomatis dibuat; baris error ditampilkan &
   tidak dikirim; kasir ditolak.
4. Template CSV terunduh & bisa dipakai.
