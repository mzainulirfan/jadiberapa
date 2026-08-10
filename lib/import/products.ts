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
  const counts = { "\t": 0, ",": 0, ";": 0 }
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '"') {
      if (inQuotes && line[i + 1] === '"') i += 1
      else inQuotes = !inQuotes
    } else if (!inQuotes && line[i] in counts) {
      counts[line[i] as keyof typeof counts] += 1
    }
  }
  const tabs = counts["\t"]
  const commas = counts[","]
  const semis = counts[";"]
  const best = Math.max(tabs, commas, semis)
  if (best === 0) return ","
  if (tabs === best) return "\t"
  if (semis === best) return ";"
  return ","
}

type DelimitedRow = { cells: string[]; line: number }

function parseDelimitedRows(text: string, delim: string, initialLine: number): DelimitedRow[] {
  const rows: DelimitedRow[] = []
  let cells: string[] = []
  let field = ""
  let inQuotes = false
  let line = initialLine
  let rowLine = initialLine

  const finishRow = () => {
    cells.push(field.trim())
    if (cells.some((cell) => cell.trim() !== "")) rows.push({ cells, line: rowLine })
    cells = []
    field = ""
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (inQuotes) {
        inQuotes = false
      } else if (field.trim() === "") {
        field = ""
        inQuotes = true
      } else {
        field += char
      }
    } else if (char === delim && !inQuotes) {
      cells.push(field.trim())
      field = ""
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i += 1
      finishRow()
      line += 1
      rowLine = line
    } else {
      field += char
      if (char === "\n") line += 1
    }
  }

  if (field !== "" || cells.length > 0) finishRow()
  return rows
}

function readDelimitedRows(text: string): DelimitedRow[] {
  const physicalLines = text.replace(/^\uFEFF/, "").split(/\r?\n/)
  const first = physicalLines.findIndex((line) => line.trim() !== "")
  if (first < 0) return []

  const sepDirective = physicalLines[first].trim().match(/^sep=(.)$/i)
  const dataStart = sepDirective
    ? physicalLines.findIndex((line, index) => index > first && line.trim() !== "")
    : first
  if (dataStart < 0) return []
  const firstDataLine = physicalLines[dataStart]
  if (firstDataLine === undefined) return []
  const delim = sepDirective?.[1] ?? detectDelimiter(firstDataLine)
  return parseDelimitedRows(physicalLines.slice(dataStart).join("\n"), delim, dataStart + 1)
}

function escapeDelimitedField(value: string | number, delim: string): string {
  const field = String(value)
  if (!field.includes(delim) && !/["\r\n]/.test(field)) return field
  return `"${field.replace(/"/g, '""')}"`
}

export function parseProductImport(text: string): ImportParseResult {
  const parsedRows = readDelimitedRows(text)
  if (parsedRows.length === 0) return { rows: [], headerError: "Teks kosong" }

  const firstKeys = parsedRows[0].cells.map(normalizeHeader)
  const hasHeader = firstKeys.some((key) => DEFAULT_COLUMNS.includes(key))
  const header = hasHeader ? parsedRows[0].cells : DEFAULT_COLUMNS

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
  for (const { cells, line } of parsedRows.slice(hasHeader ? 1 : 0)) {
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
      line,
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

// Template CSV dengan BOM + perintah `sep=;` agar terbuka rapi sebagai kolom
// terpisah di Excel (locale Indonesia memakai pemisah `;`), bukan jadi 1 kolom.
export function productImportTemplateCsv(): string {
  const sep = ";"
  const header = ["Nama", "Kategori", "Harga Beli", "Harga Jual", "Stok", "Stok Minimum", "Satuan", "SKU", "Barcode"].map((field) => escapeDelimitedField(field, sep)).join(sep)
  const example = ["Indomie Goreng", "Makanan", "2500", "3000", "50", "5", "pcs", "IDM-001", "8990000000000"].map((field) => escapeDelimitedField(field, sep)).join(sep)
  return `\uFEFFsep=${sep}\n${header}\n${example}\n`
}

// ---------------------------------------------------------------------------
// Edit massal (bulk edit): unduh produk sebagai CSV, ubah lewat Excel, unggah
// kembali. Hanya kolom-kolom berikut yang boleh diubah; `ID` hanya penanda baris
// dan stok tidak ikut (stok dijaga lewat riwayat pergerakan stok).
// ---------------------------------------------------------------------------

export type EditProductRow = {
  line: number
  id: string
  name: string
  category: string
  priceBuy: number
  priceSell: number
  minStock: number
  unit: string
  sku: string
  barcode: string
  error?: string
}

export type EditParseResult = {
  rows: EditProductRow[]
  headerError?: string
}

// Urutan kolom CSV edit. `id` penanda baris, `stok` sengaja tidak disertakan.
const EDIT_COLUMNS = [
  "id",
  "nama",
  "kategori",
  "hargabeli",
  "hargajual",
  "stokminimum",
  "satuan",
  "sku",
  "barcode",
]

const EDIT_HEADER = [
  "ID",
  "Nama",
  "Kategori",
  "Harga Beli",
  "Harga Jual",
  "Stok Minimum",
  "Satuan",
  "SKU",
  "Barcode",
]

// Ekspor daftar produk ke CSV edit (bisa difilter `ids` bila ingin hanya produk
// yang dipilih). Stok TIDAK ikut agar tidak bisa diubah lewat edit massal.
export function productsToEditCsv(
  rows: {
    id: string
    name: string
    category: string
    priceBuy: number
    priceSell: number
    minStock: number
    unit: string
    sku: string
    barcode: string
  }[],
  ids?: string[]
): string {
  const sep = ";"
  const selected = ids?.length
    ? rows.filter((r) => ids.includes(r.id))
    : rows
  const header = EDIT_HEADER.map((field) => escapeDelimitedField(field, sep)).join(sep)
  const body = selected
    .map((r) =>
      [r.id, r.name, r.category, r.priceBuy, r.priceSell, r.minStock, r.unit, r.sku || "", r.barcode || ""]
        .map((field) => escapeDelimitedField(field, sep))
        .join(sep)
    )
    .join("\n")
  return `\uFEFFsep=${sep}\n${header}\n${body}\n`
}

export function parseProductEdit(text: string): EditParseResult {
  const parsedRows = readDelimitedRows(text)
  if (parsedRows.length === 0) return { rows: [], headerError: "Teks kosong" }

  const firstKeys = parsedRows[0].cells.map(normalizeHeader)
  const hasHeader = firstKeys.some((key) => EDIT_COLUMNS.includes(key))
  const header = hasHeader ? parsedRows[0].cells : EDIT_COLUMNS

  const colIndex: Record<string, number> = {}
  header.forEach((h, i) => {
    const key = normalizeHeader(h)
    if (key) colIndex[key] = i
  })

  const idIdx = colIndex["id"]
  const nameIdx = colIndex["nama"]
  const sellIdx = colIndex["hargajual"]
  if (hasHeader && (idIdx === undefined || nameIdx === undefined || sellIdx === undefined)) {
    return { rows: [], headerError: "Header harus memuat kolom ID, Nama, dan Harga Jual" }
  }

  const get = (cells: string[], key: string) => {
    const i = colIndex[key]
    return i === undefined ? "" : (cells[i] ?? "").trim()
  }

  const rows: EditProductRow[] = []
  for (const { cells, line } of parsedRows.slice(hasHeader ? 1 : 0)) {
    const id = get(cells, "id")
    const name = get(cells, "nama")
    const priceSell = parseNumber(get(cells, "hargajual"))
    const priceBuy = parseNumber(get(cells, "hargabeli"))
    const minStock = Math.round(parseNumber(get(cells, "stokminimum")) ?? 0)

    let error: string | undefined
    if (!id) error = "ID kosong; edit massal hanya untuk barang yang sudah ada"
    else if (!name) error = "Nama wajib diisi"
    else if (priceSell === null || priceSell <= 0) error = "Harga jual harus angka > 0"
    else if (minStock < 0) error = "Stok minimum tidak boleh negatif"
    else if (priceBuy !== null && priceBuy < 0) error = "Harga beli tidak boleh negatif"

    rows.push({
      line,
      id,
      name,
      category: get(cells, "kategori"),
      priceBuy: priceBuy && priceBuy > 0 ? priceBuy : 0,
      priceSell: priceSell ?? 0,
      minStock,
      unit: get(cells, "satuan") || "pcs",
      sku: get(cells, "sku"),
      barcode: get(cells, "barcode"),
      error,
    })
  }

  return { rows }
}
