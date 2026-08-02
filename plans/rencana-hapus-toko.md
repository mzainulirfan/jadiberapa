# Rencana Implementasi: Fitur Hapus Toko

> Sumber: `hapustoko.md`. Divalidasi dengan kode nyata (migrasi, RPC, RLS, Storage,
> Settings, guard). Tanggal disusun: 2026-08-02. Status: proposal (belum ada kode diubah).

---

## 0. Kondisi kode saat ini (temuan validasi)

- **Migrasi** hanya ada dua: [00001_core.sql](../supabase/migrations/00001_core.sql)
  & [00002_multi_store.sql](../supabase/migrations/00002_multi_store.sql).
  Nama baru `00003_store_deletion.sql` sudah tepat.
- **Cascade sudah lengkap:** semua tabel bisnis punya
  `store_id ... references stores(id) on delete cascade`, dan `store_members` +
  `user_active_store` juga cascade ke `stores`. Menghapus 1 baris `stores`
  otomatis menghapus produk, kategori, transaksi, pembayaran, stok, diskon,
  pengeluaran, varian, cash_sessions, settings, held_carts, dan membership.
- **RPC pola siap ditiru:** `set_active_store`, `get_my_stores`,
  `remove_store_member`, `current_store_id`, `current_user_role`
  (semua `security definer`).
- **Storage:** [uploadProductImage](../lib/actions/products.ts#L83-L102) menyimpan
  file di root bucket `product-images` dengan nama `{uuid}.{ext}`; policy
  `product_images_auth_delete` sudah ada.
- **Danger zone** paling pas di tab "Toko" pada
  [settings-form.tsx](../components/settings/settings-form.tsx#L371-L394).
- **Guard** yang ada baru [OwnerGuard](../components/auth/owner-guard.tsx); belum
  ada guard "user tanpa toko".

### Isu penting yang mempengaruhi desain

1. **Bug RLS sekaligus diperbaiki:** policy `stores_member` sekarang `for all`
   berbasis keanggotaan → kasir pun bisa update/delete `stores`. Diperketat:
   SELECT untuk semua member, UPDATE/DELETE hanya owner.
2. **`/stores/new` wajib lewat RPC `security definer`**, bukan server action
   insert biasa. User tanpa toko belum jadi member, sehingga insert `stores`
   akan gagal `with check` (chicken-and-egg). RPC membuat `stores` + membership
   + settings sekaligus.
3. **Konsistensi Storage vs DB:** hapus DB (via RPC cascade) dulu, baru hapus
   file gambar. Jika file gagal dihapus → hanya sisa storage (orphan minor),
   DB tetap konsisten. (Lihat keputusan §7 — dokumen aslinya menyarankan urutan
   sebaliknya.)

---

## 1. Aturan bisnis (ringkas)

- Hanya **owner toko aktif** yang boleh menghapus toko; kasir tidak.
- Yang dihapus hanya **toko aktif**, bukan akun auth.
- Owner punya toko lain → pindah otomatis ke toko berikutnya.
- Owner tanpa toko lain → diarahkan ke `/stores/new`.
- Kasir yang tokonya dihapus → tampilkan info "toko telah dihapus", lalu
  **auto-logout** (hapus sesi).

---

## 2. Migrasi DB — `supabase/migrations/00003_store_deletion.sql`

### 2.1 Perketat policy `stores`
```
drop policy if exists stores_member on stores;

create policy stores_select_member on stores
  for select to authenticated
  using (exists (select 1 from store_members sm
                 where sm.store_id = stores.id and sm.user_id = auth.uid()));

create policy stores_modify_owner on stores
  for update to authenticated
  using (exists (select 1 from store_members sm
                 where sm.store_id = stores.id and sm.user_id = auth.uid()
                   and sm.role = 'owner'))
  with check (exists (select 1 from store_members sm
                 where sm.store_id = stores.id and sm.user_id = auth.uid()
                   and sm.role = 'owner'));

create policy stores_delete_owner on stores
  for delete to authenticated
  using (exists (select 1 from store_members sm
                 where sm.store_id = stores.id and sm.user_id = auth.uid()
                   and sm.role = 'owner'));
```
> Catatan: insert `stores` oleh user biasa tetap tidak diizinkan (dibuat lewat
> RPC security definer / trigger signup).

### 2.2 RPC `delete_current_store(p_confirm text)`
`security definer`, validasi berurutan:
1. `auth.uid()` tidak null.
2. Ambil `sid := current_store_id()`, `r := current_user_role()`.
3. `sid` null → error "Toko aktif tidak ditemukan".
4. `r <> 'owner'` → error "Hanya pemilik yang bisa menghapus toko".
5. `p_confirm` ≠ `stores.name` (persis) → error "Konfirmasi nama toko tidak cocok".

Aksi:
- Simpan `deleted_name := stores.name`.
- `delete from stores where id = sid;` (cascade membersihkan sisanya).
- Hitung toko tersisa milik user & tentukan `next_store_id` (mis. `created_at asc`).
- Jika ada next → `insert user_active_store ... on conflict do update` (set aktif).
- Return JSON:
```
{ "error": null,
  "deleted_name": "...",
  "remaining": <int>,
  "next_store_id": <uuid|null> }
```
`grant execute ... to authenticated;`

### 2.3 RPC `create_store_for_current_user(p_name text, p_code text)`
`security definer` (untuk flow `/stores/new`):
- Validasi login + `p_name` tidak kosong.
- Insert `stores(name, code)` (pakai `make_store_code` bila `p_code` kosong).
- Insert `store_members(user_id, store_id, 'owner')`.
- Insert 3 settings awal (`store_name`, `store_address`, `store_phone`).
- Set `user_active_store` ke toko baru.
- Return `{ error, store_id }`.
> Penerapan template dilakukan setelah ini oleh server action (memakai
> [applyStoreTemplate](../lib/actions/templates.ts#L47) yang sudah ada).

---

## 3. Server action hapus — `lib/actions/stores.ts` (baru)

`deleteCurrentStore(confirmName: string)`:
1. `isOwner()` guard (defense-in-depth; RPC juga cek).
2. Ambil semua `image_url` produk toko aktif (via client server, RLS toko aktif).
3. Panggil RPC `delete_current_store(confirmName)`.
4. RPC error → return error (DB belum berubah).
5. RPC sukses → hapus file gambar dari bucket `product-images`
   (ekstrak path dari public URL: bagian setelah `/product-images/`).
   Kegagalan hapus file **tidak** membatalkan (DB sudah konsisten; catat warning).
6. Return `{ error, deletedName, remaining, nextStoreId }`.

`createStoreForCurrentUser(name, templateKey)`:
1. Panggil RPC `create_store_for_current_user`.
2. Bila sukses & `templateKey` bukan kosong → `applyStoreTemplate(templateKey)`.
3. Return `{ error, storeId }`.

Helper query `queries.ts`: `getStoreDeletionStats()` → jumlah produk, kategori,
pembeli, transaksi untuk ditampilkan di danger zone (pakai `count` head query).

---

## 4. UI Danger Zone (tab "Toko" di Settings)

Komponen baru `components/settings/danger-zone.tsx`, dirender setelah section
identitas toko di [settings-form.tsx](../components/settings/settings-form.tsx#L394).

Tampilan:
- Kartu merah (`border-destructive/30 bg-destructive/5`) berjudul "Zona Berbahaya".
- Info: nama toko + jumlah produk/kategori/pembeli/transaksi.
- Peringatan: data tidak bisa dipulihkan kecuali dari backup.
- Tautan **"Unduh Backup"** ke halaman backup sebelum menghapus.
- Tombol "Hapus Toko…" membuka **dialog konfirmasi 2 tahap**:
  - Tahap 1: ringkasan dampak + centang "Saya paham".
  - Tahap 2: input ketik **nama toko persis** → tombol
    **"Hapus Toko Permanen"** (destructive) aktif hanya jika cocok.
- Pola dialog & toast mengikuti komponen yang sudah ada (`Dialog`, `sonner`).

Hanya tampil untuk owner (tab Settings sudah di balik OwnerGuard di level halaman).

---

## 5. Setelah penghapusan (client)

Setelah `deleteCurrentStore` sukses:
- `remaining > 0`:
  - `setActiveStore(nextStoreId)` → `invalidateAllDataCaches()` →
    `window.location.assign("/dashboard")` (reload penuh).
  - Toast "Toko '<nama>' dihapus".
- `remaining === 0`:
  - `window.location.assign("/stores/new")`.

---

## 6. Flow `/stores/new` + guard

### 6.1 Route `app/stores/new/page.tsx`
- Server component: cek `current_store_id()`. Jika **masih ada toko** → redirect
  `/dashboard` (route ini hanya untuk user tanpa toko).
- Render form (nama toko + template picker) — reuse
  [TemplatePicker](../components/templates/template-picker.tsx).
- Submit → `createStoreForCurrentUser(name, templateKey)` → sukses →
  `/dashboard` (reload penuh + invalidate cache).

### 6.2 Guard user tanpa toko
- Tambah util cek di layer yang membungkus dashboard (mis. komponen
  `NoStoreGuard` client, memakai `current_store_id`/`current_user_role`):
  - **Owner tanpa toko** (role null tapi punya sesi & bukan kasir) → redirect
    `/stores/new`.
  - **Kasir tanpa membership** → tampilkan info "toko telah dihapus" (toast/
    halaman singkat), lalu **auto-logout** via `supabase.auth.signOut()` dan
    arahkan ke `/login`.
- Sisipkan di layout terautentikasi (dekat penggunaan OwnerGuard/`useRole`).
- Halaman info kasir: `app/no-store/page.tsx` — pesan singkat + otomatis
  memicu logout (fallback tombol "Keluar").

---

## 7. Keputusan (SUDAH DIPUTUSKAN)

1. **Urutan Storage vs DB → Opsi A.** Hapus DB (RPC cascade) dulu, baru hapus
   file gambar. Konsistensi DB terjamin; kegagalan hapus file hanya menyisakan
   orphan storage (dicatat warning, tidak membatalkan).
2. **Kasir kehilangan toko → auto-logout.** Sebelum logout, tampilkan
   informasi bahwa toko sudah dihapus, lalu paksa keluar (hapus sesi).
3. **Boleh hapus toko terakhir → ya.** Setelah toko terakhir owner terhapus,
   paksa ke `/stores/new`.

---

## 8. Urutan implementasi

1. Migrasi `00003_store_deletion.sql`: perketat policy `stores` + RPC
   `delete_current_store` + `create_store_for_current_user`.
2. Server action `lib/actions/stores.ts` + helper stats + cleanup Storage.
3. UI Danger Zone + dialog konfirmasi 2 tahap di Settings.
4. Route `/stores/new` + form + action.
5. Guard user tanpa toko + halaman info kasir.
6. Pengujian (§9), lalu aktifkan di production.

---

## 9. Pengujian (checklist)

- Kasir tidak dapat menghapus toko (UI tersembunyi + RPC menolak).
- Owner dapat menghapus toko aktif.
- Konfirmasi nama salah → tidak ada data terhapus.
- Produk, kategori, transaksi, pembayaran, stok, diskon, pengeluaran, varian,
  cash_sessions, settings, held_carts, membership ikut terhapus (cascade).
- File gambar produk ikut terhapus dari bucket.
- Akun auth owner tetap bisa login.
- Owner multi-toko berpindah ke toko lain otomatis.
- Owner tanpa toko diarahkan ke `/stores/new` dan bisa buat toko + template.
- Backup sebelum hapus tetap bisa direstore ke toko baru.
- `npm run lint` & `npm run build` lolos.
- Uji RPC di Supabase lokal/staging sebelum production.

---

## 10. Di luar ruang lingkup

- Tidak menghapus akun auth.
- Tidak mengubah skema tabel bisnis (cascade sudah ada).
- Tidak menyentuh flow register signup owner/kasir yang sudah ada.
