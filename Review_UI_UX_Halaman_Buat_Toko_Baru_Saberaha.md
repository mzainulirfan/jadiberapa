# Review UI/UX -- Halaman **Buat Toko Baru** (Saberaha)

## Ringkasan

Secara visual desain sudah modern, bersih, dan konsisten. Namun alur
pengisian (flow) masih terasa berat karena pengguna diminta mengambil
keputusan mengenai template sebelum benar-benar memahami manfaatnya.
Bagian pemilihan template juga memakan ruang yang cukup besar sehingga
form terlihat panjang.

------------------------------------------------------------------------

# Temuan & Rekomendasi

## 1. Urutan Informasi Kurang Natural

Saat ini urutannya:

-   Nama Toko
-   Pilih Template
-   Username
-   Password

Alur berpikir pengguna biasanya:

    Nama Toko
    ↓
    Jenis Toko
    ↓
    Preview isi template
    ↓
    Akun
    ↓
    Buat Toko

------------------------------------------------------------------------

## 2. Ubah Istilah "Template Awal"

Istilah **Template Awal** kurang jelas bagi pengguna awam.

### Rekomendasi

Gunakan salah satu:

-   Mulai Dengan
-   Data Awal Toko
-   Isi Awal Toko

Deskripsi:

> Pilih isi awal agar toko siap digunakan. Semua data masih bisa diubah
> nanti.

------------------------------------------------------------------------

## 3. List Template Terlalu Panjang

Daftar template memenuhi hampir setengah halaman.

### Rekomendasi

Gunakan card/grid agar pemilihan lebih cepat.

Contoh:

    🛒 Kelontong

    🍜 Warung Makan

    📱 Kios

    🏪 Toserba

    ✨ Mulai Kosong

------------------------------------------------------------------------

## 4. Gunakan Progressive Disclosure

Jangan tampilkan seluruh informasi sejak awal.

Setelah pengguna memilih template, baru tampilkan:

### Preview

-   24 kategori
-   320 produk contoh
-   Semua data bisa diubah

Dengan demikian halaman menjadi lebih ringkas.

------------------------------------------------------------------------

## 5. Jelaskan Isi Template

Saat ini pengguna tidak mengetahui isi template.

Tambahkan panel preview seperti:

    Kategori yang akan dibuat

    ✓ Minuman
    ✓ Snack
    ✓ Beras
    ✓ Minyak
    ✓ Bumbu

    + 19 kategori lainnya

    ≈320 produk contoh

------------------------------------------------------------------------

## 6. Pertimbangkan Urutan Form

Alternatif yang direkomendasikan:

    Nama Toko

    ↓

    Pilih Jenis Toko

    ↓

    Preview Template

    ↓

    Informasi Akun

    ↓

    Buat Toko

------------------------------------------------------------------------

## 7. Pisahkan "Buat Toko" dan "Gabung sebagai Kasir"

Segment control kurang tepat karena kedua aksi memiliki tujuan berbeda.

Lebih baik:

    Buat Toko Baru

    (form)

    ----------------

    Sudah punya toko?

    Gabung sebagai Kasir →

------------------------------------------------------------------------

## 8. Tambahkan Judul Section Akun

Sebelum Username dan Password tambahkan:

**Akun Pemilik**

atau

**Informasi Akun**

Sehingga perpindahan antar bagian terasa lebih jelas.

------------------------------------------------------------------------

## 9. Perkuat CTA

Daripada:

**Buat Toko**

Pertimbangkan:

-   Buat Toko Sekarang
-   Mulai Kelola Toko
-   Selesai & Buat Toko

------------------------------------------------------------------------

## 10. Perjelas State Template Terpilih

Card yang dipilih sebaiknya memiliki:

-   Border lebih tebal
-   Background lebih kontras
-   Ikon lebih besar
-   Badge "Direkomendasikan"
-   Ringkasan isi template

Contoh:

    🛒 Kelontong

    ⭐ Direkomendasikan

    24 kategori

    320 produk

    [ Dipilih ✓ ]

------------------------------------------------------------------------

# Flow yang Direkomendasikan

    Logo

    Saberaha

    ────────────────────

    Buat Toko Baru

    Nama Toko

    ────────────────────

    Pilih Jenis Toko

    🛒 Kelontong

    🍜 Warung Makan

    📱 Kios

    🏪 Toserba

    ✨ Mulai Kosong

    ────────────────────

    Preview Template

    24 kategori

    320 produk

    Semua dapat diubah

    ────────────────────

    Akun Pemilik

    Username

    Password

    ────────────────────

    [Buat Toko]

    Sudah punya akun?

    Masuk

------------------------------------------------------------------------

# Kesimpulan

Permasalahan utama bukan pada estetika, melainkan pada **cognitive
load**. Pengguna harus membaca banyak pilihan sebelum memahami manfaat
masing-masing template.

Prioritas perbaikan:

1.  Sederhanakan tampilan pemilihan template menggunakan card/grid.
2.  Tampilkan detail template setelah dipilih (progressive disclosure).
3.  Pisahkan alur "Buat Toko" dan "Gabung sebagai Kasir".
4.  Tambahkan preview isi template agar pengguna lebih percaya diri
    sebelum membuat toko.

Perubahan tersebut akan membuat onboarding terasa lebih ringan, cepat
dipahami, dan berpotensi meningkatkan completion rate saat pendaftaran.
