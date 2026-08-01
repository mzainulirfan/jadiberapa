# Rencana Redesign Halaman Register — Notion Design System

> Dokumen perencanaan. Belum ada kode yang diubah. Tujuan: merapikan halaman
> daftar agar mengikuti `docs/DESIGN-notion.md`: warm paper canvas, white auth card,
> headline tebal, chrome tenang, satu aksen biru untuk CTA, dan sedikit karakter
> lewat sticker/accent kecil. Fokus: `app/register/page.tsx` dan
> `components/auth/register-form.tsx`.

Tanggal disusun: 2026-08-01
Status: proposal

---

## 1. Kondisi Saat Ini

Halaman register saat ini sudah fungsional, tapi secara UI/UX masih terasa seperti
form teknis:

- `app/register/page.tsx` memakai layout centered sederhana di `bg-canvas-soft`.
- Heading besar hanya `Saberaha` + subtitle `Buat akun baru`.
- `RegisterForm` langsung menampilkan semua input dalam satu kolom.
- Mode `Buat Toko Baru` / `Daftar sebagai Kasir` masih segmented pill sederhana.
- Owner mode sekarang juga menampilkan `TemplatePicker`, membuat form lebih panjang.
- Invite kasir tampil sebagai alert kecil, belum terasa sebagai konteks onboarding.
- Tidak ada visual hierarchy yang jelas antara:
  - identitas akun (`username`, `passcode`)
  - identitas toko (`Nama Toko` / `Kode Toko`)
  - setup toko (`Template toko`)

## 2. Prinsip Desain Yang Dipakai

Mengacu langsung ke `docs/DESIGN-notion.md`:

- **Canvas:** halaman pakai warm paper `{colors.canvas-soft}` (`#f6f5f4`).
- **Card:** form utama berupa white `ex-auth-form-card`, rounded `xl`, hairline,
  padding `lg`, micro shadow yang sangat lembut.
- **Typography:** headline berat, tight tracking, dekat dengan `heading-1`; body
  tetap ringan (`body-sm`/`caption`).
- **CTA:** hanya tombol daftar yang memakai `{colors.primary}`; jangan pakai warna
  sticker sebagai action.
- **Accent:** warna sticker hanya untuk ilustrasi kecil/dekoratif, bukan struktur.
- **Inputs:** tetap white, hairline, tight radius (`rounded.xs`/kecil), bukan pill.
- **Whitespace:** form dipisah per blok dengan jarak jelas, bukan semua input
  menumpuk rata.

## 3. Target UX

1. Pengguna paham dulu: “Saya membuat toko baru” atau “Saya bergabung sebagai
   kasir”.
2. Owner tidak merasa overwhelm oleh template; template terasa sebagai langkah
   setup toko, bukan field tambahan yang tiba-tiba muncul.
3. Kasir undangan langsung merasa aman: kode toko sudah dikenali dan tujuan
   bergabung jelas.
4. Register tetap cepat di mobile: satu kolom, CTA selalu jelas, form tidak
   terlihat penuh walau ada template picker.

## 4. Struktur Layout Baru

### 4.1 Page Wrapper (`app/register/page.tsx`)

Ganti tampilan centered polos menjadi auth page dengan tiga lapisan:

1. **Warm canvas full height**
   - `bg-canvas-soft`
   - padding mobile `p-4` / desktop `p-6`
   - scroll aman untuk layar kecil

2. **Brand intro atas**
   - small badge: `Mobile POS untuk warung`
   - headline: `Buka toko digital dalam menit`
   - subtitle: `Pilih template, buat akun, langsung mulai input transaksi.`
   - Pada mobile tetap singkat; jangan sampai mengalahkan form.

3. **Auth card**
   - white card `bg-canvas`, `rounded-2xl`, `border border-hairline`
   - padding `p-5` atau `p-6`
   - micro shadow: `shadow-[0_8px_24px_rgba(0,0,0,0.04)]`
   - max width tetap `max-w-sm` / opsional `max-w-md` karena template picker butuh ruang.

### 4.2 Decorative Sticker Strip

Tambahkan dekorasi kecil non-action di atas/sekitar card:

- 3–4 chip kecil warna sticker:
  - `Barang`
  - `Kasir`
  - `QRIS`
  - `Stok`
- Warna memakai `accent-purple`, `accent-teal`, `accent-orange`, `accent-sky`.
- Hanya dekoratif; tidak clickable.
- Tujuan: menambah personality Notion-style tanpa membuat form ramai.

## 5. Struktur Form Baru

### 5.1 Header Card

Di dalam auth card, sebelum form:

- Title dinamis:
  - Owner: `Buat toko baru`
  - Kasir: `Gabung sebagai kasir`
- Description dinamis:
  - Owner: `Isi detail dasar, pilih template, lalu mulai jualan.`
  - Kasir: `Lengkapi akun untuk bergabung ke toko yang mengundang Anda.`

Ini menggantikan subtitle global yang terlalu umum.

### 5.2 Mode Switch

Redesign switch `Buat Toko Baru` / `Daftar sebagai Kasir`:

- Tetap segmented, tapi lebih Notion:
  - container `bg-canvas-soft`, rounded `lg`/`xl`, padding kecil.
  - active white `bg-canvas`, hairline, micro shadow tipis.
  - label body-sm semibold.
- Jika `initialCode` ada, mode kasir default tetap aktif; owner tab boleh tetap ada
  tapi invite notice harus lebih prominent.

### 5.3 Field Grouping

Pisahkan form menjadi blok:

#### Owner Mode

1. **Detail toko**
   - label kecil `Detail toko`
   - input `Nama Toko`

2. **Template awal**
   - label `Template awal`
   - caption `Kami isi kategori dan barang contoh. Bisa diedit nanti.`
   - `TemplatePicker` dibuat lebih compact di register:
     - tampil maksimal 2–3 kartu terlihat, sisanya scroll internal atau accordion.
     - opsi `Mulai Kosong` tetap ada.

3. **Akun pemilik**
   - input `Username`
   - input `Passcode`

#### Kasir Mode

1. **Kode toko**
   - input `Kode Toko`
   - status store ditemukan dibuat sebagai card kecil:
     - found: `Akan bergabung ke "Nama Toko"`
     - empty: `Minta kode toko ke pemilik.`

2. **Akun kasir**
   - input `Username`
   - input `Passcode`

### 5.4 Invite Notice

Jika user membuka `/register?code=...`:

- Ganti alert sekarang menjadi card konteks di atas mode switch:
  - icon kecil `Store` atau `CheckCircle`
  - title `Undangan kasir terdeteksi`
  - desc `Kode toko sudah terisi. Lengkapi akun untuk bergabung.`
- Warna tetap white/hairline; jangan pakai primary fill.

### 5.5 CTA & Footer Link

- Primary button full-width pill tetap:
  - Owner: `Buat toko`
  - Kasir: `Gabung toko`
  - Loading owner: `Membuat akun...`
  - Loading kasir: `Bergabung...`
- Footer link: `Sudah punya akun? Masuk`
  - letakkan di bawah card, bukan di dalam form.
  - link warna primary.

## 6. Template Picker Adjustment

`TemplatePicker` saat ini bagus untuk onboarding dashboard, tapi di register bisa
terasa panjang. Untuk mode register:

- Tambahkan prop/variant: `variant="compact" | "stack"`.
- Compact register:
  - kartu lebih pendek (`p-2.5`)
  - deskripsi max 1 baris (`line-clamp` atau `truncate`)
  - count barang tetap kecil (`20 barang contoh`)
  - mungkin tampil sebagai 2-column mini cards pada lebar `sm`, single column mobile.
- Dashboard onboarding boleh tetap card detail seperti sekarang.

## 7. Copywriting

Gunakan copy pendek dan praktis:

- Hero eyebrow: `Mobile POS UMKM`
- Hero headline: `Mulai toko tanpa setup ribet`
- Hero body: `Pilih template, buat akun, dan barang contoh langsung siap diedit.`
- Owner title: `Buat toko baru`
- Owner desc: `Template akan mengisi kategori dan barang awal.`
- Kasir title: `Gabung sebagai kasir`
- Kasir desc: `Masukkan kode toko dari pemilik.`
- Error tetap singkat: `Username sudah terdaftar`, `Kode toko tidak ditemukan`.

## 8. Implementation Plan

### Fase 1 — Layout Shell

- Edit `app/register/page.tsx`:
  - warm canvas full height
  - intro block + sticker chips
  - auth card wrapper
  - footer login link rapih

### Fase 2 — Form Hierarchy

- Edit `components/auth/register-form.tsx`:
  - card header dinamis
  - mode switch refinement
  - group labels (`Detail toko`, `Template awal`, `Akun pemilik`, dll.)
  - invite notice redesign
  - CTA label dinamis

### Fase 3 — Template Picker Compact Variant

- Edit `components/templates/template-picker.tsx`:
  - `variant` atau perluas `compact`
  - register compact lebih pendek
  - dashboard onboarding tetap informatif

### Fase 4 — Polish & States

- Error message jadi card/text kecil yang konsisten.
- Loading button label sesuai mode.
- Pastikan keyboard/mobile tidak membuat CTA sulit terlihat.

### Fase 5 — Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- Manual check:
  - owner tanpa template kosong
  - owner dengan template kelontong
  - kasir dengan invite code
  - kasir manual kode salah/benar
  - layar mobile sempit

## 9. Acceptance Criteria

- Register terasa seperti auth card Notion: warm background, white card, calm chrome.
- Satu primary CTA biru; warna sticker hanya dekorasi.
- Owner flow jelas: detail toko → template → akun.
- Kasir flow jelas: kode toko → akun.
- Template picker tidak membuat register terasa terlalu panjang.
- Invite code terlihat sebagai konteks onboarding, bukan alert generic.
- Build dan lint lulus.

## 10. Risiko & Catatan

- Jangan membuat page terlalu marketing sehingga form terdorong jauh ke bawah di mobile.
- Jangan memakai dark hero band penuh di register; design system menyebut dark indigo sebagai satu hero moment, tapi auth page lebih cocok warm paper.
- Jangan mengganti perilaku auth/template yang baru saja dibuat; redesign hanya layout/copy/styling.
- `TemplatePicker` dipakai juga oleh dashboard onboarding, jadi perubahan compact harus backward-compatible.
