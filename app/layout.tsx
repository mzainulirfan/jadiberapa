import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Saberaha",
  description: "Aplikasi kasir untuk warung dan UMKM",
  applicationName: "Saberaha",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Saberaha",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas-soft text-ink" suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegister />
        <Toaster
          position="top-right"
          offset={{ top: 80, right: 16, bottom: 16, left: 16 }}
          mobileOffset={{ top: 80, right: 16, bottom: 16, left: 16 }}
        />
      </body>
    </html>
  );
}
