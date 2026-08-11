"use client"

import { useEffect, useState } from "react"

// Reaksi terhadap CSS media query tanpa SSR mismatch. Nilai awal selalu false
// (mobile) agar render server vs client konsisten; diperbarui setelah mount.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])

  return matches
}