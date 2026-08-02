# Rencana Implementasi — Fase C: Loyalitas & Follow-up Pembeli

> Bagian dari [rencana-upgrade-fitur-2.md](./rencana-upgrade-fitur-2.md) (Fase C, P2).
> Setelah Fase A & B selesai. Pola repo: migrasi `00006`, RPC `security definer`
> per `current_store_id()`, query client + cache, UI patuh Notion Design System.

## 1. Tujuan

1. **Poin loyalitas**: pelanggan dapat poin dari belanja & menukarnya jadi diskon saat checkout.
2. **Follow-up WhatsApp**: deep link `wa.me` berisi template pesan (pengingat utang / promo poin).

## 2. Keputusan desain (v1 sederhana)

- **Perolehan**: `poin = floor(total / earnPer)` pada **setiap** transaksi dibuat
  (termasuk utang) — mental model "setiap Rp 1.000 belanja = 1 poin". Maksimal
  1000 poin per transaksi (anti-abuse).
- **Penukaran**: `nilai = poin × redeemValue` (default 100 = 10% dari earnPer),
  dipotong sebagai **diskon nota**; saldo poin dicek ulang di server saat transaksi
  dibuat (dan saat sinkron offline), klaim dibatasi ≤ saldo & ≤ sisa total.
- **Kasir boleh menukar**; owner mengatur rasio di Pengaturan.
- **Rasio** via `settings` per toko: `loyalty_enabled` ('1'), `loyalty_earn_per` (1000),
  `loyalty_redeem_value` (100). Default diterapkan di kode bila kosong.
- **Ledger** minimal: `loyalty_ledger` mencatat tiap earn/redeem (jejak).
- Offline: penukaran poin disimpan di draft antrean (`points_redeemed`); saat
  sinkron, server menyesuaikan dengan saldo poin aktual.

## 3. Migrasi `00006_loyalty.sql`

- `alter table customers add column if not exists points integer not null default 0`
- `loyalty_ledger` (id, store_id cascade, customer_id cascade, transaction_id set null,
  type check `earn`/`redeem`, points int signed, note, created_at) + RLS
  `store_id = current_store_id()` + index store_id & (customer_id, created_at).
- RPC `award_loyalty_points(customer_id, points, transaction_id)` — tambah poin + ledger.
- RPC `redeem_loyalty_points(customer_id, points, transaction_id)` — baca
  `loyalty_redeem_value`, clamp saldo, kurangi poin + ledger, balikin
  `{ error, used, value }`.
- `grant execute ... to authenticated`.

## 4. Kode

### `lib/actions/transactions.ts` (server action `createTransaction`)
- Param baru `points_redeemed?: number`.
- Setelah normalisasi & sebelum insert transaksi:
  1. baca settings `loyalty_redeem_value`/`loyalty_earn_per` + poin customer (server client);
  2. `used = min(points_redeemed, points, floor((gross - itemDisc - discount)/redeemValue))`;
  3. `pointsValue = used * redeemValue`; `total = gross - itemDisc - discount - pointsValue + fee` (clamp ≥ 0).
- Setelah transaksi dibuat: panggil `redeem_loyalty_points` (jika `used > 0`),
  lalu `award_loyalty_points` dengan `floor(total / earnPer)` (jika > 0).
- `revalidatePath("/customers")` ditambah.

### `lib/offline/transactions.ts`
- Draft tambah `points_redeemed?: number`; `queueOfflineTransaction` & `syncQueuedTransactions`
  meneruskan nilainya ke `createTransaction`.

### `lib/db/queries.ts`
- `BxCustomer` + `points: number`; `getCustomers` pilih `points`.
- `BxDebt` + `customer_phone`; `getDebts` ambil `customers(phone)`.
- Helper `getLoyaltyConfig()` membaca settings (earnPer, redeemValue, enabled).

### Checkout (`components/checkout/checkout-view.tsx`)
- `BxCartCustomer` (cart-provider) + field opsional `points`.
- Setelah pilih pembeli, simpan `points` dari daftar pembeli.
- Kartu **Poin Loyalitas**: tampil bila pembeli terpilih & loyalitas aktif;
  toggle "Tukar poin" memakai poin maksimum terjangkau; nilai masuk ke breakdown diskon.
- `createTransaction` dipanggil dengan `points_redeemed`; draft offline juga.

### Halaman pembeli (`components/customers/customer-list.tsx`)
- Tampilkan poin per pembeli.
- Tombol WhatsApp diberi template promo poin (ambil `store_name` dari settings).

### Utang (`components/debts/debts-view.tsx`)
- `getDebts` membawa `customer_phone`; tiap grup pembeli dapat tombol WhatsApp
  template pengingat utang dengan sisa tagihan & nama toko.

### Pengaturan (`components/settings/settings-form.tsx`)
- Tab baru **Loyalitas** (icon `Zap`/`Tag`): toggle aktif + `loyalty_earn_per` +
  `loyalty_redeem_value` (pakai `updateSetting`/`FieldRow` yang ada).

### Backup
- `loyalty_ledger` ditambahkan ke `lib/backup/types.ts`, `lib/actions/backup.ts`
  (clear & restore, urutan setelah customers), `components/backup/backup-view.tsx`.

## 5. Yang TIDAK dikerjakan

- Tidak ada tukar poin sebagian via menu (hanya maksimum terjangkau di checkout).
- Tidak ada kedaluwarsa poin, tier, atau promosi otomatis.
- Tidak ada integrasi WhatsApp API (hanya deep link template).
- Poin untuk pelunasan utang kemudian (hanya saat transaksi dibuat).

## 6. Pengujian

1. Lint & build lolos.
2. Belanja → poin bertambah di halaman Pembeli & ledger tercatat.
3. Checkout dengan poin → diskon terpotong, saldo berkurang, ledger redeem tercatat.
4. Poin melebihi sisa tagihan → dibatasi agar tidak negatif.
5. Offline → draft memuat `points_redeemed`, sinkron menyesuaikan saldo.
6. WA pembeli berisi template poin; WA utang berisi sisa tagihan.
7. Backup/restore menyertakan `loyalty_ledger`.
8. Migrasi `00006` diterapkan via SQL editor.
