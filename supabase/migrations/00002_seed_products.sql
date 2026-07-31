-- Seed: toko kelontong
-- Jalankan di Supabase > SQL Editor

-- Kategori
insert into categories (name) values
  ('Makanan Pokok'),
  ('Sembako'),
  ('Minuman'),
  ('Makanan Ringan'),
  ('Rumah Tangga')
on conflict (name) do nothing;

-- Barang (category_id diambil dari nama kategori)
insert into products (name, category_id, price_buy, price_sell, stock, sku)
select
  p.name,
  c.id,
  p.price_buy,
  p.price_sell,
  p.stock,
  p.sku
from (
  values
    ('Beras Premium 5kg',       'Makanan Pokok',  52000, 58000, 20, 'BRP-001'),
    ('Beras Medium 5kg',        'Makanan Pokok',  45000, 50000, 15, 'BRM-001'),
    ('Telur Ayam 1kg',          'Makanan Pokok',  24000, 27000, 30, 'TLR-001'),
    ('Gula Pasir 1kg',          'Sembako',        14000, 16500, 40, 'GLP-001'),
    ('Minyak Goreng 1L',        'Sembako',        13000, 15500, 35, 'MYG-001'),
    ('Tepung Terigu 1kg',       'Sembako',        11000, 13500, 25, 'TPT-001'),
    ('Garam 500g',              'Sembako',         4000,  5500, 50, 'GRM-001'),
    ('Kecap Manis 600ml',       'Sembako',        14000, 17000, 20, 'KCP-001'),
    ('Indomie Goreng',          'Makanan Ringan',  2500,  3500, 100, 'IDM-GRG'),
    ('Indomie Soto',            'Makanan Ringan',  2500,  3500, 80,  'IDM-STO'),
    ('Biskuit Roma Kelapa',     'Makanan Ringan',  6000,  8000, 40, 'BSK-001'),
    ('Roti Tawar',              'Makanan Ringan',  8000, 10000, 15, 'RTP-001'),
    ('Air Mineral 600ml',       'Minuman',         3000,  4000, 60, 'AMM-600'),
    ('Teh Botol 350ml',         'Minuman',         3500,  5000, 50, 'THB-350'),
    ('Kopi Sachet (30 pcs)',    'Minuman',        15000, 18500, 30, 'KPS-30'),
    ('Teh Celup 25 pcs',        'Minuman',         7000,  9000, 30, 'THC-25'),
    ('Sabun Mandi 80g',         'Rumah Tangga',    3500,  5000, 40, 'SBM-080'),
    ('Deterjen Bubuk 500g',     'Rumah Tangga',   10000, 12500, 25, 'DTJ-500'),
    ('Shampoo Sachet',          'Rumah Tangga',     800,  1500, 100, 'SHP-SCT'),
    ('Pasta Gigi 100g',         'Rumah Tangga',    9000, 11500, 20, 'PDG-100')
) as p(name, category_name, price_buy, price_sell, stock, sku)
join categories c on c.name = p.category_name
on conflict do nothing;
