// Cetak struk ke printer thermal Bluetooth (ESC/POS) via Web Bluetooth.
//
// Catatan: Web Bluetooth hanya tersedia di konteks aman (HTTPS) pada browser
// berbasis Chromium (Chrome/Edge Android & desktop). Karakteristik & service UUID
// printer thermal generik berbeda-beda, jadi kita coba beberapa UUID umum lalu
// cari characteristic apa pun yang bisa ditulis. Fitur ini best-effort dan butuh
// perangkat fisik untuk diverifikasi.

// Service UUID printer thermal BLE yang umum dijumpai.
const SERVICE_UUIDS = [
  0x18f0,
  0xff00,
  0xffe0,
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
]

type BleChar = {
  properties: { write: boolean; writeWithoutResponse: boolean }
  writeValueWithoutResponse?: (data: BufferSource) => Promise<void>
  writeValue: (data: BufferSource) => Promise<void>
}
type BleService = { getCharacteristics: () => Promise<BleChar[]> }
type BleServer = { connect: () => Promise<BleServer>; getPrimaryServices: () => Promise<BleService[]> }
type BleDevice = { gatt?: BleServer }
type BleNavigator = {
  bluetooth?: {
    requestDevice: (opts: {
      acceptAllDevices?: boolean
      optionalServices?: (string | number)[]
    }) => Promise<BleDevice>
  }
}

export function isBluetoothPrintSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as unknown as BleNavigator).bluetooth
}

// Ubah teks (baris) menjadi byte ESC/POS: init, isi, umpan kertas, potong.
function encodeReceipt(lines: string[]): Uint8Array {
  const bytes: number[] = []
  const push = (...b: number[]) => bytes.push(...b)
  const pushText = (s: string) => {
    for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xff)
  }

  push(0x1b, 0x40) // ESC @ — inisialisasi
  for (const line of lines) {
    pushText(line)
    push(0x0a) // line feed
  }
  push(0x0a, 0x0a, 0x0a) // umpan kertas sebelum potong
  push(0x1d, 0x56, 0x42, 0x00) // GS V B 0 — potong kertas (feed+cut)

  return new Uint8Array(bytes)
}

async function findWritableChar(server: BleServer): Promise<BleChar | null> {
  const services = await server.getPrimaryServices()
  for (const service of services) {
    const chars = await service.getCharacteristics()
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) return c
    }
  }
  return null
}

// Kirim struk ke printer terpilih. Melempar Error dengan pesan yang bisa ditampilkan.
export async function printReceiptBluetooth(lines: string[]): Promise<void> {
  const nav = navigator as unknown as BleNavigator
  if (!nav.bluetooth) throw new Error("Perangkat ini tidak mendukung Bluetooth print.")

  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICE_UUIDS,
  })
  if (!device.gatt) throw new Error("Printer tidak dapat dihubungkan.")

  const server = await device.gatt.connect()
  const char = await findWritableChar(server)
  if (!char) throw new Error("Karakteristik tulis printer tidak ditemukan.")

  const payload = encodeReceipt(lines)
  const chunkSize = 180
  const writeWithout = char.properties.writeWithoutResponse && char.writeValueWithoutResponse

  for (let offset = 0; offset < payload.length; offset += chunkSize) {
    const chunk = payload.slice(offset, offset + chunkSize)
    if (writeWithout) {
      await char.writeValueWithoutResponse!(chunk)
    } else {
      await char.writeValue(chunk)
    }
    // Jeda kecil agar buffer printer tidak overflow.
    await new Promise((r) => setTimeout(r, 40))
  }
}
