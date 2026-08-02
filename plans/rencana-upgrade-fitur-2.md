# Rencana Upgrade Fitur — Saberaha (Gelombang Berikutnya)

> Dokumen perencanaan. Belum ada kode yang diubah. Disusun setelah audit kode
> nyata: seluruh roadmap PRD (V2/V3) dan seluruh fase di
> [rencana-upgrade-fitur.md](./rencana-upgrade-fitur.md) lama **sudah selesai**.
> Fokus dokumen ini adalah fitur baru bernilai tinggi yang **belum ada**.
> Bahasa & istilah mengikuti PRD (Barang, Pembeli, Simpan, dst).
>
> Tanggal disusun: 2026-08-02. Status: proposal.

---

## 1. Yang sudah ada (jangan dikerjakan ulang)

Terverifikasi di kode:

- **Offline/PWA**: service worker ([public/sw.js](../public/sw.js)) + antrean IndexedDB
  ([lib/offline/transactions.ts](../lib/offline/transactions.ts)) + auto-sync.
- **Utang/kasbon**: metode `utang`, halaman `/debts`, cicilan (`payments`).
- **Stok**: stok masuk & opname + jejak `stock_movements`
  ([lib/actions/products.ts](../lib/actions/products.ts#L197-L264)), badge stok menipis.
- **Pengeluaran**: `/expenses` + laba bersih di dashboard.
- **Diskon**: per item & per nota di checkout ([checkout-view.tsx](../components/checkout/checkout-view.tsx)).
- **Export laporan**: CSV, Excel (.xls), PDF/print, share WhatsApp
  ([reports-view.tsx](../components/reports/reports-view.tsx)).
- **Shift kasir**: `/shift` (`cash_sessions`).
- **Printer Bluetooth ESC/POS**: [lib/bluetooth-printer.ts](../lib/bluetooth-printer.ts).
- **Multi-toko & peran**: owner/kasir, ganti toko, undang kasir, hapus toko
  (migrasi `00002`/`00003`).
- **Struk publik**: `/s/[token]`.
- **Backup/restore**: `/backup` (export–import JSON).

Jadi **backlog lama pun sudah tergarap** kecuali beberapa ide di §6 dokumen lama.

---

## 2. Prinsip prioritas

1. **Dampak nyata untuk warung** dulu, bukan fitur "keren" yang jarang dipakai.
2. **Bertahap & aman** — tiap fase punya migrasi sendiri (`00004+`), bisa rilis terpisah.
3. **Jaga pola kode**: baca data via query client + cache TTL 60s; agregasi berat
   via RPC `security definer` per `current_store_id()`; uang tetap integer rupiah.
4. **Multi-toko aware**: setiap tabel baru wajib `store_id ... on delete cascade`
   + RLS `store_id = current_store_id()` (ikuti pola `00002`).

---

## 3. Roadmap bertahap (fitur baru)

### FASE A — Supplier & Pembelian (Purchase) (P1)
**Masalah:** Stok masuk saat ini hanya menaikkan angka + harga beli terakhir; tidak
ada entitas supplier maupun riwayat pembelian (siapa, kapan, berapa, utang ke siapa).

- **Kerjakan:**
  - Master **Supplier** (nama, telepon, catatan).
  - **Pembelian (PO/nota beli)**: banyak item sekaligus, total, tautkan supplier,
    otomatis menambah stok & mencatat `stock_movements` type `in`.
  - **Utang ke supplier** (hutang dagang) + pelunasan — mirror dari `/debts`.
  - Ringkas: nilai pembelian & utang supplier di laporan.
- **DB (migrasi `00004`):** `suppliers`, `purchases`, `purchase_items`,
  `supplier_payments` (semua `store_id` + RLS + cascade).
- **Effort:** L. **Dampak:** Tinggi (akurasi modal & arus kas).

### FASE B — Analitik Lanjutan & Saran Restock (P1)
**Masalah:** Laporan sudah baik, tapi belum ada insight aksi (produk paling
menguntungkan, jam sibuk, barang yang perlu dibeli lagi).

- **Kerjakan:**
  - **Margin per produk** (laba absolut & %), produk rugi/mendekati modal.
  - **Jam & hari sibuk** (heatmap sederhana dari `transactions.created_at`).
  - **Saran restock**: barang dengan laju jual tinggi + stok mendekati `min_stock`.
  - **Barang mati** (tidak terjual N hari).
- **DB:** tanpa tabel baru; tambah **RPC agregasi** (pola `get_reports`).
- **Effort:** M. **Dampak:** Menengah–tinggi.

### FASE C — Loyalitas & Follow-up Pembeli (P2)
**Masalah:** Sudah ada data pembeli & utang, tapi belum ada retensi.

- **Kerjakan:**
  - **Poin/loyalitas** sederhana (mis. 1 poin / kelipatan belanja) + tukar poin
    jadi diskon di checkout.
  - **Follow-up WhatsApp** dari halaman pembeli/utang (link `wa.me` berisi
    template pesan pengingat utang / promo) — tanpa integrasi API, cukup deep link.
- **DB (migrasi `00005`):** `customers.points integer default 0`
  (+ opsional `loyalty_ledger` untuk jejak). Setting rasio poin.
- **Effort:** M. **Dampak:** Menengah.

### FASE D — Satuan & Konversi (Bulk/Eceran) (P2)
**Masalah:** Warung sering jual per **lusin/dus** dan **eceran** dari barang sama;
kini tiap satuan harus jadi produk terpisah.

- **Kerjakan:**
  - Definisi **satuan turunan** per produk (mis. 1 dus = 12 pcs) + harga jual
    per satuan; kasir memilih satuan saat menambah ke keranjang.
  - Pengurangan stok dikonversi ke satuan dasar.
- **DB (migrasi `00006`):** `product_units` (product_id, name, factor, price_sell).
  Perlu penyesuaian di kasir/checkout & `stock_movements`.
- **Effort:** L. **Dampak:** Menengah (tergantung jenis toko).

### FASE E — Keamanan Akun & Kualitas (P2, lintas-fitur)
**Masalah:** Auth username+passcode 4–6 digit; belum ada ganti passcode/pemulihan,
dan belum ada uji otomatis untuk alur kritis.

- **Kerjakan:**
  - **Ganti passcode** (dari Pengaturan) + **reset passcode kasir oleh owner**.
  - **Kunci layar cepat** (re-entry passcode) untuk perangkat bersama di kasir.
  - **Uji dasar**: unit test util perhitungan (diskon/PPN/kembalian) + smoke test
    alur checkout & sinkron offline.
- **DB:** minimal; sebagian besar via Supabase Auth admin RPC / server action.
- **Effort:** M. **Dampak:** Menengah (kepercayaan & stabilitas).

---

## 4. Urutan yang disarankan

1. **Fase A (Supplier & Pembelian)** — melengkapi sisi modal/arus kas yang masih
   kosong; pasangan alami dari fitur stok & utang yang sudah ada.
2. **Fase B (Analitik & Saran Restock)** — memanfaatkan data yang sudah terkumpul,
   effort sedang, tanpa migrasi besar.
3. **Fase C (Loyalitas & WA)** — retensi pembeli.
4. **Fase D (Satuan/Konversi)** — untuk toko yang butuh bulk/eceran.
5. **Fase E (Keamanan & uji)** — dikerjakan menyisip antar fase.

---

## 5. Catatan teknis (jaga konsistensi)

- Migrasi lanjut dari **`00004_*`** ke atas; agregasi berat via **RPC**.
- Tiap tabel baru: `store_id uuid not null references stores(id) on delete cascade
  default current_store_id()` + RLS `using (store_id = current_store_id())` +
  index `store_id` (ikuti pola loop di `00002`).
- **Backup**: setiap tabel baru **wajib** ditambahkan ke bundle
  ([lib/backup/types.ts](../lib/backup/types.ts), [backup-view.tsx](../components/backup/backup-view.tsx),
  `clearStoreData`/`restoreStoreBackup`) agar export/restore tetap lengkap.
- **Hapus toko**: tabel baru otomatis ikut cascade; tidak perlu ubah RPC
  `delete_current_store`. Jika menyimpan file (mis. foto supplier), tambahkan
  pembersihan Storage di [lib/actions/stores.ts](../lib/actions/stores.ts).
- UI: patuhi Notion Design System (canvas-soft, primary blue hanya CTA,
  micro-shadow); sertakan empty state, skeleton, dan toast `sonner`.
- Uang **integer** rupiah, format `id-ID`.

---

## 6. Perlu keputusan sebelum eksekusi

1. **Fase mana yang dijadikan prioritas pertama?** (rekomendasi: Fase A).
2. **Kedalaman Fase A:** cukup "stok masuk + supplier + utang supplier", atau
   sampai PO bertahap (draft → terima sebagian)?
3. **Loyalitas (Fase C):** perlu poin ber-ledger, atau cukup angka poin sederhana
   di `customers`?

> Setelah satu fase dipilih, saya buat rencana implementasi rinci (migrasi, RPC,
> query, UI, backup, pengujian) khusus fase itu — pola sama seperti
> [rencana-hapus-toko.md](./rencana-hapus-toko.md).
