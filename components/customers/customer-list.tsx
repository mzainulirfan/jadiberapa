"use client"

import { useEffect, useState } from "react"
import { useActionState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Pencil, Trash, Plus, User, Phone, LocationPin, Whatsapp } from "@/components/ui/icons"
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/lib/actions/customers"

type Customer = { id: string; name: string; phone: string | null; address: string | null }

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "")
  const normalized = digits.startsWith("0") ? `62${digits.slice(1)}` : digits
  return `https://wa.me/${normalized}`
}

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
      <div>
        <label htmlFor="cust-name" className="mb-1.5 flex items-center gap-2 text-xs text-ink-muted">
          <User className="size-3.5" /> Nama
        </label>
        <Input id="cust-name" name="name" placeholder="Nama pembeli" defaultValue={customer?.name} required />
      </div>
      <div>
        <label htmlFor="cust-phone" className="mb-1.5 flex items-center gap-2 text-xs text-ink-muted">
          <Phone className="size-3.5" /> Telepon
        </label>
        <Input
          id="cust-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="08xxx"
          defaultValue={customer?.phone ?? ""}
        />
      </div>
      <div>
        <label htmlFor="cust-address" className="mb-1.5 flex items-center gap-2 text-xs text-ink-muted">
          <LocationPin className="size-3.5" /> Alamat
        </label>
        <Textarea
          id="cust-address"
          name="address"
          placeholder="Alamat (opsional)"
          defaultValue={customer?.address ?? ""}
          className="min-h-[60px]"
        />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
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
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  async function load() {
    setLoading(true)
    setCustomers(await getCustomers(search || undefined))
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    const t = setTimeout(async () => {
      const list = await getCustomers(search || undefined)
      if (active) {
        setCustomers(list)
        setLoading(false)
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [search])

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    await deleteCustomer(deleteTarget.id)
    setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Cari pembeli..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v)
            if (!v) setEdit(null)
          }}
        >
          <DialogTrigger
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary p-0 text-primary-foreground"
            onClick={() => setEdit(null)}
          >
            <Plus className="size-5" />
          </DialogTrigger>
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle>{edit ? "Edit Pembeli" : "Tambah Pembeli"}</DialogTitle>
            </DialogHeader>
            <CustomerForm
              customer={edit}
              onDone={() => {
                setOpen(false)
                setEdit(null)
                load()
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="py-12 text-center text-sm text-ink-faint">
          {search.trim() ? "Pembeli tidak ditemukan" : "Belum ada pembeli"}
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-hairline bg-canvas p-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas-soft text-sm font-semibold text-ink">
                {c.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                <p className="truncate text-xs text-ink-faint">
                  {[c.phone, c.address].filter(Boolean).join(" · ") || "Tanpa kontak"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {c.phone && (
                  <>
                    <a
                      href={waLink(c.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`WhatsApp ${c.name}`}
                      className="flex size-8 items-center justify-center rounded-lg text-accent-green active:bg-canvas-soft"
                    >
                      <Whatsapp className="size-4" />
                    </a>
                    <a
                      href={`tel:${c.phone}`}
                      aria-label={`Telepon ${c.name}`}
                      className="flex size-8 items-center justify-center rounded-lg text-ink-muted active:bg-canvas-soft"
                    >
                      <Phone className="size-4" />
                    </a>
                    <span className="mx-0.5 h-5 w-px bg-hairline" />
                  </>
                )}
                <button
                  onClick={() => {
                    setEdit(c)
                    setOpen(true)
                  }}
                  aria-label={`Edit ${c.name}`}
                  className="flex size-8 items-center justify-center rounded-lg text-ink-muted active:bg-canvas-soft"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(c)}
                  aria-label={`Hapus ${c.name}`}
                  className="flex size-8 items-center justify-center rounded-lg text-ink-muted active:bg-canvas-soft"
                >
                  <Trash className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Hapus Pembeli?</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; akan dihapus permanen dan tidak bisa dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
