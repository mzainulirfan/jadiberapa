# Rencana Redesign Halaman Cart (Keranjang)

Error  

Status: P1–P7 selesai. Tersisa lanjutan: P8, P9, P10.
Fokus: halaman Cart (`components/cart/cart-view.tsx`) + beberapa perbaikan
terkait di CartProvider/checkout. Disusun dari hasil review kode.

## Pokok masalah (hasil review)

1. **Baris item penuh sesak** — thumbnail + nama/varian/unit/harga + stepper qty
   kecil (−/qty/+) + tombol hapus + subtotal, semua dalam satu kartu rapat.
   - Qty tidak bisa diketik angka (hanya −/+), dan pembatas stok berlaku diam-diam.
   - Daftar panjang & rata tanpa pengelompokan kategori.
2. **Footer bertumpuk** — subtotal + 2 tombol full-width ("Belanja Lagi" dan
   "Lanjut ke Pembayaran") memakan ruang vertikal di layar kecil.
3. **Diskon terpecah layar** — kartu hanya menampilkan auto-diskon; diskon manual
   (per-item & nota) hanya ada di checkout, sehingga total yang dilihat di
   keranjang bisa berubah mendadak saat bayar.
4. **Tahan-cart kurang menonjol** — hanya banner kecil; isi tahan-cart tak
   terlihat sebelum di-resume; resume menggantikan keranjang dengan konfirmasi
   generik; nama pelanggan yang sedang dilayani tidak terlihat.
5. **Tanpa fasilitas cari/urut/hapus cepat** — tidak ada pencarian dalam keranjang;
   hapus hanya per-item (tidak ada swipe / multi).
6. **Indikasi stok tersembunyi** — saat qty hampir/sama dengan stok tidak ada tanda.
7. **QRIS statis & pembayaran tanpa konfirmasi** — bagian checkout, jalur terpisah.

## Prioritas yang diusulkan

### 🔵 Tinggi — perbaikan cepat, dampak besar
- **P1. Pengelompokan item per kategori.** Posisikan header kecil berisi nama
  kategori di atas grup baris itemnya. Keranjang yang panjang dan rata jadi
  terstruktur dan mudah discan; subtotal tetap satu di footer.
- **P2. Quantity bisa diketik + indikasi stok.** Ketuk angka qty membuka input
  numerik manual. Saat `qty == maxQty`, tampilkan catatan kecil ("Stok tersisa X")
  alih-alih clamp senyap.
- **P3. Footer lebih ringkas.** Pada layar kecil ubah "Belanja Lagi" menjadi ikon/
  tombol ghost kecil di kiri; tetap satu CTA primer "Lanjut ke Pembayaran".

### 🟢 Sedang — pengalaman antara cart & checkout
- **P4. Diskonto ringkas di baris kartu.** Tampilkan harga coret + harga net
  (auto-diskon) yang sudah terhitung di keranjang agar tidak ada kejutan total.
- **P5. Swipe-to-delete** pada baris item (tetap ada tombol hapus).
- **P6. Preview isi tahan-cart.** Dialog daftar tahan-cart memperlihatkan nama
  pelanggan, jumlah item, subtotal, waktu, dan preview item (expandable).

### 🟣 Rendah / lanjutan — fondasi
- **P7. Pisahkan `store_id` pada tabel `carts`** (sekarang kunci per-user saja)
  agar keranjang gerai A tidak bocor ke gerai B untuk user yang sama.
- **P8. Checkout lebih kuat.** Transaksi atomik/rollback dan optimalisasi
  `decrement_stock` (satu panggilan, bukan per-item).
- **P9. Diskon manual juga tampil di cart** — sinkron dengan checkout, butuh
  perubahan state provider; digeser karena lebih kompleks.
- **P10. Pratinjau nota diskon & biaya di footer cart.**

## Cara menerapkan (modul)
- `components/cart/cart-view.tsx` — baris item, footer, pengelompokan, fitur
  swipe, dialg tahan-cart.
- `components/cart/cart-provider.tsx` — penanganan state untuk input qty manual
  jika diperlukan.
- `lib/cart.ts` — helper akumulasi total/subtotal dan grouping bila diminta.
- `lib/db/held-carts.ts` — load item preview untuk dialog tahan-cart.

## Prinsip gaya (konsisten)
- `rounded-2xl border border-hairline bg-canvas`, teks `text-ink/-muted/-faint`,
  aksen `text-primary/destructive/accent-*`, tombol `rounded-full`, `cn()`.
- Bahasa UI: Indonesia. Tetap satu CTA primer per layar.