import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { landingContent, type FeatureIconKey } from "@/lib/landing/content"
import {
  ArrowRight,
  ChartLine,
  ChevronDown,
  Cog,
  Copy,
  Download,
  HelpCircle,
  Package,
  Printer,
  Store,
  User,
  Zap,
} from "@/components/ui/icons"

const featureIconMap: Record<FeatureIconKey, React.ComponentType<{ className?: string }>> = {
  zap: Zap,
  download: Download,
  package: Package,
  user: User,
  cog: Cog,
  chart: ChartLine,
  printer: Printer,
  copy: Copy,
}

export function LandingPage() {
  return (
    <div className="flex h-dvh flex-col overflow-y-auto bg-canvas-soft text-ink">
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <Steps />
        <Features />
        <FaqTeaser />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/icon.svg"
            alt="Logo Saberaha"
            width={30}
            height={30}
            className="rounded-lg"
            priority
          />
          <span className="text-base font-bold tracking-tight text-ink">Saberaha</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/bantuan"
            className="hidden items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink sm:flex"
          >
            <HelpCircle className="size-4" />
            Bantuan
          </Link>
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Masuk
          </Link>
          <Link href="/register" className={cn(buttonVariants({ size: "sm" }))}>
            Buat Toko Gratis
          </Link>
        </nav>
      </div>
    </header>
  )
}

function Hero() {
  const { hero } = landingContent
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1 text-xs font-semibold text-ink-muted">
        <Store className="size-3.5 text-primary" />
        {hero.badge}
      </span>
      <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-bold leading-[1.05] tracking-[-1px] text-ink sm:text-5xl">
        {hero.title}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
        {hero.subtitle}
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/register"
          className={cn(buttonVariants({ size: "lg" }), "w-full rounded-full px-6 sm:w-auto")}
        >
          {hero.primaryCta}
          <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/bantuan"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full rounded-full px-6 sm:w-auto"
          )}
        >
          {hero.secondaryCta}
        </Link>
      </div>
    </section>
  )
}

function Steps() {
  const { steps } = landingContent
  return (
    <section className="border-y border-hairline bg-canvas">
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-[-0.5px] text-ink">
          Mulai dalam 3 langkah
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-2xl border border-hairline bg-canvas-soft p-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {index + 1}
              </span>
              <h3 className="mt-3 font-semibold text-ink">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  const { features } = landingContent
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
      <h2 className="text-center text-2xl font-bold tracking-[-0.5px] text-ink">
        Semua kebutuhan kasir dalam satu aplikasi
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-center text-sm text-ink-muted">
        Fitur yang benar-benar dipakai warung dan UMKM setiap hari.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => {
          const Icon = featureIconMap[feature.icon]
          return (
            <div key={feature.title} className="rounded-2xl border border-hairline bg-canvas p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-ink">{feature.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                {feature.description}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function FaqTeaser() {
  const { faqTeaser } = landingContent
  return (
    <section className="border-y border-hairline bg-canvas">
      <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-[-0.5px] text-ink">
          Pertanyaan umum
        </h2>
        <div className="mt-6 space-y-2">
          {faqTeaser.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-hairline bg-canvas-soft"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold text-ink">
                {item.q}
                <ChevronDown className="size-4 shrink-0 text-ink-faint transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-4 pb-4 text-sm leading-relaxed text-ink-muted">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Masih ada pertanyaan?{" "}
          <Link href="/bantuan" className="font-medium text-primary">
            Lihat FAQ lengkap
          </Link>
        </p>
      </div>
    </section>
  )
}

function FinalCta() {
  const { hero } = landingContent
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 text-center sm:px-6">
      <h2 className="text-2xl font-bold tracking-[-0.5px] text-ink sm:text-3xl">Siap mulai?</h2>
      <p className="mt-2 text-sm text-ink-muted sm:text-base">
        Buat toko Anda sekarang — gratis, tanpa kartu kredit.
      </p>
      <Link
        href="/register"
        className={cn(buttonVariants({ size: "lg" }), "mt-6 inline-flex rounded-full px-6")}
      >
        {hero.primaryCta}
        <ArrowRight className="size-4" />
      </Link>
    </section>
  )
}

function LandingFooter() {
  const { footerNote } = landingContent
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:px-6">
        <p>{footerNote}</p>
        <nav className="flex items-center gap-4">
          <Link href="/login" className="transition-colors hover:text-ink">
            Masuk
          </Link>
          <Link href="/register" className="transition-colors hover:text-ink">
            Daftar
          </Link>
          <Link href="/bantuan" className="transition-colors hover:text-ink">
            Bantuan
          </Link>
        </nav>
      </div>
    </footer>
  )
}
