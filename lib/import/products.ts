// Parser import massal barang dari teks (tempel Excel/Sheets) atau CSV.
// Fungsi murni: tidak menyentuh browser/DOM sehingga mudah diuji unit.

export type ImportProductRow = {
  line: number
  name: string
  category: string
  priceBuy: number
  priceSell: number
  stock: number
  minStock: number
  unit: string
  sku: string
  barcode: string
  error?: string
}

export type ImportParseResult = {
  rows: ImportProductRow[]
  headerError?: string
}

const DEFAULT_COLUMNS = [
  "nama",
  "kategori",
  "hargabeli",
  "hargajual",
  "stok",
  "stokminimum",
  "satuan",
  "sku",
  "barcode",
]

function normalizeHeader(v: string): string {
  return v.toLowerCase().replace(/[\s_-]/g, "")
}

// Angka dengan koma desimal (1500,5). Template melarang pemisah ribuan.
function parseNumber(v: string): number | null {
  const s = v.trim()
  if (!s) return null
  const n = Number(s.replace(/,/g, "."))
  return Number.isFinite(n) ? n : null
}

function detectDelimiter(line: string): string {
  const tabs = (line.match(/\t/g) ?? []).length
  const commas = (line.match(/,/g) ?? []).length
  return tabs > commas ? "\t" : ","
}

function splitLine(line: string, delim: string): string[] {
  return line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""))
}

export function parseProductImport(text: string): ImportParseResult {
  const lines: { text: string; no: number }[] = []
  text.split(/\r?\n/).forEach((l, i) => {
    if (l.trim() !== "") lines.push({ text: l.trimEnd(), no: i + 1 })
  })
  if (lines.length === 0) return { rows: [], headerError: "Teks kosong" }

  const delim = detectDelimiter(lines[0].text)
  const hasHeader = /nama|harga/.test(lines[0].text.toLowerCase())
  const header = hasHeader ? splitLine(lines[0].text, delim) : DEFAULT_COLUMNS

  const colIndex: Record<string, number> = {}
  header.forEach((h, i) => {
    const key = normalizeHeader(h)
    if (key) colIndex[key] = i
  })

  const nameIdx = colIndex["nama"]
  const sellIdx = colIndex["hargajual"]
  if (hasHeader && (nameIdx === undefined || sellIdx === undefined)) {
    return { rows: [], headerError: "Header harus memiliki kolom Nama dan Harga Jual" }
  }

  const rows: ImportProductRow[] = []
  for (const { text, no } of lines.slice(hasHeader ? 1 : 0)) {
    const cells = splitLine(text, delim)
    const get = (key: string) => {
      const i = colIndex[key]
      return i === undefined ? "" : (cells[i] ?? "")
    }

    const name = get("nama").trim()
    const priceSell = parseNumber(get("hargajual"))
    const priceBuy = parseNumber(get("hargabeli"))
    const stock = Math.round(parseNumber(get("stok")) ?? 0)
    const minStock = Math.round(parseNumber(get("stokminimum")) ?? 0)

    let error: string | undefined
    if (!name) error = "Nama wajib diisi"
    else if (priceSell === null || priceSell <= 0) error = "Harga jual harus angka > 0"
    else if (stock < 0 || minStock < 0) error = "Stok tidak boleh negatif"
    else if (priceBuy !== null && priceBuy < 0) error = "Harga beli tidak boleh negatif"

    rows.push({
      line: no,
      name,
      category: get("kategori").trim(),
      priceBuy: priceBuy && priceBuy > 0 ? priceBuy : 0,
      priceSell: priceSell ?? 0,
      stock,
      minStock,
      unit: get("satuan").trim() || "pcs",
      sku: get("sku").trim(),
      barcode: get("barcode").trim(),
      error,
    })
  }

  return { rows }
}

// Template CSV dengan BOM agar terbuka rapi di Excel/Google Sheets.
export function productImportTemplateCsv(): string {
  const header = "Nama,Kategori,Harga Beli,Harga Jual,Stok,Stok Minimum,Satuan,SKU,Barcode"
  const example = "Indomie Goreng,Makanan,2500,3000,50,5,pcs,IDM-001,8990000000000"
  return `\uFEFF${header}\n${example}\n`
}
