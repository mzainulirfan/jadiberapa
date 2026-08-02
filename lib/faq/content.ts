// Konten FAQ / pusat bantuan. Murni data (tanpa JSX/import React) supaya bisa
// di-unit-test dan mudah dirawat. Setiap item boleh punya `href` untuk
// deep-link ke halaman terkait di aplikasi.
export type FaqItem = {
  id: string
  q: string
  a: string
  href?: string
}

export type FaqGroup = {
  id: string
  title: string
  desc?: string
  icon: "store" | "package" | "receipt" | "chart"
  items: FaqItem[]
}

export const faqGroups: FaqGroup[] = [
  {
    id: "memulai",
    title: "Cara Mulai",
    desc: "Buat akun, buat toko, dan ajak kasir bergabung.",
    icon: "store",
    items: [
      {
        id: "buat-akun-toko",
        q: "Cara membuat akun & toko (Pemilik)",
        a: [
          "1. Buka halaman daftar, lalu pilih \u201cBuat toko baru\u201d.",
          "2. Isi nama toko.",
          "3. Pilih \u201cMulai dengan\u201d: template kategori (mis. Sembako, Warung, Kopi) yang langsung membuat kategori + produk contoh, atau mulai kosong.",
          "4. Isi username dan passcode 6 digit untuk akun pemilik.",
          "5. Tekan \u201cBuat Toko & Akun\u201d. Toko langsung aktif.",
        ].join("\n"),
        href: "/register",
      },
      {
        id: "gabung-kasir",
        q: "Cara bergabung sebagai kasir",
        a: [
          "1. Pemilik menyalin kode toko: Lainnya \u2192 \u201cSalin kode toko aktif\u201d.",
          "2. Kasir memilih \u201cGabung sebagai Kasir\u201d di halaman daftar.",
          "3. Masukkan kode toko, lalu isi username & passcode sendiri.",
          "4. Tekan \u201cGabung ke Toko\u201d.",
        ].join("\n"),
        href: "/register?mode=kasir",
      },
      {
        id: "login",
        q: "Cara login",
        a: "Masukkan username dan passcode 6 digit lalu tekan Masuk. Saberaha tidak memakai email/password panjang.",
        href: "/login",
      },
      {
        id: "lupa-passcode",
        q: "Lupa passcode",
        a: [
          "Kasir: minta pemilik toko mereset passcode kamu.",
          "Pemilik: buka Lainnya \u2192 Kelola Kasir, lalu ketuk ikon kunci di samping kasir bersangkutan dan isi passcode baru (6 digit).",
        ].join("\n"),
        href: "/staff",
      },
      {
        id: "pindah-toko",
        q: "Punya lebih dari satu toko",
        a: [
          "1. Buka Lainnya \u2192 \u201cToko Aktif\u201d untuk berpindah toko.",
          "2. Pemilik bisa menekan \u201cBuat Toko Baru\u201d di dialog yang sama untuk membuat toko tambahan.",
          "3. Fitur yang terlihat menyesuaikan peranmu (Pemilik atau Kasir).",
        ].join("\n"),
        href: "/more",
      },
    ],
  },
  {
    id: "kelola",
    title: "Kelola Toko & Data",
    desc: "Barang, kategori, pembeli, diskon, dan stok.",
    icon: "package",
    items: [
      {
        id: "buat-produk",
        q: "Cara membuat barang/produk",
        a: [
          "1. Buka Barang, lalu tekan tombol +.",
          "2. Isi nama, harga beli & jual, stok awal, dan kategori.",
          "3. Satuan dasar bisa diatur (pcs, kg, dsb).",
          "4. Opsional: varian (ukuran/rasa), SKU, barcode, foto.",
          "5. Tekan Simpan.",
        ].join("\n"),
        href: "/products",
      },
      {
        id: "buat-kategori",
        q: "Cara membuat kategori",
        a: "Buka Lainnya \u2192 Kategori, lalu tekan + dan isi nama kategori. Saat registrasi, template juga otomatis membuat kategori.",
        href: "/categories",
      },
      {
        id: "satuan-besar",
        q: "Cara menjual satuan besar (dus/lusin)",
        a: [
          "1. Di form barang, tambahkan \u201csatuan turunan\u201d (mis. 1 Dus = 12 pcs) beserta harga jualnya.",
          "2. Saat kasir menambah barang ke keranjang, muncul pilihan satuan.",
          "3. Stok tetap dihitung dalam satuan dasar.",
        ].join("\n"),
        href: "/products",
      },
      {
        id: "buat-pembeli",
        q: "Cara menambah pembeli (pelanggan)",
        a: [
          "1. Buka Lainnya \u2192 Pembeli.",
          "2. Tekan +, isi nama dan nomor HP.",
          "3. Nomor HP dipakai untuk kasbon (utang) dan follow-up WhatsApp.",
        ].join("\n"),
        href: "/customers",
      },
      {
        id: "buat-diskon",
        q: "Cara membuat diskon/promo",
        a: "Buka Lainnya \u2192 Diskon untuk mengelola promo. Diskon juga bisa diberikan per barang atau per nota langsung di layar pembayaran.",
        href: "/discounts",
      },
      {
        id: "stok-masuk",
        q: "Cara mencatat stok masuk & opname",
        a: "Buka Barang, pilih barang yang diinginkan, lalu gunakan stok masuk atau opname. Semua perubahan tercatat otomatis di riwayat stok.",
        href: "/products",
      },
      {
        id: "pembelian-supplier",
        q: "Cara mencatat pembelian & utang supplier",
        a: [
          "1. Buka Lainnya \u2192 Pembelian \u2192 nota beli baru.",
          "2. Pilih supplier (kelola di Lainnya \u2192 Supplier).",
          "3. Tambahkan item, total otomatis, lalu Simpan. Stok bertambah otomatis.",
        ].join("\n"),
        href: "/purchases",
      },
      {
        id: "pengeluaran",
        q: "Cara mencatat pengeluaran operasional",
        a: "Buka Lainnya \u2192 Pengeluaran, lalu + dan isi keterangan & nominal. Pengeluaran ikut memengaruhi laba bersih di Dashboard.",
        href: "/expenses",
      },
    ],
  },
  {
    id: "transaksi",
    title: "Transaksi & Kasir",
    desc: "Penjualan, kasbon, shift, struk, offline, dan poin.",
    icon: "receipt",
    items: [
      {
        id: "catat-penjualan",
        q: "Cara mencatat penjualan",
        a: [
          "1. Buka halaman Kasir.",
          "2. Pilih barang (cari nama, atau scan barcode).",
          "3. Pilih pembeli (opsional).",
          "4. Tekan Bayar, pilih metode: tunai, QRIS, DANA, atau utang.",
          "5. Tekan Simpan. Struk bisa dicetak setelahnya.",
        ].join("\n"),
        href: "/cashier",
      },
      {
        id: "kasbon",
        q: "Cara kasbon (utang pembeli) & pelunasan",
        a: "Saat pembayaran, pilih metode \u201cUtang\u201d. Kelola semua utang dan pelunasannya di Lainnya \u2192 Utang.",
        href: "/debts",
      },
      {
        id: "shift",
        q: "Cara buka/tutup shift kasir",
        a: "Buka Lainnya \u2192 Shift Kasir: buka laci saat mulai, hitung kas & selisih saat tutup. Berguna untuk tanggung jawab kas.",
        href: "/shift",
      },
      {
        id: "struk-printer",
        q: "Cara cetak struk (printer Bluetooth)",
        a: "Di halaman pembayaran, tekan tombol cetak lalu hubungkan printer Bluetooth ESC/POS. Pastikan printer dalam mode pairing.",
        href: "/cashier",
      },
      {
        id: "offline",
        q: "Aplikasi dipakai tanpa internet?",
        a: "Bisa. Saberaha berjalan offline (PWA): transaksi masuk antrean dan otomatis tersinkron saat koneksi kembali.",
        href: "/cashier",
      },
      {
        id: "poin-loyalitas",
        q: "Poin loyalitas pembeli",
        a: "Aktifkan loyalitas di Pengaturan toko dan atur rasio poin. Pembeli bisa menukar poin menjadi potongan saat checkout.",
        href: "/settings",
      },
    ],
  },
  {
    id: "laporan-keamanan",
    title: "Laporan, Data & Keamanan",
    desc: "Laporan, backup, dan keamanan akun.",
    icon: "chart",
    items: [
      {
        id: "laporan",
        q: "Cara lihat laporan & export",
        a: "Buka Lainnya \u2192 Laporan: penjualan, keuntungan, dan lainnya. Bisa di-export ke CSV, Excel, PDF, dicetak, atau dibagikan ke WhatsApp.",
        href: "/reports",
      },
      {
        id: "backup",
        q: "Cara backup & pulihkan data",
        a: "Buka Lainnya \u2192 Cadangan Data \u2192 Export. Simpan filenya. Pada perangkat baru, gunakan tombol pulihkan dan pilih file tersebut.",
        href: "/backup",
      },
      {
        id: "kunci-layar",
        q: "Cara kunci layar cepat",
        a: "Buka Lainnya \u2192 Kunci Layar. Cocok untuk perangkat bersama di kasir: buka kembali dengan passcode, tanpa keluar akun.",
        href: "/more",
      },
      {
        id: "ganti-passcode",
        q: "Cara ganti passcode",
        a: "Buka Lainnya \u2192 Ganti Passcode, masukkan passcode lama lalu passcode baru (6 digit).",
        href: "/more",
      },
      {
        id: "hapus-toko",
        q: "Cara hapus toko",
        a: "Buka Pengaturan \u2192 hapus toko. Seluruh data toko ikut terhapus permanen dan tidak bisa dibatalkan.",
        href: "/settings",
      },
    ],
  },
]
