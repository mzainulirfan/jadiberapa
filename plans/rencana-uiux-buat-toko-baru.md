# Rencana Implementasi: Perbaikan UI/UX Halaman "Buat Toko Baru"

> Berdasarkan dokumen `Review_UI_UX_Halaman_Buat_Toko_Baru_Saberaha.md`.
> Tanggal disusun: 2026-08-02
> Status: proposal (belum ada kode diubah)

---

## 0. Temuan penting sebelum mulai

Sebagian besar rekomendasi review **sudah terimplementasi** di kode saat ini.
Halaman register berada di:

- `app/register/page.tsx` — wrapper (brand + kartu form).
- `components/auth/register-form.tsx` — form utama (owner & kasir).
- `components/templates/template-picker.tsx` — grid kartu template.
- `lib/templates/options.ts` — data opsi template untuk UI.

Rencana ini **hanya menutup gap** yang belum sesuai review, bukan menulis ulang.

### Status tiap rekomendasi review

| # | Rekomendasi review | Status | Tindakan |
|---|---|---|---|
| 1 | Urutan form natural (Nama → Template → Preview → Akun → CTA) | Sudah | — |
| 2 | Ganti istilah "Template Awal" → "Mulai dengan" + deskripsi | Sudah | — |
| 3 | Card/grid untuk template | Sudah (grid 2 kolom) | — |
| 4 | Progressive disclosure (preview muncul setelah pilih) | Sebagian | **Gap A** |
| 5 | Jelaskan isi template (list kategori + "+N lainnya") | Sebagian | **Gap B** |
| 6 | Urutan form alternatif | Sudah | — |
| 7 | Pisahkan "Buat Toko" vs "Gabung sebagai Kasir" | Sebagian | **Gap C** |
| 8 | Judul section akun ("Akun pemilik") | Sudah | — |
| 9 | Perkuat CTA | Sudah ("Buat Toko & Akun") | Opsional |
| 10 | Perjelas state template terpilih (border, badge, ringkasan) | Sebagian | **Gap D** |

---

## 1. Ruang lingkup (gap yang dikerjakan)

### Gap A — Progressive disclosure preview
Saat ini panel preview di [register-form.tsx](../components/auth/register-form.tsx#L149-L172)
selalu tampil. Review meminta detail muncul **setelah** template dipilih.

**Rencana:** Karena selalu ada template default (`kelontong`), preview tidak
pernah kosong — jadi "muncul setelah pilih" bisa diwujudkan sebagai **transisi/
penegasan** bukan menyembunyikan. Opsi:
- Biarkan panel tampil (default terpilih), tetapi tambah animasi halus saat
  ganti pilihan agar terasa responsif.
- Alternatif lebih ketat: default tidak terpilih (`templateKey = ""`), panel
  preview & tombol submit dikunci sampai user memilih. **Perlu keputusan** (lihat §4).

### Gap B — Preview isi template lebih kaya
Panel sekarang menampilkan jumlah kategori, jumlah produk, dan kategori
dipisah "·". Review meminta gaya checklist + "+N kategori lainnya".

**Rencana:** Ubah blok preview di [register-form.tsx](../components/auth/register-form.tsx#L149-L172):
- Tampilkan maksimal ~5 kategori pertama dengan ikon centang.
- Jika lebih, tampilkan "+N kategori lainnya".
- Pertahankan baris ringkas "≈X produk contoh".

### Gap C — Pemisahan visual "Buat Toko" vs "Gabung Kasir"
Saat ini peralihan mode lewat link teks kecil di bawah form
([register-form.tsx](../components/auth/register-form.tsx#L250-L255)).
Review meminta pemisah jelas: form utama, garis pemisah, lalu ajakan sekunder.

**Rencana:** Pada mode owner, ganti footer link menjadi blok sekunder ber-`border-t`:
> Sudah punya toko? → **Gabung sebagai Kasir**

Buat kontras dengan CTA utama (tautan/tombol ghost, bukan primary).

### Gap D — State terpilih & ringkasan per-card
`TemplatePicker` sudah punya border+ring+bg+check+badge "Direkomendasikan"
([template-picker.tsx](../components/templates/template-picker.tsx#L35-L65)).
Yang belum: ringkasan singkat (jumlah kategori/produk) di dalam tiap card mode compact.

**Rencana:** Tambahkan baris meta kecil (mis. "20 produk") pada card compact,
menggunakan `productCount` dari `storeTemplateOptions`. Jaga tinggi card tetap rapi.

### (Opsional) CTA
CTA "Buat Toko & Akun" sudah kuat. Jika diinginkan, seragamkan dengan salah satu
usulan review ("Buat Toko Sekarang"). Tidak wajib.

---

## 2. Perubahan file (ringkas)

1. `components/auth/register-form.tsx`
   - Blok preview (Gap B): render daftar kategori bercentang + "+N lainnya".
   - Footer (Gap C): pemisah + ajakan "Gabung sebagai Kasir" pada mode owner.
   - (Gap A, jika opsi ketat dipilih): default `templateKey` kosong + guard submit.

2. `components/templates/template-picker.tsx`
   - Gap D: baris meta jumlah produk pada card compact.

3. Tidak ada perubahan DB, server action, atau data template.
   Logika `applyStoreTemplate` / `template_key` di signup tetap.

---

## 3. Rencana kerja bertahap

1. **Gap D** (paling kecil, terisolasi) — meta count di card `TemplatePicker`.
2. **Gap B** — perkaya panel preview (checklist kategori + "+N lainnya").
3. **Gap C** — pemisah & ajakan sekunder mode owner.
4. **Gap A** — keputusan progressive disclosure (default kosong vs animasi).
5. **(Opsional)** teks CTA.
6. **Verifikasi:** `tsc --noEmit` + lint + build; cek visual mode owner & kasir
   di viewport mobile.

---

## 4. Keputusan yang diperlukan (Gap A)

Pilih perilaku pemilihan template:

- **A1 — Tetap ada default `kelontong` (rekomendasi):** form langsung siap
  submit, preview selalu terisi; "progressive disclosure" diwujudkan lewat
  transisi halus saat ganti pilihan. Paling ringan & tidak menambah friksi.
- **A2 — Wajib pilih dulu:** `templateKey` awal kosong, panel preview & tombol
  submit terkunci sampai user memilih. Lebih sesuai teks review, tapi menambah
  satu langkah dan risiko user bingung "kenapa tombol mati".

Rekomendasi: **A1** (lebih rendah friksi, sesuai prinsip cepat di mobile).

---

## 5. Di luar ruang lingkup

- Tidak mengubah alur data template / migrasi.
- Tidak menyentuh onboarding fallback dashboard
  ([template-onboarding.tsx](../components/templates/template-onboarding.tsx)).
- Tidak mengubah flow kasir selain penataan tautan sekunder.
