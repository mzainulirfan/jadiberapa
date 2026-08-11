"use client"

import { createClient } from "@/lib/supabase/client"

export type CashierDelegation = {
  id: string
  owner_user_id: string
  cashier_user_id: string
  cashier_username: string
  store_id: string
  created_at: string
  expires_at: string
}

export type CashierDelegationStatus = {
  error: string | null
  active: boolean
  status: "none" | "active" | "expired" | "invalid"
  delegation: CashierDelegation | null
}

export async function getCashierDelegationStatus(): Promise<CashierDelegationStatus> {
  const { data, error } = await createClient().rpc("get_cashier_delegation_status")
  if (error) throw error
  return data as CashierDelegationStatus
}
