# Rencana Landing Page & Onboarding — Saberaha

> Dokumen perencanaan. Tanggal disusun: 2026-08-02. **Status: rencana** — belum
> dieksekusi. Sasaran: membuka akses publik di `/` (saat ini langsung redirect ke
> `/dashboard`) dan memuluskan alur pengguna baru dari daftar → toko pertama →
> transaksi pertama. **Bukan** arah full-SaaS (belum menyentuh billing/paket).

---

## 1. Latar belakang & masalah

Saberaha sudah punya fitur lengkap (kasir, produk, stok, satuan/varian, pembeli,
utang, diskon, pembelian supplier, pengeluaran, laporan+ekspor, shift, struk
Bluetooth, offline PWA, loyalitas, multi-toko, peran owner/kasir), tapi:

- **Tidak ada landing page.** `app/page.tsx` hanya `redirect("/dashboard")`.
  Siapa pun yang membuka `saberaha.app` (atau domain lain) langsung dilempar ke
  halaman login — tidak ada penjelasan produk, nilai jual, atau cara mulai.
- **Tanpa penjelasan, calon pengguna tidak tahu** kenapa harus pakai Saberaha,
  fitur apa saja yang ada, dan langkah memulai.
- **Onboarding pasca-daftar minim**: setelah toko dibuat, pengguna langsung masuk
  dashboard kosong tanpa panduan; banyak yang bingung "mulai dari mana" (padahal
  sudah ada FAQ di `/bantuan`).

Tujuan: halaman `/` yang **memperkenalkan produk & mengarahkan ke daftar**, plus
alur **from-zero-to-first-transaction** yang terpandu — dengan biaya rendah (UI +
konten), tanpa menyentuh data/backend.

---

## 2. Prinsip

1. **Landing = pintu depan, bukan aplikasi.** Halaman `/` publik, statis,
   dioptimalkan untuk: jelaskan → buktikan → ajak daftar. Tidak memakai data toko.
2. **Tetap satu aplikasi (SPA/PWA).** Tidak membuat situs terpisah; `/` hanyalah
   halaman publik di app yang sama, memakai design system yang ada.
3. **Autentikasi-aware**: pengguna yang sudah login yang membuka `/` tetap diarahkan
   ke `/dashboard` (tidak melihat landing lagi).
4. **Fokus ke orang yang kurang teknis** (pemilik warung/UMKM): bahasa sederhana,
   singkat, visual, tanpa jargon.
5. **Bisa dikerjakan bertahap & tanpa risiko**: murni halaman + komponen + konten,
   tidak ada migrasi SQL/RLS/query.
6. **Copywriting yang sudah ada jadi sumber kebenaran**: tagline "Kasir warung &
   UMKM", istilah menu yang dipakai aplikasi (Kasir, Barang, Pembeli, Utang,
   Laporan, Cadangan Data, dll).

---

## 3. Halaman landing `/`

### 3.1 Struktur (atas → bawah)

1. **Navbar** (sticky): logo Saberaha + tagline; kanan: "Masuk" (`/login`) + CTA
   "Buat Toko Gratis" (`/register`).
2. **Hero**: headline singkat & jelas ("Kasir online untuk warung & UMKM."),
   sub-headline menyebut keunggulan inti (mudah, jalan offline, ada struk, laporan),
   CTA utama "Buat Toko Gratis" + CTA sekunder "Lihat Cara Pakai" (`/bantuan`).
3. **Social proof / angka** (opsional, jika ada data): "X toko, Y transaksi".
4. **"Cara mulai" (3 langkah)**: 1) Buat akun & toko (pilih template isi awal),
   2) Tambah barang / undang kasir, 3) Mulai jualan & lihat laporan.
5. **Fitur utama** (grid kartu, pilih ~6–8 dari yang benar-benar ada):
   - Kasir cepat (cari/barcode, diskon, metode bayar tunai/QRIS/DANA/utang).
   - Jalan **offline** (PWA) + sinkron otomatis.
   - Produk: kategori, varian/ukuran, satuan (dus/lusin), stok & opname.
   - Pembeli, **utang/kasbon**, diskon & promo.
   - **Shift kasir** & peran owner/kasir.
   - Pembelian supplier & pengeluaran.
   - **Laporan + ekspor** (CSV/Excel/PDF/share WA).
   - **Struk Bluetooth** & cadangan data.
6. **Screenshot/visual** (opsional): 1–3 tangkapan layar dashboard/kasir.
7. **FAQ singkat** (5–6 pertanyaan teratas, link "Lihat semua" → `/bantuan`).
8. **CTA akhir**: "Siap mulai? Buat toko Anda sekarang." → `/register`.
9. **Footer**: brand, tautan (Masuk, Daftar, Bantuan), versi aplikasi.

### 3.2 Routing

- `/` → halaman landing publik (server component). Bila sesi aktif → redirect
  `/dashboard` (pola sama seperti `/login` saat sudah login).
- Tidak mengubah `/login`, `/register`, `/bantuan`.

### 3.3 Copy (draf awal)

- Headline hero: **"Kasir online untuk warung & UMKM."**
- Sub: "Catat jualan, stok, utang, dan laporan — dari HP, bahkan saat offline."
- CTA utama: **"Buat Toko Gratis"**; CTA sekunder: "Lihat Cara Pakai".

---

## 4. Onboarding pasca-daftar

Alur saat ini sudah ada (register → pilih template → toko aktif → `/dashboard`).
Yang diperkuat:

1. **Welcome / checklist pertama kali** di dashboard (owner baru):
   - [ ] Tambah barang pertama (→ `/products`)
   - [ ] Undang kasir / salin kode toko (→ `/staff`, `/more`)
   - [ ] Aktifkan loyalitas / diskon (→ `/settings`, `/discounts`)
   - Check item → hilang dari list (state lokal / selesai setelah aksi dilakukan).
2. **Empty-state berbantuan**: halaman Barang & Kategori saat kosong → tombol
   "Tambah Barang" + tautan FAQ "Cara membuat barang".
3. **Konsistensi modal "Belum Punya Toko"** (sudah dibuat): tetap menawarkan
   "Buat Toko" / "Keluar".
4. Tidak ada perubahan alur daftar/kasir yang sudah berjalan.

---

## 5. Desain & komponen

- Pakai design system yang ada: canvas/canvas-soft, ink/hairline, **primary blue
  hanya untuk CTA**, ikon lucide yang sama, radius & shadow yang sama.
- Reuse: `AuthBrand`, `Button`, `FaqLink`/`faq-view`, ikon dari `components/ui/icons.tsx`.
- Komponen baru (client bila perlu interaksi, server bila statis):
  - `components/landing/landing-page.tsx` — orkestrator konten landing.
  - `components/landing/hero.tsx`, `feature-grid.tsx`, `how-it-works.tsx`,
    `faq-teaser.tsx`, `footer.tsx` (boleh digabung bila kecil).
  - `components/dashboard/welcome-checklist.tsx` — checklist onboarding owner.
- Konten teks: `lib/landing/content.ts` (struktur, copy, feature list) agar mudah
  dirawat & diuji, mengikuti pola `lib/faq/content.ts`.

---

## 6. Implementasi (file)

**File baru:**
- `app/page.tsx` — ganti redirect jadi render landing (server, cek sesi).
- `lib/landing/content.ts` — data landing (hero, langkah, fitur, FAQ teaser, footer).
- `components/landing/*` — komponen UI landing.
- `components/dashboard/welcome-checklist.tsx` — checklist owner baru.
- `lib/__tests__/landing.test.ts` — uji struktur konten.

**File diubah:**
- `app/(main)/dashboard/page.tsx` — pasang `WelcomeChecklist` (kondisi role owner
  & toko baru).
- `components/products/*` (empty-state) — tambah bantuan bila perlu.
- `components/ui/icons.tsx` — tambah ikon bila kurang.

**Tidak ada:** migrasi SQL, RPC, perubahan query/RLS/backup.

---

## 7. Pengujian

- Unit test `landing.test.ts`: struktur konten valid (hero non-kosong, tiap fitur
  ada ikon+judul+deskripsi, langkah berurutan, link mengarah route yang ada).
- Manual smoke: `/` tampil saat logout, redirect `/dashboard` saat login; CTA ke
  `/register` & `/login`; checklist muncul sekali & hilang saat selesai; landing
  responsive di mobile (PWA).
- `npm run lint` & `npm run build`.

---

## 8. Effort & dampak

- **Effort:** M (murni UI + konten, tanpa backend). Bisa dibagi: fase A landing
  (`/`), fase B onboarding (checklist + empty-state).
- **Dampak:** Tinggi untuk konversi pengunjung & kelancaran pengguna baru; tidak
  berisiko ke data transaksi.

---

## 9. Perlu keputusan sebelum eksekusi

1. **Prioritas: landing dulu atau onboarding dulu?** (Rekomendasi: landing `/`
   dulu, karena menjembatani calon pengguna; onboarding bisa menyusul.)
2. **Konten landing:** perlu screenshot asli aplikasi, atau cukup ikon + deskripsi?
   (Rekomendasi: ikon + deskripsi dulu, screenshot menyusul.)
3. **Social proof (angka pengguna)**: ada datanya atau disembunyikan sementara?
4. **Bahasa**: Indonesia saja (rekomendasi), atau tambah toggle EN?
5. **Domain/nama**: apakah `/` akan diarahkan ke domain terpisah nanti, atau tetap
   di root app ini?
