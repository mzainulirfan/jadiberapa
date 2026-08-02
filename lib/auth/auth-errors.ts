// Menerjemahkan pesan error Supabase Auth ke Bahasa Indonesia yang ramah pengguna.
export function translateAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes("invalid login credentials")) return "Username atau passcode salah"
  if (lower.includes("user not found")) return "Username atau passcode salah"
  if (lower.includes("email not confirmed")) return "Akun belum dikonfirmasi"
  if (lower.includes("already registered") || lower.includes("user already")) {
    return "Username sudah terdaftar"
  }
  if (lower.includes("password should be at least")) return "Passcode terlalu pendek"
  if (lower.includes("unable to validate email")) return "Username tidak valid"
  if (lower.includes("database error saving new user")) return "Gagal membuat akun. Coba lagi"
  if (lower.includes("too many requests") || lower.includes("rate limit")) {
    return "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi"
  }
  return message
}
