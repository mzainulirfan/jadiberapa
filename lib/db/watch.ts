"use client"

import { createClient } from "@/lib/supabase/client"

const supabase = createClient()

export function watchTransactions(onChange: () => void): () => void {
  const channel = supabase
    .channel("transactions-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "transactions" },
      () => onChange()
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
