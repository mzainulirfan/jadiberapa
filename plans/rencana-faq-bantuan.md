# Rencana Fitur FAQ / Pusat Bantuan — Saberaha

> Dokumen perencanaan. Tanggal disusun: 2026-08-02. **Status: terimplementasi** —
> halaman `/bantuan` publik + entri di menu More & halaman auth, konten statis
> (`lib/faq/content.ts`), pencarian & accordion, deep-link, dan unit test struktur
> (lib/__tests__/faq.test.ts) sudah dibuat dan ter-commit.

---

## 1. Latar belakang & masalah

Saberaha makin lengkap (multi-toko, utang, stok, supplier, laporan, loyalitas,
satuan, keamanan), tapi **tidak ada panduan dalam aplikasi**. Pengguna baru
(terutama pemilik warung yang kurang teknis) sering bingung:

- Bagaimana mulai: buat toko, pilih kategori contoh, undang kasir?
- Bedanya pemilik vs kasir, dan fitur mana yang bisa dilihat siapa.
- Di mana membuat produk/kategori/pembeli/diskon.
- Cara pakai utang, shift, struk, offline, backup, ganti passcode.

Tujuan FAQ: pengguna **bisa menjawab sendiri** langkah demi langkah, dengan
**tautan langsung ke halaman yang dimaksud** (deep-link), tanpa perlu menghubungi
dukungan.

---

## 2. Prinsip

1. **Konten statis, bukan database.** FAQ adalah global (bukan milik satu toko),
   sehingga cukup file konten `ts`/`md` — tidak perlu migrasi Supabase, tidak perlu
   RLS, tidak ikut backup. Cepat dibangun & mudah dirawat.
2. **Satu sumber kebenaran konten** di `lib/faq/content.ts` (atau `.tsx` agar bisa
   menyisipkan ikon/link).
3. **Setiap jawaban sedekat mungkin dengan layar nyata**: sebut menu → langkah →
   tombol, lalu tautan "Buka halaman X" yang menuju route yang ada.
4. **Bisa diakses di dua momen**: sebelum login (halaman masuk/daftar) dan sesudah
   login (menu More) — karena pengguna baru paling butuh bantuan saat pertama kali.
5. **Murah & tanpa risiko**: tidak menyentuh transaksi/stok; hanya halaman + konten.

---

## 3. Struktur konten FAQ

Konten dibagi **4 kelompok**. Daftar pertanyaan di bawah ini **contoh isi awal**
(disusun dari fitur yang benar-benar ada di aplikasi); bisa ditambah/dirapikan saat
eksekusi.

### 3.1 Cara Mulai

1. **Cara membuat akun & toko (Pemilik)**
   - Buka halaman daftar → isi nama pengguna (username) → pilih passcode 4–6 digit
     → beri nama toko.
   - Pilih **template kategori** (mis. Sembako, Warung, Kopi, Kebutuhan, dll) yang
     langsung membuat kategori + beberapa produk contoh, atau pilih "kosong" untuk
     mulai dari nol.
   - Setelah selesai, toko langsung aktif dan bisa dipakai kasir.
2. **Cara bergabung sebagai kasir**
   - Pemilik menyalin **kode toko** (More → "Salin kode toko aktif").
   - Kasir pilih "Gabung sebagai Kasir" di halaman daftar, masukkan kode toko +
     akun sendiri.
3. **Cara login**
   - Masukkan username dan passcode 4–6 digit. Tidak ada email/password panjang.
4. **Lupa passcode**
   - Kasir: minta pemilik mereset passcode (More → Kelola Kasir → ikon kunci).
   - Pemilik: tidak ada self-recovery saat ini; kontak dukungan (catatan: bisa jadi
     langkah lanjutan).
5. **Punya lebih dari satu toko**
   - More → "Toko Aktif" untuk berpindah toko. Fitur pemilik vs kasir tampil
     berbeda per peran.

### 3.2 Kelola Toko & Data

1. **Cara membuat barang/produk**
   - Kasir/Barang → "+" → isi nama, harga beli & jual, stok awal, kategori,
     satuan dasar (pcs/gram/dll), opsional varian (ukuran/rasa) & SKU/barcode.
2. **Cara membuat kategori**
   - More → Kategori → "+" (atau otomatis dibuat via template saat registrasi).
3. **Cara menjual satuan besar (dus/lusin)**
   - Di form barang, tambahkan satuan turunan (mis. 1 dus = 12 pcs + harga jual
     dus). Saat kasir menambah ke keranjang, muncul pilihan satuan.
4. **Cara menambah pembeli (pelanggan)**
   - More → Pembeli → "+" → nama + nomor HP (dipakai utang & follow-up WA).
5. **Cara membuat diskon/promo**
   - More → Diskon → "+". Diskon juga bisa diberi per item/per nota di layar
     pembayaran.
6. **Cara mencatat stok masuk & opname**
   - Barang → detail → stok masuk/opname; jejak tercatat otomatis.
7. **Cara mencatat pembelian dari supplier & utang supplier**
   - More → Pembelian → nota beli baru → pilih supplier → isi item → total.
8. **Cara mencatat pengeluaran operasional**
   - More → Pengeluaran → "+" (mempengaruhi laba bersih di dashboard).

### 3.3 Transaksi & Kasir

1. **Cara mencatat penjualan**
   - Halaman Kasir: pilih barang (pencarian/barcode) → pilih pembeli (opsional)
     → Bayar → pilih metode (tunai, QRIS, DANA, utang) → Simpan.
2. **Cara kasbon (utang pembeli) & pelunasan**
   - Di pembayaran pilih "Utang", atau kelola di More → Utang.
3. **Cara buka/tutup shift**
   - More → Shift Kasir: buka laci, hitung kas di akhir, selisih tercatat.
4. **Cara cetak struk (printer Bluetooth)**
   - Di halaman pembayaran, tombol cetak → hubungkan printer ESC/POS.
5. **Aplikasi dipakai tanpa internet?**
   - Saberaha jalan offline (PWA) — transaksi masuk antrean & sinkron otomatis saat
     online.
6. **Poin loyalitas pembeli**
   - Setting toko → aktifkan loyalitas → atur rasio poin; pembeli menukar poin saat
     checkout.

### 3.4 Laporan, Data & Keamanan

1. **Cara lihat laporan & export**
   - More → Laporan: penjualan/keuntungan, export CSV/Excel/PDF/print/share WA.
2. **Cara backup & pulihkan**
   - More → Cadangan Data → export file; pada perangkat baru, import file tersebut.
3. **Cara kunci layar cepat**
   - More → "Kunci Layar" → buka dengan passcode (untuk perangkat bersama di kasir).
4. **Cara ganti passcode**
   - More → "Ganti Passcode" → passcode lama → passcode baru.
5. **Cara hapus toko**
   - Pengaturan → hapus toko (menghapus seluruh data toko, tidak bisa dibatalkan).

---

## 4. Desain halaman

- **Route:** `/bantuan` (mudah diingat & di-link).
- **Layout:** list kelompok → tiap kelompok berisi kartu pertanyaan (accordion);
  tap pertanyaan → jawaban + tombol **"Buka halaman X"** (deep-link) bila relevan.
- **Pencarian:** input sederhana yang memfilter pertanyaan (kasih placeholder
  "Cari bantuan…") — cukup client-side, tidak perlu API.
- **Empty state** kalau pencarian tak ada hasil.
- **Entri akses:**
  - Sesudah login: menu **More → Aplikasi → "Bantuan & FAQ"** (ikons `Help`).
  - Sebelum login: tautan kecil "Butuh bantuan?" di halaman `/login` & `/register`
    dan di `AuthBrand`.
- **UI:** patuhi Notion Design System yang sudah dipakai (canvas-soft, primary
  blue hanya CTA, border hairline, ikon lucide yang sama).
- Tidak butuh skeleton (konten statis) kecuali struktur kelompok di-render
  kondisi peran.

---

## 5. Implementasi

### Opsi yang dipilih: konten statis (tanpa DB)

**File baru:**
- `lib/faq/content.tsx` — data FAQ ber-tipe (`FaqGroup[]`): `{ id, title, icon,
  items: [{ q, a, href? }] }`; jawaban boleh berisi `ReactNode` untuk format tebal
  & link.
- `components/faq/faq-view.tsx` — tampilan `/bantuan` (pencarian + accordion +
  deep-link).
- `app/bantuan/page.tsx` — route (server component tipis, render `FaqView`).
- `components/faq/faq-link.tsx` — tautan "Butuh bantuan?" kecil untuk halaman auth.

**File diubah:**
- `components/more/more-view.tsx` — tambah menu "Bantuan & FAQ" di grup Aplikasi
  (owner & kasir).
- `components/auth/register-form.tsx` & `app/login/page.tsx` — tambah tautan
  bantuan.
- `components/ui/icons.tsx` — tambah ikon `HelpCircle` (kalau belum ada).

**Tidak ada:**
- migrasi SQL, RPC, perubahan query/backup/RLS — FAQ tidak menyentuh data toko.

---

## 6. Pengujian

- Unit test kecil untuk `lib/faq/content.tsx`: struktur valid (semua `q` & `a`
  non-kosong, `href` mengarah route yang ada di daftar route).
- Manual smoke: `/bantuan` ter-render, pencarian memfilter, accordion terbuka,
  deep-link pindah ke halaman tujuan, tautan bantuan muncul di login/register.
- Jalankan `npm run lint` & `npm run build`.

---

## 7. Effort & dampak

- **Effort:** S–M (murni UI + konten, tanpa backend).
- **Dampak:** Menengah-tinggi untuk on-boarding; menurunkan pertanyaan berulang
  dari pemilik baru; tidak berisiko ke data.

---

## 8. Perlu keputusan sebelum eksekusi

1. **Bahasa jawaban:** cukup Bahasa Indonesia, atau perlu Inggris (toggle)?
   (Rekomendasi: Indonesia dulu.)
2. **Kedalaman konten:** daftar di §3 sudah cukup, atau perlu sub-artikel panjang
   (mis. satu halaman tutorial per fitur)?
3. **Dukungan lanjutan:** FAQ statis saja, atau tambah "Hubungi kami"
   (link WhatsApp/email) di bagian bawah?
4. **Prioritas:** dikerjakan sekarang atau setelah fase lain di
   [rencana-upgrade-fitur-2.md](./rencana-upgrade-fitur-2.md)?

> Setelah keputusan diambil, saya buat rencana implementasi rinci pola sama seperti
> [rencana-hapus-toko.md](./rencana-hapus-toko.md), atau langsung eksekusi bila
> lingkupnya sudah jelas.
