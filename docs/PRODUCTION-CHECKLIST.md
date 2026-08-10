# Production Checklist

## Database

- Pastikan migration `00001` sampai migration terakhir tercatat di `supabase_migrations.schema_migrations`.
- Jalankan migration baru di staging sebelum production.
- Ambil backup database sebelum migration yang mengubah constraint atau data lama.
- Uji checkout stok cukup, stok kurang, utang, loyalty, dan retry idempotensi.
- Uji restore backup invalid dan pastikan data lama tidak terhapus.

## Authentication and authorization

- Pastikan `SUPABASE_SERVICE_ROLE_KEY` hanya ada di environment server.
- Uji owner, kasir, member pending, dan user tanpa toko.
- Uji reset passcode terhadap user di luar toko aktif.
- Uji upload gambar langsung sebagai kasir.

## PWA and data privacy

- Pastikan service worker versi terbaru aktif.
- Pastikan HTML authenticated tidak masuk cache.
- Uji logout lalu login dengan akun berbeda pada perangkat yang sama.
- Uji transaksi offline, reconnect, dan response yang hilang.

## Monitoring

- Set `NEXT_PUBLIC_ERROR_REPORT_URL` bila endpoint error reporting tersedia.
- Pantau error server action, Supabase RPC, dan antrean offline.
- Review `audit_logs` secara berkala sebagai owner.
- Uji restore backup secara berkala pada project staging.

## Verification commands

```bash
npm ci
npm run lint
npm test
npm run build
npm audit
npx playwright install --with-deps chromium
npm run test:e2e
```
