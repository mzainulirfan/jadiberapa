"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Pencil, Trash, Plus, User } from "@/components/ui/icons"
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/lib/actions/customers"
import { useActionState } from "react"

type Customer = { id: string; name: string; phone: string | null; address: string | null }

function CustomerForm({ customer, onDone }: { customer?: Customer | null; onDone: () => void }) {
  const action = customer ? updateCustomer.bind(null, customer.id) : createCustomer
  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, fd: FormData) => {
      const res = await action(fd)
      if (!res.error) onDone()
      return res
    },
    { error: null }
  )

  return (
    <form action={formAction} className="space-y-3">
      <Input name="name" placeholder="Nama" defaultValue={customer?.name} required />
      <Input name="phone" placeholder="Telepon" defaultValue={customer?.phone ?? ""} />
      <Input name="address" placeholder="Alamat" defaultValue={customer?.address ?? ""} />
      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" className="w-full rounded-full" disabled={pending}>
        {pending ? "Menyimpan..." : customer ? "Simpan" : "Tambah"}
      </Button>
    </form>
  )
}

export function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [edit, setEdit] = useState<Customer | null>(null)
  const [open, setOpen] = useState(false)

  async function load() {
    setLoading(true)
    setCustomers(await getCustomers(search || undefined))
    setLoading(false)
  }

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [search])

  async function handleDelete(id: string) {
    if (!confirm("Hapus pembeli ini?")) return
    await deleteCustomer(id)
    load()
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint" />
          <Input placeholder="Cari pembeli..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEdit(null) } }}>
          <DialogTrigger className="rounded-full size-9 p-0 bg-primary text-on-primary flex items-center justify-center" onClick={() => setEdit(null)}>
            <Plus className="size-5" />
          </DialogTrigger>
          <DialogContent className="rounded-xl">
            <DialogHeader><DialogTitle>{edit ? "Edit Pembeli" : "Tambah Pembeli"}</DialogTitle></DialogHeader>
            <CustomerForm customer={edit} onDone={() => { setOpen(false); setEdit(null); load() }} />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 text-ink-faint text-sm">Belum ada pembeli</div>
      ) : (
        <div className="space-y-1">
          {customers.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg bg-canvas border border-hairline p-3">
              <User className="size-8 rounded-full bg-canvas-soft p-1.5 text-ink-muted" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">{c.name}</p>
                <div className="flex items-center gap-2 text-xs text-ink-faint">
                  {c.phone && <span>{c.phone}</span>}
                  {c.address && <span className="truncate">{c.address}</span>}
                </div>
              </div>
              <button
                onClick={() => { setEdit(c); setOpen(true) }}
                className="rounded-lg p-1.5 hover:bg-canvas-soft text-ink-muted"
              >
                <Pencil className="size-4" />
              </button>
              <button onClick={() => handleDelete(c.id)} className="rounded-lg p-1.5 hover:bg-canvas-soft text-ink-muted">
                <Trash className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

