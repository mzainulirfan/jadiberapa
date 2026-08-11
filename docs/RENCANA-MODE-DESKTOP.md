# Rencana Mode Desktop Saberaha

## 1. Ringkasan

Mode desktop akan dibuat sebagai perluasan responsif dari aplikasi yang sama, bukan aplikasi atau kumpulan route terpisah. Tampilan mobile yang sudah ada tetap menjadi baseline untuk layar di bawah `1024px`. Pada layar desktop, app shell berubah menjadi tiga bagian utama:

1. **Sidebar** tetap di kiri untuk navigasi utama dan menu berbasis role.
2. **Header** sticky di atas area kerja untuk judul, breadcrumb, konteks toko, dan aksi global.
3. **Content area** yang dapat di-scroll sendiri dan memiliki lebar/layout sesuai kebutuhan halaman.

Prioritas pertama adalah shell desktop dan halaman Kasir. Halaman data lain kemudian ditingkatkan bertahap tanpa mengubah alur bisnis, query, Auth, RLS, atau mode delegasi kasir.

## 2. Tujuan

- Memberikan pengalaman desktop yang benar-benar memanfaatkan ruang horizontal.
- Mempertahankan semua perilaku mobile dan PWA yang sudah berjalan.
- Menghindari duplikasi state, provider, query, dan business logic antara mobile dan desktop.
- Menjadikan navigasi owner dan kasir lebih cepat tanpa bergantung pada halaman Lainnya.
- Membuat proses transaksi desktop lebih efisien dengan katalog dan keranjang berdampingan.
- Menjaga role owner/kasir dan delegated cashier mode tetap terlihat serta fail-closed.
- Menyediakan fondasi konsisten untuk dashboard, tabel data, form, dan halaman detail.

## 3. Non-Tujuan

- Tidak membuat route seperti `/desktop/*`.
- Tidak membuat codebase atau komponen bisnis desktop yang sepenuhnya terpisah.
- Tidak mengubah skema database atau aturan bisnis hanya untuk kebutuhan layout.
- Tidak menghapus navigasi atau desain mobile.
- Tidak menambahkan fitur baru seperti multi-window, global command palette, atau shortcut kompleks pada fase awal.
- Tidak melakukan redesign visual total; bahasa desain Notion Canvas yang ada tetap digunakan.

## 4. Kondisi Saat Ini

App shell saat ini berada di `app/(main)/layout.tsx` dan selalu menggunakan pola mobile:

- `Header` di atas.
- `PullToRefresh` sebagai scroller utama.
- `BottomNav` dengan lima tujuan utama.
- Tinggi aplikasi dikunci melalui `--app-h`.
- Hampir semua halaman memakai padding `p-4`, kartu satu kolom, dan grid dua kolom.
- Responsive utility pada area aplikasi utama masih sangat sedikit.
- Navigasi tersebar di `components/bottom-nav/bottom-nav.tsx`, `components/header/header.tsx`, dan `lib/quick-actions.ts`.
- Halaman Kasir masih menampilkan katalog saja; keranjang dibuka melalui route `/cart`.

Konsekuensinya pada desktop:

- Konten melebar tanpa hierarchy yang jelas.
- Bottom navigation tetap terasa seperti aplikasi telepon.
- Ruang kanan pada halaman Kasir tidak dipakai untuk keranjang.
- Daftar transaksi dan data operasional tetap berbentuk kartu mobile.
- Menu owner membutuhkan perpindahan ke halaman Lainnya.

## 5. Breakpoint Dan Perilaku

### Mobile dan tablet sempit: `< 1024px`

- Pertahankan `Header`, `PullToRefresh`, dan `BottomNav` saat ini.
- Pertahankan safe-area dan `--app-h`.
- Pertahankan kartu, drawer, dan alur `/cashier -> /cart -> /checkout`.
- Tidak ada perubahan perilaku sebagai syarat utama implementasi desktop.

### Desktop: `>= 1024px`

- Tampilkan sidebar tetap.
- Sembunyikan bottom navigation.
- Gunakan desktop header di area kanan sidebar.
- Nonaktifkan gesture pull-to-refresh; content area memakai scroll biasa.
- Terapkan padding halaman `24px` pada `lg` dan `32px` pada `xl`.
- Gunakan lebar konten per jenis halaman, bukan satu `max-width` global.

### Desktop lebar: `>= 1280px`

- Sidebar dapat memakai lebar penuh sekitar `248px`.
- Dashboard dan katalog menggunakan grid lebih banyak.
- Halaman Kasir menggunakan panel keranjang `380-420px`.
- Halaman data dapat berubah dari kartu menjadi tabel.

### Layar sangat lebar: `>= 1536px`

- Konten dashboard dibatasi sekitar `1440px` agar tidak terlalu renggang.
- Katalog Kasir dapat mencapai 4-5 kolom sesuai ukuran kartu minimum.
- Tabel tetap dibatasi agar kolom mudah dipindai.

## 6. Arsitektur App Shell

### Struktur target

```text
CashierModeProvider
└── CartProvider
    └── Desktop/Mobile App Shell
        ├── Sidebar                 desktop only
        └── Main Workspace
            ├── Cashier Mode Status
            ├── Header
            └── Content Scroller
                └── Route Content
        └── Bottom Navigation       mobile only
```

### Komponen yang direncanakan

- `components/app-shell/app-shell.tsx`
  - Menentukan struktur responsif shell.
  - Tidak membaca role atau data bisnis secara langsung bila dapat didelegasikan.
- `components/app-shell/sidebar.tsx`
  - Branding, toko aktif, grouped navigation, dan area akun.
- `components/app-shell/desktop-header.tsx`
  - Judul route, breadcrumb, aksi kontekstual, cart indicator, dan account controls.
- `components/app-shell/mobile-shell.tsx`
  - Membungkus susunan mobile sekarang agar regresi mudah dikontrol.
- `components/app-shell/desktop-content.tsx`
  - Menyediakan scroller, padding, serta varian lebar konten.
- `lib/navigation.ts`
  - Satu sumber kebenaran untuk metadata route, label, icon, group, role, breadcrumb, dan visibilitas mobile/desktop.

Komponen lama `Header` dan `BottomNav` tidak langsung dihapus. Keduanya tetap dipakai mobile sampai shell baru stabil.

## 7. Sidebar

### Ukuran dan posisi

- Lebar awal: `224px` pada `lg`, `248px` pada `xl`.
- Tinggi penuh viewport dan tidak ikut scroll bersama konten.
- Border kanan `hairline`, background `canvas`.
- Area menu sendiri dapat di-scroll bila tinggi layar terbatas.

### Susunan

1. **Brand dan toko aktif**
   - Logo/nama Saberaha.
   - Nama toko aktif dan role efektif.
   - Store switcher hanya aktif jika diizinkan.
   - Saat delegated cashier mode, store switcher dinonaktifkan.
2. **Utama**
   - Dashboard.
   - Kasir.
   - Barang.
   - Transaksi.
3. **Operasional**
   - Shift Kasir.
   - Pembeli.
   - Utang.
   - Menu owner tambahan berdasarkan role.
4. **Kelola** untuk owner
   - Kategori.
   - Diskon.
   - Supplier.
   - Pembelian.
   - Pengeluaran.
   - Laporan.
   - Kelola Kasir.
5. **Bagian bawah**
   - Pengaturan.
   - Cadangan Data.
   - Bantuan.
   - Kunci layar.
   - Menu akun/keluar.

### Aturan role

- Gunakan role efektif dari `current_user_role()`.
- Owner melihat seluruh menu owner.
- Kasir hanya melihat menu yang sudah tersedia melalui `KASIR_GROUPS`.
- Owner dalam delegated cashier mode melihat sidebar kasir, bukan sidebar owner.
- Jangan hanya menyembunyikan menu; guard route dan RLS tetap menjadi security boundary.

### Active state

- Gunakan latar `canvas-soft`, teks `ink`, dan indikator biru di sisi kiri.
- Parent route tetap aktif untuk halaman detail, misalnya `/transactions/[id]` mengaktifkan menu Transaksi.
- Badge cart tampil pada item Kasir.
- Badge antrean offline dapat ditambahkan pada item Transaksi setelah data queue tersedia di shell.

### Collapse sidebar

Collapse menjadi icon-only dapat dikerjakan setelah shell stabil. Fase awal memakai sidebar tetap untuk menghindari state, tooltip, dan layout complexity yang belum diperlukan.

## 8. Desktop Header

### Ukuran dan posisi

- Tinggi sekitar `64px`.
- Sticky di atas content scroller.
- Border bawah `hairline`, background `canvas`.
- Tidak memakai safe-area mobile pada desktop.

### Area kiri

- Breadcrumb kecil untuk halaman turunan.
- Judul route 20-24px.
- Deskripsi singkat opsional hanya untuk halaman tingkat atas.
- Tombol kembali hanya untuk alur detail yang memang membutuhkan history, bukan sebagai pengganti sidebar.

### Area kanan

- Aksi kontekstual route, misalnya Tambah Barang atau Export bila relevan.
- Cart indicator.
- Status koneksi/offline jika diperlukan.
- Kunci layar.
- Avatar atau menu akun.

### Delegated cashier mode

- Banner aktif tetap global dan tidak hilang di desktop.
- Pada desktop, banner ditempatkan tepat di bawah header atau sebagai strip status yang menyatu dengan header.
- Teks harus tetap eksplisit: `Mode kasir: @username`, waktu berakhir, dan tombol Kembali.
- State expired/invalid tetap menjadi blocking overlay, bukan hanya pesan visual.

## 9. Content Area

Gunakan tiga varian lebar agar halaman tidak dipaksa memakai layout yang sama:

| Varian | Lebar target | Halaman |
| --- | ---: | --- |
| `wide` | maksimum 1440px | Dashboard, Kasir, Barang, Transaksi, Laporan |
| `standard` | maksimum 1200px | Pembeli, Supplier, Pembelian, Utang, Staff |
| `narrow` | maksimum 840-960px | Pengaturan, form, backup, halaman detail tertentu |
| `full` | seluruh area tersedia | Kasir split-pane, tabel besar bila diperlukan |

Aturan umum:

- Content berada di tengah jika memakai `max-width`.
- Scroll hanya terjadi di workspace atau panel yang memang independen.
- Hindari nested scroll kecuali Kasir dan tabel dengan header sticky.
- Empty state tidak boleh melebar penuh tanpa batas.
- Modal tetap dipakai untuk aksi singkat; form kompleks dapat memakai panel halaman atau drawer kanan desktop.

## 10. Rencana Per Halaman

### Dashboard

- Hero revenue tetap menjadi fokus utama.
- Pada desktop gunakan grid 12 kolom.
- Hero revenue: 8 kolom; quick summary atau stok menipis: 4 kolom.
- Empat stat card menjadi satu baris pada `xl`.
- Grafik penjualan dan produk terlaris dapat berdampingan.
- Transaksi terbaru menjadi tabel/list lebar dengan kolom nota, waktu, pembeli, metode, dan total.
- Quick Actions tetap ada, tetapi lebih ringkas karena sidebar sudah memuat menu permanen.

### Kasir

Kasir menjadi halaman desktop prioritas tertinggi.

Layout target:

```text
┌────────────────────────────────────┬──────────────────┐
│ Search, filter, scan, view          │ Keranjang        │
├────────────────────────────────────┤                  │
│ Kategori / filter aktif             │ Item cart        │
├────────────────────────────────────┤                  │
│ Product grid 3-5 kolom              │ Ringkasan total  │
│                                     │ Checkout CTA     │
└────────────────────────────────────┴──────────────────┘
```

- Panel katalog fleksibel, minimum width kartu dijaga.
- Panel keranjang tetap di kanan dengan lebar `380-420px`.
- Product grid memakai `repeat(auto-fill, minmax(...))` atau breakpoint eksplisit.
- Keranjang punya scroll sendiri; summary dan tombol bayar sticky di bawah panel.
- Ekstrak isi `CartView` menjadi komponen presentasional yang dapat dipakai route `/cart` mobile dan panel desktop.
- Route `/cart` tetap ada untuk mobile dan direct navigation.
- Barcode input mendapat fokus yang lebih kuat untuk perangkat scanner USB.
- Shortcut dasar dapat ditambahkan setelah layout stabil: fokus pencarian dan buka checkout. Jangan memasukkan shortcut dalam fase shell awal.

### Cart Dan Checkout

- Mobile mempertahankan route dan layout saat ini.
- Desktop dari halaman Kasir menggunakan panel cart.
- `/cart` desktop tetap menjadi fallback dan menampilkan layout dua kolom: item di kiri, summary di kanan.
- `/checkout` desktop menggunakan dua kolom:
  - Kiri: metode pembayaran, pembeli, diskon, dan input pembayaran.
  - Kanan: ringkasan order sticky.
- Jangan menduplikasi kalkulasi checkout; hanya pecah markup ke section yang dapat disusun responsif.

### Barang

- Toolbar satu baris: search, scan, filter, view, dan aksi owner.
- Grid produk menjadi 3 kolom pada `lg`, 4 pada `xl`, dan 5 bila ruang cukup.
- List view desktop dapat memakai tabel ringkas dengan nama, kategori, stok, harga beli/jual, dan aksi.
- Bulk action tampil sebagai contextual toolbar sticky ketika ada pilihan.
- Form tambah/edit dapat tetap dialog pada fase awal; evaluasi drawer kanan setelah tabel stabil.

### Transaksi

- Mobile tetap memakai grouped cards.
- Desktop memakai table dengan header sticky.
- Kolom minimum: waktu, nomor nota, pembeli, kasir, item, metode, status, total.
- Search dan range filter berada pada toolbar horizontal.
- Antrean offline tetap muncul di atas table dan tidak tersembunyi.
- Klik baris membuka detail route yang sama.
- Fase lanjutan dapat memakai master-detail, tetapi bukan kebutuhan awal.

### Detail Transaksi Dan Pembelian

- Container `narrow` atau `standard`.
- Summary dan metadata di sisi kiri, item serta pembayaran di sisi kanan pada desktop.
- Print/share menjadi action group di header desktop.
- Informasi `Owner yang bertugas` pada delegated transaction tetap terlihat.

### Laporan

- Filter periode dan export berada di header/toolbar.
- KPI menjadi satu baris.
- Grafik dan breakdown menggunakan grid 2 kolom bila cukup.
- Tabel rincian memakai lebar penuh dan horizontal overflow hanya sebagai fallback.

### Halaman CRUD Operasional

Mencakup Pembeli, Utang, Supplier, Pembelian, Pengeluaran, Diskon, Kategori, Shift, dan Staff.

- Toolbar desktop konsisten: judul section, search/filter, primary action.
- Daftar kartu mobile berubah menjadi table atau denser list pada desktop.
- Form sederhana tetap dialog.
- Form kompleks menggunakan page form atau drawer kanan maksimum `480-560px`.
- Destructive action tetap memerlukan dialog konfirmasi.

### Lainnya Dan Pengaturan

- Route `/more` tetap tersedia untuk mobile.
- Pada desktop, fungsi navigasi `/more` sebagian besar digantikan sidebar.
- `/more` desktop dapat menjadi halaman profil dan account preferences, bukan duplikasi seluruh sidebar.
- Pengaturan menggunakan layout dua kolom bila section bertambah: sub-navigation di kiri dan form di kanan.

## 11. Sumber Metadata Navigasi

Navigasi saat ini tersebar dan berisiko berbeda label atau role. Buat satu registry route dengan bentuk konseptual:

```ts
type AppRoute = {
  href: string
  label: string
  icon: IconComponent
  roles: ("owner" | "kasir")[]
  group: "primary" | "operations" | "manage" | "system"
  mobileTab?: boolean
  parent?: string
  contentWidth?: "full" | "wide" | "standard" | "narrow"
}
```

Registry digunakan oleh:

- Sidebar desktop.
- Bottom navigation mobile.
- Header title dan breadcrumb.
- Halaman Lainnya.
- Quick Actions hanya untuk item yang memang dapat dipilih sebagai quick action.

Business permission tidak boleh hanya bergantung pada registry ini.

## 12. Strategi Implementasi

### Fase 0 - Baseline Dan Kontrak Visual

- Ambil screenshot baseline mobile route utama.
- Definisikan breakpoint `lg` sebagai awal desktop.
- Tetapkan ukuran sidebar, header, content width, spacing, dan z-index.
- Tetapkan matriks route, role, breadcrumb, serta content width.
- Tambahkan viewport E2E desktop: minimal `1280x800` dan `1440x900`.

**Selesai jika:** spesifikasi shell tidak lagi ambigu dan baseline mobile tersedia.

### Fase 1 - Navigation Registry Dan App Shell

- Buat `lib/navigation.ts`.
- Refactor metadata `Header`, `BottomNav`, dan menu Lainnya agar membaca sumber yang sama secara bertahap.
- Buat `AppShell`, `Sidebar`, dan `DesktopHeader`.
- Ubah `app/(main)/layout.tsx` untuk memilih susunan melalui CSS breakpoint.
- Pertahankan urutan provider yang ada.
- Pastikan `NoStoreGuard`, `LockProvider`, dan cashier-mode overlay menutupi seluruh shell.
- Sembunyikan `BottomNav` pada desktop.
- Nonaktifkan interaksi pull-to-refresh pada desktop.

**Selesai jika:** seluruh route dapat dinavigasi dari sidebar, role benar, mobile tidak berubah, dan scroll shell stabil.

### Fase 2 - Responsive Content Foundation

- Tambahkan primitive/container untuk `full`, `wide`, `standard`, dan `narrow`.
- Tambahkan pola `PageToolbar`, `PageSection`, dan desktop table bila penggunaan berulang sudah terbukti.
- Hindari membuat abstraction untuk markup yang hanya dipakai satu halaman.
- Normalisasi spacing `lg/xl`, empty state, skeleton, dan sticky toolbar.

**Selesai jika:** halaman lama terlihat rapi di dalam shell walaupun belum semuanya memakai table/grid desktop khusus.

### Fase 3 - Kasir Desktop

- Ekstrak panel cart reusable dari `CartView` tanpa memindahkan kalkulasi dari `CartProvider`.
- Implementasikan split-pane katalog dan keranjang.
- Tingkatkan product grid dan toolbar pencarian.
- Pastikan modal variant/unit dan scanner tetap bekerja.
- Pastikan cart realtime/offline, held carts, discount, customer, dan checkout tidak berubah perilaku.
- Uji delegated cashier mode di shell desktop.

**Selesai jika:** transaksi dapat diselesaikan dari desktop tanpa harus bolak-balik ke route cart, sementara mobile tetap memakai alur lama.

### Fase 4 - Dashboard Dan Halaman Data Utama

- Adaptasi Dashboard ke grid desktop.
- Adaptasi Barang ke grid/table responsif.
- Adaptasi Transaksi ke desktop table.
- Adaptasi Laporan ke multi-column layout.
- Tambahkan sticky table header dan action toolbar hanya pada layar desktop.

**Selesai jika:** empat halaman frekuensi tinggi memanfaatkan ruang desktop dan tetap terbaca pada resolusi `1024px`.

### Fase 5 - Halaman Operasional Dan Detail

- Adaptasi Pembeli, Utang, Supplier, Pembelian, Pengeluaran, Shift, Staff, Diskon, dan Kategori.
- Adaptasi detail transaksi/pembelian.
- Adaptasi Pengaturan, Backup, dan halaman profil desktop.
- Konsolidasikan pola table/form setelah minimal dua pemakaian nyata.

**Selesai jika:** tidak ada halaman utama yang hanya berupa kolom mobile terlalu lebar di desktop.

### Fase 6 - QA Dan Polish

- Jalankan visual regression mobile dan desktop.
- Audit keyboard navigation, focus ring, tooltip, dan screen reader label.
- Audit scroll, sticky element, dialog, drawer, toast, dan overlay.
- Uji layar `1024x768`, `1280x800`, `1366x768`, `1440x900`, dan `1920x1080`.
- Uji zoom browser 125%, 150%, dan 200%.
- Uji role owner, kasir, delegated kasir aktif, expired, dan invalid.
- Uji online/offline dan antrean transaksi.
- Jalankan lint, typecheck, unit test, E2E, dan production build.

**Selesai jika:** acceptance criteria di bawah terpenuhi tanpa regresi mobile.

## 13. Acceptance Criteria

### Shell

- Pada `<1024px`, header dan bottom navigation mobile tetap tampil seperti sekarang.
- Pada `>=1024px`, sidebar dan desktop header tampil, bottom navigation tersembunyi.
- Sidebar tidak ikut scroll bersama konten.
- Header tetap terlihat saat content area di-scroll.
- Hanya satu content scroller utama kecuali halaman Kasir.
- Route aktif dan breadcrumb benar untuk route detail.

### Role Dan Keamanan

- Kasir tidak melihat menu owner.
- Delegated cashier mode menampilkan menu kasir.
- Store switcher tidak dapat digunakan selama delegated mode.
- Banner delegasi selalu terlihat dan state expired tetap memblokir akses.
- Guard route dan RLS tetap bekerja walaupun user membuka URL langsung.

### Kasir

- Desktop menampilkan produk dan cart secara bersamaan.
- Menambah, mengubah qty, menghapus, memilih customer, dan checkout memakai state cart yang sama dengan mobile.
- Cart badge dan total konsisten di seluruh shell.
- Offline queue mempertahankan attribution context.
- Scanner kamera dan scanner keyboard/USB tetap dapat dipakai.

### Responsive

- Tidak ada horizontal overflow shell pada resolusi target.
- Tabel memiliki fallback horizontal scroll yang terlokalisasi bila benar-benar diperlukan.
- Modal tidak melebihi viewport.
- Mobile visual baseline tidak berubah tanpa alasan yang disetujui.

### Accessibility

- Semua menu dapat dicapai dengan keyboard.
- Focus tidak tersembunyi di balik header sticky.
- Icon-only action memiliki accessible name dan tooltip desktop.
- Active navigation menggunakan penanda visual selain warna saja.
- Urutan tab mengikuti urutan visual.

## 14. Strategi Pengujian

### Unit test

- Route matching dan active navigation.
- Filter menu berdasarkan role.
- Breadcrumb resolution.
- Content width mapping.
- State/sidebar preference bila collapse ditambahkan.

### Component test

- Sidebar owner, kasir, dan delegated kasir.
- Desktop header dengan route utama dan detail.
- Cart panel dengan cart kosong, item banyak, dan offline state.
- Desktop table empty/loading/error/data state.

### E2E

- Owner login -> navigasi sidebar -> halaman owner.
- Kasir login -> menu owner tidak muncul -> transaksi selesai.
- Owner masuk sebagai kasir -> sidebar berubah -> transaksi tercatat -> kembali owner.
- Desktop Kasir: cari produk -> tambah -> ubah qty -> checkout.
- Mobile Kasir: alur lama tetap berfungsi.
- Reload, resize, offline/online, dan expiration delegated mode.

### Visual regression

- Mobile: `390x844`.
- Tablet sempit: `768x1024` tetap memakai shell mobile pada fase awal.
- Desktop minimum: `1024x768`.
- Desktop umum: `1366x768` dan `1440x900`.
- Desktop lebar: `1920x1080`.

## 15. Risiko Dan Mitigasi

### Duplikasi markup mobile dan desktop

**Risiko:** dua versi cepat berbeda perilaku.

**Mitigasi:** bedakan hanya shell dan composition. Reuse provider, actions, query, form, row, card, dan business component.

### Dua layout dirender bersamaan lalu disembunyikan CSS

**Risiko:** effect/query/subscription berjalan dua kali.

**Mitigasi:** jangan me-render dua instance route content. Shell harus memiliki satu `{children}` dan layout adaptif melalui CSS.

### Nested scroll

**Risiko:** wheel, sticky header, dan pull-to-refresh bertabrakan.

**Mitigasi:** satu workspace scroller; nested scroll hanya untuk cart pane atau table yang memang membutuhkan.

### Role flash saat loading

**Risiko:** sidebar sempat menampilkan menu yang salah.

**Mitigasi:** render skeleton navigation sampai role selesai dimuat; default bukan owner.

### Regresi mobile

**Risiko:** refactor shell mengubah tinggi, safe-area, atau bottom nav.

**Mitigasi:** ekstrak susunan mobile apa adanya terlebih dahulu dan gunakan screenshot/E2E baseline.

### Halaman desktop terlalu padat

**Risiko:** semua kartu dipaksa menjadi tabel dan kehilangan hierarchy.

**Mitigasi:** gunakan tabel hanya untuk data berulang; dashboard dan summary tetap memakai card/grid.

### Cashier mode dan store switching

**Risiko:** delegated cashier melihat kontrol owner atau mengganti toko.

**Mitigasi:** sidebar/header membaca role efektif dan status delegasi; kontrol store dibuat disabled/hidden, sementara enforcement database tetap dipertahankan.

## 16. Urutan Rilis Yang Direkomendasikan

1. Navigation registry dan shell desktop.
2. Sidebar role-aware, desktop header, dan delegated-mode status.
3. Kasir split-pane dengan reusable cart panel.
4. Dashboard responsive.
5. Barang dan Transaksi desktop.
6. Laporan dan halaman operasional.
7. Detail, Pengaturan, Backup, dan polish accessibility.

Setiap fase sebaiknya menjadi commit/PR terpisah agar regresi mudah dilacak dan mobile dapat diverifikasi sebelum melanjutkan.

## 17. Definition Of Done

Mode desktop dianggap selesai ketika:

- Seluruh route utama memakai sidebar, header, dan content area pada `>=1024px`.
- Kasir desktop dapat menyelesaikan transaksi dalam split-pane tanpa membuka cart page.
- Halaman data utama memiliki density desktop yang sesuai.
- Owner, kasir, dan delegated cashier melihat navigasi yang benar.
- Mobile tetap lolos baseline visual dan alur transaksi lama.
- Tidak ada query/subscription ganda akibat shell responsif.
- Seluruh unit test, E2E desktop/mobile, lint, typecheck, dan build lulus.
