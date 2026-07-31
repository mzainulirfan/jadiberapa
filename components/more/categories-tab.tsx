"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getCategories, createCategory, updateCategory, deleteCategory } from "@/lib/actions/products"
import { Pencil, Trash, Check, X, Plus, Tag } from "@/components/ui/icons"

type Cat = { id: string; name: string }

export function CategoriesTab() {
  const [cats, setCats] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  async function load() {
    setLoading(true)
    setCats(await getCategories())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!newName.trim()) return
    await createCategory(newName.trim())
    setNewName("")
    load()
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return
    await updateCategory(id, editName.trim())
    setEditId(null)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus kategori?")) return
    await deleteCategory(id)
    load()
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Nama kategori baru"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <Button onClick={handleCreate} className="rounded-full shrink-0 size-9 p-0">
          <Plus className="size-5" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : cats.length === 0 ? (
        <p className="text-sm text-ink-faint text-center py-6">Belum ada kategori</p>
      ) : (
        <div className="space-y-1">
          {cats.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg bg-canvas border border-hairline p-2.5">
              <Tag className="size-4 text-ink-faint shrink-0" />
              {editId === c.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate(c.id)}
                  />
                  <button onClick={() => handleUpdate(c.id)} className="rounded-lg p-1.5 text-accent-green hover:bg-canvas-soft">
                    <Check className="size-4" />
                  </button>
                  <button onClick={() => setEditId(null)} className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas-soft">
                    <X className="size-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-ink">{c.name}</span>
                  <button onClick={() => { setEditId(c.id); setEditName(c.name) }} className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas-soft">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas-soft">
                    <Trash className="size-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

