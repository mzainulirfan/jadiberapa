import { describe, expect, it } from "vitest"
import {
  parseProductImport,
  productImportTemplateCsv,
  type ImportProductRow,
} from "@/lib/import/products"

const validRows = (rows: ImportProductRow[]) => rows.filter((r) => !r.error)

describe("parseProductImport", () => {
  it("memparse CSV dengan header dan kolom lengkap", () => {
    const text =
      "Nama,Kategori,Harga Beli,Harga Jual,Stok,Stok Minimum,Satuan,SKU,Barcode\n" +
      "Indomie Goreng,Makanan,2500,3000,50,5,pcs,IDM-001,8990000000000\n" +
      "Teh Botol,Minuman,2000,3000,,,botol,TH-001,\n"
    const { rows, headerError } = parseProductImport(text)
    expect(headerError).toBeUndefined()
    expect(rows).toHaveLength(2)
    const v = validRows(rows)
    expect(v).toHaveLength(2)
    expect(v[0]).toMatchObject({
      name: "Indomie Goreng",
      category: "Makanan",
      priceBuy: 2500,
      priceSell: 3000,
      stock: 50,
      minStock: 5,
      unit: "pcs",
      sku: "IDM-001",
      barcode: "8990000000000",
    })
    expect(v[1]).toMatchObject({ name: "Teh Botol", stock: 0, unit: "botol" })
  })

  it("memparse teks tab-separated (tempel dari spreadsheet)", () => {
    const text = "Nama\tHarga Jual\tStok\nKopi Sachet\t1000\t20\n"
    const { rows, headerError } = parseProductImport(text)
    expect(headerError).toBeUndefined()
    const v = validRows(rows)
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ name: "Kopi Sachet", priceSell: 1000, stock: 20 })
  })

  it("memparsing angka desimal koma", () => {
    const { rows } = parseProductImport("Nama,Harga Jual\nBeras 1kg,2500,5\n")
    const v = validRows(rows)
    expect(v[0].priceSell).toBe(2500)
  })

  it("mendeteksi baris tanpa header memakai urutan kolom default", () => {
    const text = "Aqua Galon,Minuman,10000,15000,10,2,galon,AG-1,899\n"
    const { rows, headerError } = parseProductImport(text)
    expect(headerError).toBeUndefined()
    const v = validRows(rows)
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({
      name: "Aqua Galon",
      category: "Minuman",
      priceBuy: 10000,
      priceSell: 15000,
      stock: 10,
      minStock: 2,
      unit: "galon",
      sku: "AG-1",
      barcode: "899",
    })
  })

  it("menandai baris yang gagal validasi", () => {
    const text =
      "Nama,Kategori,Harga Beli,Harga Jual,Stok,Stok Minimum\n" +
      "Roti Tawar,Kue,,5000,10,2\n" +
      ",Minuman,,,,\n" +
      "Susu,Makanan,3000,0,1,0\n"
    const { rows } = parseProductImport(text)
    expect(rows).toHaveLength(3)
    const v = validRows(rows)
    expect(v).toHaveLength(1)
    expect(v[0].name).toBe("Roti Tawar")
    const errs = rows.filter((r) => r.error)
    expect(errs).toHaveLength(2)
    expect(errs[0].name).toBe("")
    expect(errs[1].name).toBe("Susu")
    expect(errs[1].error).toMatch(/Harga jual/)
  })

  it("mengembalikan headerError bila header tanpa kolom Nama/Harga Jual", () => {
    const { headerError } = parseProductImport("Nama Barang,Stok\nA,1\n")
    expect(headerError).toBeTruthy()
  })

  it("mengembalikan error untuk teks kosong", () => {
    const { headerError, rows } = parseProductImport("  \n\n")
    expect(headerError).toBe("Teks kosong")
    expect(rows).toHaveLength(0)
  })

  it("template CSV memuat header yang benar", () => {
    const csv = productImportTemplateCsv()
    expect(csv).toContain("sep=;")
    expect(csv).toContain("Nama;Kategori;Harga Beli;Harga Jual")
    expect(csv).toContain("Indomie Goreng")
  })

  it("memparse template semicolon yang berawalan sep=; (didownload lalu dibuka ulang)", () => {
    const { rows, headerError } = parseProductImport(productImportTemplateCsv())
    expect(headerError).toBeUndefined()
    const v = validRows(rows)
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({
      name: "Indomie Goreng",
      category: "Makanan",
      priceBuy: 2500,
      priceSell: 3000,
      stock: 50,
      minStock: 5,
      unit: "pcs",
      sku: "IDM-001",
      barcode: "8990000000000",
    })
  })
})
