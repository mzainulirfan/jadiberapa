"use client"

import * as React from "react"

// Menyetel --app-h ke tinggi viewport yang benar-benar terlihat.
// Unit CSS dvh/100dvh tidak andal di browser mobile: saat hard reload address
// bar sedang beranimasi, 100dvh bisa memakai viewport "large" (address bar
// tersembunyi) sehingga app-shell yang terkunci lebih tinggi dari area terlihat
// & bottom nav terdorong ke bawah lipatan (tampak hilang). Mengukur langsung
// visualViewport/innerHeight & memperbarui saat resize membuat tinggi shell
// selalu pas dengan area terlihat.
export function ViewportHeight() {
  React.useEffect(() => {
    const vv = window.visualViewport

    const apply = () => {
      const h = vv?.height ?? window.innerHeight
      document.documentElement.style.setProperty("--app-h", `${Math.round(h)}px`)
    }

    apply()
    window.addEventListener("resize", apply)
    window.addEventListener("orientationchange", apply)
    vv?.addEventListener("resize", apply)
    vv?.addEventListener("scroll", apply)

    return () => {
      window.removeEventListener("resize", apply)
      window.removeEventListener("orientationchange", apply)
      vv?.removeEventListener("resize", apply)
      vv?.removeEventListener("scroll", apply)
    }
  }, [])

  return null
}
