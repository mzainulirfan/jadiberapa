import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicPage =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/register" ||
    request.nextUrl.pathname.startsWith("/s/")
  // Halaman yang boleh diakses siapa pun: publik baik login maupun tidak.
  // File PWA (/sw.js, /manifest.webmanifest, /offline.html) wajib publik agar
  // browser bisa menilai installability & mendaftarkan service worker.
  const isAlwaysPublicPage =
    request.nextUrl.pathname === "/bantuan" ||
    request.nextUrl.pathname === "/sw.js" ||
    request.nextUrl.pathname === "/manifest.webmanifest" ||
    request.nextUrl.pathname === "/offline.html"
  const isAuthPage = request.nextUrl.pathname.startsWith("/_next") || request.nextUrl.pathname === "/"

  if (!user && !isPublicPage && !isAuthPage && !isAlwaysPublicPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (user && isPublicPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
