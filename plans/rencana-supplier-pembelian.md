# Rencana Implementasi: Fase A — Supplier & Pembelian (Purchase)

> Sumber: `rencana-upgrade-fitur-2.md` §3 Fase A + keputusan §6 (Fase A, kedalaman
> **sederhana**: stok masuk + supplier + utang supplier, tanpa PO bertahap).
> Divalidasi dengan kode nyata. Tanggal disusun: 2026-08-02. Status: proposal.

---

## 0. Kondisi kode saat ini (temuan validasi)

- **Migrasi** terakhir `00003_store_deletion.sql` → nama baru `00004_*` sudah tepat.
- **Pola multi-toko** (temuan dari `00002_multi_store.sql`): tiap tabel bisnis punya
  `store_id uuid ... default current_store_id()` + RLS
  `store_id = current_store_id()` + index `store_id`. Loop PL/pgSQL `do $$` dipakai
  untuk memperlakukan banyak tabel sekaligus → bisa ditiru untuk 4 tabel baru.
- **Stok masuk sudah ada** (`lib/actions/products.ts` `addStock`): pakai RPC
  `increment_stock` + insert `stock_movements` type `'in'` + perbarui `price_buy`
  (harga beli terakhir). Pola yang sama dipakai untuk nota beli multi-item.
- **Utang/cicilan** (`lib/actions/transactions.ts` `createTransaction` +
  `recordPayment`): transaksi `status in ('lunas','utang')`, `paid_amount`,
  tabel `payments`, dan `getDebts`/`getPayments` di `lib/db/queries.ts`.
  Fase A mirror pola ini untuk `purchases` + `supplier_payments`.
- **RPC `security definer` per `current_store_id()`** sudah menjadi standar
  (`get_shift_summary`, `get_store_members`, `invite_kasir`, dst) — pola untuk
  `create_purchase`/`record_supplier_payment`.
- **Backup bundle** 13 tabel di `lib/backup/types.ts`, `lib/actions/backup.ts`
  (`clearStoreData` + `restoreStoreBackup`), dan `components/backup/backup-view.tsx`
  (`loadCurrentBundle`, `emptyCounts`, `countBundle`) → **4 tabel baru wajib ditambah**.
- **Menu owner/kasir** di `components/more/more-view.tsx` (`OWNER_GROUPS`) → tempat
  menambahkan "Supplier" & "Pembelian" (owner-only, ikut pola Pengeluaran/Laporan).
- **Laporan** `components/reports/reports-view.tsx` + `getReports` memanggil
  RPC `get_reports_summary` + query `expenses` terpisah → pola yang sama untuk
  menambah kartu ringkasan pembelian & utang supplier (RPC terpisah baru).
- **Halaman detail + bayar cicilan** mencontoh `components/transactions/transaction-detail.tsx`
  (dialog "Catat Pembayaran", riwayat pembayaran, status badge).
- **Ikon** yang tersedia di `components/ui/icons.tsx`: `Package`, `Receipt`,
  `Dollar`, `Wallet`, `Store`, `ShoppingBag`, `Tag`. Tidak ada ikon truck →
  reuse `Package` (Pembelian) & `Receipt` (Supplier) agar tanpa tambah aset.

### Isu yang mempengaruhi desain

1. **Atomisitas nota beli.** Membuat pembelian harus **satu RPC**
   (`create_purchase`), bukan rangkaian server action, agar insert nota + item +
   naik stok + harga beli + `stock_movements` + DP terjadi dalam satu transaksi —
   tidak ada keadaan setengah jadi saat salah satu langkah gagal.
2. **Hapus supplier ≠ hapus riwayat.** `purchases.supplier_id` memakai
   `on delete set null` supaya nota beli & utang historis tetap ada. Stok yang
   sudah masuk **tidak** di-rollback saat supplier dihapus.
3. **Owner-only.** Supplier/pembelian/utang supplier adalah pengelolaan modal &
   arus kas → guard `isOwner()` di server action (meniru `expenses.ts`), menu
   hanya di `OWNER_GROUPS`. Kasir tidak melihat dan aksinya ditolak RLS+guard.
4. **Pembelian online-only untuk v1.** Tidak masuk antrean IndexedDB offline
   (berbeda dari transaksi penjualan). Frekuensi restock rendah; antrean offline
   untuk pembelian dicatat sebagai perbaikan masa depan.

---

## 1. Aturan bisnis (ringkas)

- Hanya **owner toko aktif** yang mengelola supplier, membuat pembelian, dan
  mencatat pelunasan utang supplier.
- **Pembelian** = sekumpulan item (produk × qty × harga beli) dari 1 supplier.
  Menaikkan stok produk (`stock += qty`), memperbarui `price_buy` produk ke harga
  beli **terakhir**, dan mencatat `stock_movements` type `'in'` (catatan "Pembelian").
- **Utang supplier** mirror utang pembeli: `purchases.paid_amount` +
  `purchases.status ('lunas'/'utang')` + tabel `supplier_payments` (cicilan/pelunasan).
- Pembelian boleh dibayar penuh, DP, atau murni utang (0).
- `number` nota beli format `PB-XXXXXXXX` (unik per toko, mirip `transactions.number`).
- Uang tetap **integer rupiah**, format `id-ID`.

---

## 2. Migrasi DB — `supabase/migrations/00004_suppliers_purchases.sql`

### 2.1 Tabel baru (semua `store_id` + RLS + index, ikuti pola `00002`)

```
suppliers (
  id uuid pk default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade default current_store_id(),
  name text not null,
  phone text,
  note text,
  created_at timestamptz not null default now()
)

purchases (
  id uuid pk default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade default current_store_id(),
  number text not null,
  supplier_id uuid references suppliers(id) on delete set null,
  total integer not null default 0,
  paid_amount integer not null default 0,
  status text not null default 'lunas' check (status in ('lunas','utang')),
  note text,
  user_id uuid references auth.users(id) on delete set null,
  cashier_name text,
  created_at timestamptz not null default now()
)

purchase_items (
  id uuid pk default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade default current_store_id(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty integer not null,
  price_buy integer not null default 0,
  subtotal integer not null default 0,
  created_at timestamptz not null default now()
)

supplier_payments (
  id uuid pk default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade default current_store_id(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  amount integer not null check (amount > 0),
  method text not null default 'cash',
  note text,
  created_at timestamptz not null default now()
)
```

Ikuti pola loop `00002` untuk: `enable row level security` semua tabel;
hapus policy lama bila ada; buat policy `store_all_<tabel>` `for all to authenticated
using (store_id = current_store_id()) with check (store_id = current_store_id())`;
buat index `idx_<tabel>_store`; lalu index tambahan:

- `purchases_supplier_idx (supplier_id)`, `purchases_status_idx (status)`.
- `purchase_items_purchase_idx (purchase_id)`, `purchase_items_product_idx (product_id)`.
- `supplier_payments_purchase_idx (purchase_id)`.
- `idx_suppliers_name_trgm (name gin_trgm_ops)` (pencarian supplier).
- `unique (store_id, number)` pada `purchases`.

### 2.2 RPC `create_purchase(p_supplier_id uuid, p_items jsonb, p_paid_amount integer default 0, p_note text default null)`

`security definer set search_path = public`. Alur:
1. `auth.uid()` null → error "Tidak ada sesi".
2. `sid := current_store_id()`; null → error "Toko aktif tidak ditemukan".
3. `p_items` bukan array / kosong → error "Pembelian minimal 1 item".
4. Loop item: validasi `qty > 0` & `price_buy >= 0`; pastikan `products.id`
   milik `sid`; kalkulasi `total += qty * price_buy`.
5. `paid := greatest(0, least(total, p_paid_amount))`.
6. Insert `purchases(number := 'PB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), ...,
   status := case when paid >= total then 'lunas' else 'utang' end, cashier_name dari email)`.
7. Insert `purchase_items` per item; `update products set stock = stock + qty,
   price_buy = <harga beli>, updated_at = now() where id = ... and store_id = sid`;
   insert `stock_movements(type 'in', qty, note 'Pembelian')`.
8. Jika `paid > 0` insert `supplier_payments(method 'cash', note 'DP')`.
9. Return `{ error, id }`.

> Semua dalam satu fungsi → atomic. `grant execute ... to authenticated`.

### 2.3 RPC `record_supplier_payment(p_purchase_id uuid, p_amount integer, p_method text default 'cash', p_note text default null)`

Mirror `recordPayment` (logika di `lib/actions/transactions.ts`):
1. Validasi sesi + `sid`; `p_amount > 0`.
2. Ambil `purchases` by id **and store_id = sid**; tak ada → error.
3. `applied := least(p_amount, greatest(0, total - paid_amount))`;
   `applied <= 0` → error "Utang sudah lunas".
4. Insert `supplier_payments`; `update purchases set paid_amount += applied,
   status := case when >= total then 'lunas' else 'utang' end`.
5. Return `{ error, paid_amount, status }`.

### 2.4 RPC `get_purchases_summary(p_from timestamptz default null, p_to timestamptz default null)`

`security definer` → `jsonb { totalPurchases, outstandingDebt }`:
- `totalPurchases`: `sum(total)` dari `purchases` dalam rentang + toko aktif.
- `outstandingDebt`: `sum(total - paid_amount)` di mana `status = 'utang'` + toko aktif
  (tak dibatasi rentang — sisa utang saat ini).

---

## 3. Server action — `lib/actions/purchases.ts` (baru)

Semua `"use server"`, guard `isOwner()` (meniru `expenses.ts`), lalu
`revalidatePath` untuk `/suppliers`, `/purchases`, `/dashboard`.

- `createSupplier(name, phone?, note?)` → insert `suppliers`.
- `updateSupplier(id, name, phone?, note?)` → update by id.
- `deleteSupplier(id)` → delete by id (riwayat pembelian tetap, `set null`).
- `createPurchase(supplierId, items: {product_id, qty, price_buy}[], paidAmount, note?)`
  → validasi input, panggil RPC `create_purchase` → kembalikan `{ error, id }`.
- `recordSupplierPayment(purchaseId, amount, method?, note?)` → panggil RPC
  `record_supplier_payment`.

---

## 4. Query client — `lib/db/queries.ts` (tambah)

Pola query langsung + cache TTL 60s seperti `getCategories`/`getDiscounts`.

- `BxSupplier { id, name, phone, note }` + `getSuppliers(search?)` + `invalidateSuppliers()`
  (cache TTL).
- `BxPurchase { id, number, supplier_id, supplier_name, total, paid_amount, status,
  created_at, item_count }` + `getPurchases(params?)` (list + filter status/rentang).
- `getPurchase(id)` → purchase + `purchase_items(*, products(name))` +
  `suppliers(name)` + `supplier_payments` (detail 1 nota).
- `BxSupplierDebt` + `getSupplierDebts()` → `purchases` `status='utang'` join
  `suppliers(name)` (mirror `getDebts`).
- `getSupplierPayments(purchaseId)` → mirror `getPayments`.
- `getPurchasesReport(from, to)` → RPC `get_purchases_summary`.

---

## 5. UI

### 5.1 Route & halaman baru
- `app/(main)/suppliers/page.tsx` → `components/suppliers/suppliers-view.tsx`
- `app/(main)/purchases/page.tsx` → `components/purchases/purchases-view.tsx`
- `app/(main)/purchases/[id]/page.tsx` → `components/purchases/purchase-detail.tsx`
  (server page meneruskan `params.id`, pola `transactions/[id]/page.tsx`)

### 5.2 `suppliers-view.tsx`
- Daftar supplier (ikon `Receipt`/`Package`), cari (`getSuppliers`), badge jumlah
  utang outstanding per supplier (jumlah dari `getSupplierDebts` yang dikelompokkan).
- Drawer tambah/edit supplier (nama, telepon, catatan) — pola `expenses-view.tsx`.
- Dialog hapus dengan konfirmasi + info "riwayat pembelian tetap tersimpan".
- Tombol per baris **"Beli"** → buka drawer pembelian dengan supplier terpilih
  (`/purchases` juga punya tombol Tambah, supplier bebas).
- Empty state + skeleton mengikuti `debts-view.tsx`.

### 5.3 `purchases-view.tsx` + `purchase-form.tsx`
- Ringkasan: kartu **Total Utang ke Supplier** (`getSupplierDebts`) + kartu nilai
  pembelian (dari `getPurchasesReport`) — mirror kartu total utang pembeli.
- Daftar nota beli: nomor, supplier, tanggal, total, badge `Lunas`/`Belum Lunas`,
  tautan ke detail.
- Drawer **Tambah Pembelian** (`purchase-form.tsx`):
  - Pilih supplier (DropdownMenu atau daftar chip).
  - Daftar item: input cari produk → pilih → qty + harga beli (default `price_buy`
    produk saat ini, editable); baris bisa ditambah/dihapus.
  - Ringkasan total; input **"Dibayar"** (0 = murni utang) dengan tombol "Lunasi".
  - Catatan opsional → tombol "Simpan Pembelian" → `createPurchase`.
  - Empty state item: "Belum ada item".

### 5.4 `purchase-detail.tsx` (mirror `transaction-detail.tsx`)
- Header total + status badge `Lunas`/`Belum Lunas` + sisa utang.
- Daftar item (`qty × harga beli`), info supplier, nomor nota, kasir, tanggal.
- Riwayat `supplier_payments` (mirror riwayat pembayaran).
- Bila sisa > 0 → tombol **"Catat Pembayaran"** (dialog nominal + tombol Lunasi)
  → `recordSupplierPayment`, lalu muat ulang.

### 5.5 Navigasi — `components/more/more-view.tsx`
Tambahkan grup owner baru (hanya `OWNER_GROUPS`):
```
{
  title: "Stok & Beli",
  items: [
    { href: "/suppliers", label: "Supplier",   desc: "Daftar & kelola pemasok", icon: Receipt },
    { href: "/purchases", label: "Pembelian",  desc: "Nota beli & utang supplier", icon: Package },
  ],
}
```

### 5.6 Laporan — `components/reports/reports-view.tsx`
- `getReports` menambah pemanggilan `getPurchasesReport(from)` (paralel dengan
  `get_reports_summary`).
- Kartu ringkas di `Content`: **Nilai Pembelian** (periode) + **Utang ke Supplier**
  (outstanding) — gaya kartu statistik yang ada.
- Tambahkan 2 baris ringkasan pada `exportCsv`, `exportExcel`, `exportPdf`, dan
  `buildShareText`.

---

## 6. Backup — tambah 4 tabel

1. `lib/backup/types.ts`: tambah `suppliers`, `purchases`, `purchase_items`,
   `supplier_payments` ke `StoreBackupBundle` **dan** `StoreBackupCounts`.
2. `lib/actions/backup.ts`:
   - `clearStoreData`: sisipkan hapus anak dulu → `purchase_items`,
     `supplier_payments`, lalu `purchases`, `suppliers` (sebelum `products`).
   - `restoreStoreBackup`: sisipkan urutan insert `suppliers` (sebelum `purchases`),
     `purchases` (sebelum `purchase_items` & `supplier_payments`).
3. `components/backup/backup-view.tsx`: tambah ke `loadCurrentBundle`
   (fetch `select("*")`), `emptyCounts`, `countBundle`.

> Hapus toko: 4 tabel ikut cascade `stores.id`; tidak perlu ubah
> `delete_current_store`. Tidak ada file storage baru.

---

## 7. Keputusan (SUDAH DIPUTUSKAN)

1. **Kedalaman sederhana** — nota beli langsung tuntas saat simpan; tanpa draft /
   terima sebagian.
2. **Owner-only** untuk supplier, pembelian, dan pelunasan (mirror pengeluaran).
3. **Satu RPC `create_purchase`** demi atomisitas; tidak memakai antrean offline
   untuk pembelian (v1).
4. **Hapus supplier → `set null`**, riwayat pembelian & utang tetap utuh; stok
   tidak di-rollback.
5. **`price_buy` produk = harga beli terakhir** dari nota (konsisten dgn `addStock`).
6. **Tidak ada edit/hapus pembelian** di v1 (perbaikan salah input lewat stok
   opname `adjustStock` yang sudah ada).

---

## 8. Urutan implementasi

1. Migrasi `00004_suppliers_purchases.sql` (tabel + RLS + index + 3 RPC).
2. Server action `lib/actions/purchases.ts`.
3. Query client di `lib/db/queries.ts` (+ `invalidateSuppliers`).
4. Halaman & komponen Supplier (`/suppliers`).
5. Halaman & komponen Pembelian + form + detail (`/purchases`, `/purchases/[id]`).
6. Navigasi `more-view.tsx` + kartu laporan + export.
7. Backup (types, backup.ts, backup-view).
8. Pengujian §9, lalu `npm run lint` & `npm run build`.

---

## 9. Pengujian (checklist)

- Kasir: menu tidak muncul; aksi server action ditolak; RPC aman (tidak bisa
  `create_purchase` via client langsung).
- Buat supplier → muncul di daftar & bisa diedit/dihapus.
- Buat pembelian 2+ item:
  - stok masing-masing produk naik sesuai qty,
  - `price_buy` produk jadi harga beli nota,
  - `stock_movements` type `'in'` tercatat,
  - status `lunas` bila `paid_amount = total`, `utang` bila kurang,
  - `supplier_payments` DP tercatat.
- Pelunasan sebagian → `paid_amount` bertambah & status tetap `utang`;
  lunas → status `lunas`; bayar melebihi sisa → error/dibatasi.
- Halaman utang supplier menunjukkan sisa yang benar & kelompok per supplier.
- Detail nota menampilkan item, supplier, riwayat pembayaran.
- Laporan: kartu nilai pembelian & utang supplier benar; export CSV/Excel/PDF
  memuat baris baru.
- Backup: export berisi 4 tabel baru; restore mengisi ulang & urutan FK benar.
- Hapus toko: 4 tabel ikut terhapus (cascade).
- `npm run lint` & `npm run build` lolos.
- Uji migrasi & RPC di Supabase lokal/staging sebelum production.

---

## 10. Di luar ruang lingkup

- PO bertahap (draft → terima sebagian) & edit/hapus pembelian.
- Antrean offline untuk pembelian.
- Foto supplier / file storage.
- Fase B–E (analitik, loyalitas, satuan, keamanan/uji).
