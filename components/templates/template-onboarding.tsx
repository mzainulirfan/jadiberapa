"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { TemplatePicker } from "@/components/templates/template-picker"
import { applyStoreTemplate, skipStoreTemplate } from "@/lib/actions/templates"
import { getStoreTemplateOnboardingState, invalidateAllDataCaches } from "@/lib/db/queries"
import { EMPTY_TEMPLATE_KEY, PENDING_STORE_TEMPLATE_KEY } from "@/lib/templates/options"

type State = "checking" | "hidden" | "choosing" | "applying"

export function TemplateOnboarding({
  enabled,
  pendingTemplateKey,
}: {
  enabled: boolean
  pendingTemplateKey?: string | null
}) {
  const [state, setState] = useState<State>(enabled ? "checking" : "hidden")
  const [selected, setSelected] = useState("kelontong")

  useEffect(() => {
    if (!enabled) return

    let active = true
    async function check() {
      const info = await getStoreTemplateOnboardingState()
      if (!active) return
      const storedPending = window.localStorage.getItem(PENDING_STORE_TEMPLATE_KEY)
      const pending = pendingTemplateKey || storedPending
      if (!info.empty || info.templateKey) {
        if (storedPending) window.localStorage.removeItem(PENDING_STORE_TEMPLATE_KEY)
        setState("hidden")
        return
      }
      if (pending) {
        setSelected(pending)
        setState("applying")
        const res = pending === EMPTY_TEMPLATE_KEY
          ? await skipStoreTemplate()
          : await applyStoreTemplate(pending)
        if (!active) return
        if (storedPending) window.localStorage.removeItem(PENDING_STORE_TEMPLATE_KEY)
        if (res.error) {
          toast.error(res.error)
          setState("choosing")
          return
        }
        invalidateAllDataCaches()
        toast.success(pending === EMPTY_TEMPLATE_KEY ? "Toko dimulai kosong" : "Template diterapkan")
        setState("hidden")
        return
      }
      setState("choosing")
    }
    check()
    return () => {
      active = false
    }
  }, [enabled, pendingTemplateKey])

  async function applySelected() {
    setState("applying")
    const res = selected === EMPTY_TEMPLATE_KEY
      ? await skipStoreTemplate()
      : await applyStoreTemplate(selected)
    if (res.error) {
      toast.error(res.error)
      setState("choosing")
      return
    }
    invalidateAllDataCaches()
    toast.success(selected === EMPTY_TEMPLATE_KEY ? "Toko dimulai kosong" : "Template diterapkan")
    setState("hidden")
  }

  if (!enabled || state === "hidden" || state === "checking") return null

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3">
        <h2 className="text-base font-bold tracking-tight text-ink">Siapkan toko lebih cepat</h2>
        <p className="text-sm text-ink-muted">
          Toko masih kosong. Pilih template agar kategori dan barang contoh langsung tersedia.
        </p>
      </div>
      {state === "applying" ? (
        <div className="rounded-xl border border-hairline bg-canvas p-4 text-sm text-ink-muted">
          Menyiapkan template toko...
        </div>
      ) : (
        <>
          <TemplatePicker value={selected} onChange={setSelected} />
          <Button className="mt-3 w-full" onClick={applySelected}>
            {selected === EMPTY_TEMPLATE_KEY ? "Mulai Kosong" : "Terapkan Template"}
          </Button>
          <p className="mt-2 text-center text-[11px] text-ink-faint">
            Data contoh bisa diedit atau dihapus kapan saja.
          </p>
        </>
      )}
    </div>
  )
}
