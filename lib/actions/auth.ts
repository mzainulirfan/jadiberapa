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

  const supabase = await createClient()
  const { data: isMember, error: memberError } = await supabase.rpc(
    "is_current_store_kasir",
    { p_user_id: userId }
  )
  if (memberError || !isMember) {
    return { error: "Kasir tidak ditemukan di toko aktif." }
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPasscode,
  })
  if (error) return { error: error.message }

  revalidatePath("/staff")
  return { error: null }
}

// Hapus akun sendiri (user yang sudah tidak punya keanggotaan toko aktif).
// Memakai service role agar bisa menghapus pengguna dari Supabase Auth.
export async function deleteAccount() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return { error: "Sesi tidak ditemukan" }

  const { data: hasMembership, error: membershipError } = await supabase.rpc(
    "has_approved_membership"
  )
  if (membershipError) return { error: membershipError.message }
  if (hasMembership) {
    return { error: "Keluar dari semua toko terlebih dahulu sebelum menghapus akun." }
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return { error: error.message }

  revalidatePath("/", "layout")
  return { error: null }
}
