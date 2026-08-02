Plan Fitur Hapus Toko

1. Aturan Bisnis

Hanya owner toko aktif yang boleh menghapus toko.
Kasir tidak boleh menghapus toko.
Yang dihapus hanya toko aktif, bukan seluruh akun Supabase.
Akun owner dan kasir tetap dipertahankan.
Jika owner memiliki toko lain, otomatis pindah ke toko berikutnya.
Jika tidak memiliki toko lain, diarahkan ke flow Buat Toko Baru.
2. Perbaikan Database

Tambah migration baru, misalnya 00003_store_deletion.sql.
Ubah policy stores_member agar:
semua member hanya boleh membaca toko
hanya owner yang boleh mengubah atau menghapus toko
Tambahkan RPC security definer delete_current_store.
RPC memvalidasi:
user sudah login
user adalah owner
konfirmasi sesuai
toko aktif tersedia
RPC menghapus toko aktif.
Biarkan ON DELETE CASCADE menghapus data terkait:
produk
kategori
pembeli
transaksi
item transaksi
pembayaran
stok
diskon
pengeluaran
varian
shift
settings
held carts
membership toko
RPC mengembalikan:
nama toko yang dihapus
jumlah toko tersisa
next_store_id jika ada toko lain
3. Pembersihan Gambar Produk

Sebelum toko dihapus, ambil semua image_url produk toko aktif.
Ekstrak path file dari URL Storage.
Hapus file gambar dari bucket product-images.
Jika penghapusan gambar gagal, batalkan penghapusan database agar tidak ada data setengah terhapus.
Setelah itu baru panggil RPC penghapusan toko.
4. UI Penghapusan

Tambahkan section Zona Berbahaya di halaman Settings.
Tampilkan informasi:
nama toko
jumlah produk
jumlah kategori
jumlah pembeli
jumlah transaksi
Tambahkan peringatan bahwa data tidak dapat dipulihkan kecuali dari backup.
Sediakan link Unduh Backup sebelum penghapusan.
Gunakan dialog konfirmasi dua tahap.
Minta user mengetik nama toko secara persis.
Tombol akhir menggunakan label jelas: Hapus Toko Permanen.
5. Setelah Penghapusan

Jika masih ada toko lain:
set toko berikutnya sebagai aktif
invalidate cache
reload dashboard toko berikutnya
Jika tidak ada toko:
jangan arahkan ke dashboard
tampilkan halaman Belum Ada Toko
sediakan tombol Buat Toko Baru
Akun auth tetap aktif.
Kasir yang kehilangan toko diarahkan ke pesan bahwa akses toko sudah dicabut.
6. Flow Buat Toko untuk User Lama Saat ini pendaftaran baru membuat akun auth sekaligus toko. Setelah toko dihapus, owner masih memiliki akun auth, sehingga perlu flow tambahan:

Tambahkan route /stores/new.
Hanya user login tanpa toko yang bisa membuka route tersebut.
Form berisi:
nama toko
template toko
Buat server action createStoreForCurrentUser.
Action membuat:
row stores
membership owner
settings awal
template data
Setelah selesai, arahkan ke dashboard.
7. Guard Aplikasi

Tambahkan pengecekan user tanpa toko setelah login.
Jangan biarkan user masuk ke halaman dashboard kosong.
Redirect user tanpa toko ke /stores/new.
Kasir tanpa membership diarahkan ke halaman informasi akses toko.
8. Pengujian

Kasir tidak dapat menghapus toko.
Owner dapat menghapus toko aktif.
Konfirmasi salah tidak menghapus data.
Produk, kategori, transaksi, pembayaran, dan data terkait ikut terhapus.
File gambar produk ikut terhapus.
Akun auth owner tetap bisa digunakan.
Owner dengan beberapa toko berpindah ke toko lain.
Owner tanpa toko diarahkan ke /stores/new.
Backup sebelum hapus tetap dapat direstore.
Jalankan npm run lint.
Jalankan npm run build.
Uji RPC dengan database Supabase lokal atau staging.
Urutan Implementasi

Migration policy dan RPC penghapusan.
Server action penghapusan beserta cleanup Storage.
UI danger zone dan konfirmasi.
Flow /stores/new.
Guard user tanpa toko.
Pengujian cascade, multi-store, dan auth.
Baru aktifkan di production.