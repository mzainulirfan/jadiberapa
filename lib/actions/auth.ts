"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isOwner } from "@/lib/auth/roles"
import { revalidatePath } from "next/cache"

// Passcode = password akun Supabase (email dummy username@app.pos). 6 digit.
function isPasscodeValid(passcode: string): boolean {
  return /^\d{6}$/.test(passcode)
}

// Ganti passcode sendiri. Passcode lama diverifikasi via signInWithPassword,
// lalu password diperbarui melalui updateUser (sesi aktif tetap bertahan).
export async function changePasscode(currentPasscode: string, newPasscode: string) {
  if (!isPasscodeValid(newPasscode)) return { error: "Passcode baru harus 6 digit angka." }
  if (currentPasscode === newPasscode) return { error: "Passcode baru sama dengan yang lama." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: "Sesi tidak ditemukan" }

  // Verifikasi passcode lama: login ulang dengan kredensial saat ini.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPasscode,
  })
  if (verifyError) return { error: "Passcode saat ini salah." }

  const { error } = await supabase.auth.updateUser({ password: newPasscode })
  if (error) return { error: error.message }

  revalidatePath("/more")
  return { error: null }
}

// Reset passcode kasir oleh pemilik toko (via Supabase Auth admin).
export async function resetMemberPasscode(userId: string, newPasscode: string) {
  if (!(await isOwner())) return { error: "Hanya pemilik toko yang bisa reset passcode." }
  if (!isPasscodeValid(newPasscode)) return { error: "Passcode harus 6 digit angka." }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPasscode,
  })
  if (error) return { error: error.message }

  revalidatePath("/staff")
  return { error: null }
}
