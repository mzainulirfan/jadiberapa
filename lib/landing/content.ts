// Konten landing page (halaman /). Statis & murni data agar mudah diuji.
export const featureIcons = [
  "zap",
  "download",
  "package",
  "user",
  "cog",
  "chart",
  "printer",
  "copy",
] as const

export type FeatureIconKey = (typeof featureIcons)[number]

export type LandingFeature = {
  icon: FeatureIconKey
  title: string
  description: string
}

export type LandingStep = {
  title: string
  description: string
}

export type LandingFaq = {
  q: string
  a: string
}

export type LandingContent = {
  hero: {
    badge: string
    title: string
    subtitle: string
    primaryCta: string
    secondaryCta: string
  }
  steps: LandingStep[]
  features: LandingFeature[]
  faqTeaser: LandingFaq[]
  footerNote: string
}

export const landingContent: LandingContent = {
  hero: {
    badge: "Kasir warung & UMKM",
    title: "Kasir online untuk warung & UMKM.",
    subtitle:
      "Catat jualan, kelola stok, utang, dan laporan — dari HP, bahkan saat tanpa internet.",
    primaryCta: "Buat Toko Gratis",
    secondaryCta: "Lihat Cara Pakai",
  },
  steps: [
    {
      title: "Buat akun & toko",
      description:
        "Daftar gratis, beri nama toko, dan pilih template isi awal (Sembako, Warung, Kopi, dll) — atau mulai dari kosong.",
    },
    {
      title: "Isi barang & undang kasir",
      description:
        "Tambah produk, kategori, dan satuan. Ajak kasir bergabung lewat kode toko, lengkap dengan peran yang sesuai.",
    },
    {
      title: "Mulai jualan & pantau",
      description:
        "Catat transaksi, kelola utang pembeli, dan lihat laporan penjualan serta laba dari HP.",
    },
  ],
  features: [
    {
      icon: "zap",
      title: "Kasir cepat",
      description:
        "Cari barang atau scan barcode, pilih metode bayar (tunai, QRIS, DANA, utang) — transaksi selesai dalam hitungan detik.",
    },
    {
      icon: "download",
      title: "Jalan tanpa internet",
      description:
        "Aplikasi tetap bekerja saat offline. Transaksi masuk antrean dan tersinkron otomatis begitu koneksi kembali.",
    },
    {
      icon: "package",
      title: "Produk & stok",
      description:
        "Kelola kategori, varian ukuran/rasa, satuan dus/lusin, stok masuk, dan opname dengan mudah.",
    },
    {
      icon: "user",
      title: "Pembeli & utang",
      description:
        "Catat data pembeli, kelola kasbon dan pelunasan utang agar tidak ada yang terlewat.",
    },
    {
      icon: "cog",
      title: "Peran & shift kasir",
      description:
        "Batasi akses kasir sesuai peran, buka-tutup shift, dan hitung kas di akhir sesi.",
    },
    {
      icon: "chart",
      title: "Laporan & ekspor",
      description:
        "Penjualan dan laba tersusun otomatis; ekspor CSV/Excel/PDF atau bagikan lewat WhatsApp.",
    },
    {
      icon: "printer",
      title: "Struk Bluetooth",
      description:
        "Cetak struk langsung ke printer ESC/POS Bluetooth tanpa aplikasi tambahan.",
    },
    {
      icon: "copy",
      title: "Cadangan data",
      description:
        "Backup dan pulihkan data kapan saja, aman di perangkat Anda.",
    },
  ],
  faqTeaser: [
    {
      q: "Apakah Saberaha gratis?",
      a: "Ya. Buat toko dan pakai semua fitur inti secara gratis, tanpa biaya bulanan.",
    },
    {
      q: "Bisa dipakai tanpa internet?",
      a: "Bisa. Saberaha berjalan offline (PWA); transaksi tersimpan dan tersinkron otomatis saat online kembali.",
    },
    {
      q: "Perlu printer khusus?",
      a: "Tidak wajib. Gunakan printer struk ESC/POS Bluetooth, atau cukup catat transaksi di layar HP.",
    },
    {
      q: "Berapa kasir yang bisa bergabung?",
      a: "Tidak terbatas. Kasir bergabung lewat kode toko dan pemilik dapat mereset passcode kasir kapan saja.",
    },
    {
      q: "Bagaimana kalau lupa passcode?",
      a: "Kasir meminta reset kepada pemilik. Pemilik mengganti passcode lewat menu Lainnya → Ganti Passcode.",
    },
  ],
  footerNote: "Saberaha — aplikasi kasir untuk warung & UMKM.",
}
