import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Finanças",
    template: "%s · Finanças",
  },
  description:
    "Um instrumento de navegação para a independência financeira do casal. Atrito zero na entrada, sofisticação no motor.",
  applicationName: "Finanças",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Finanças",
  },
  openGraph: {
    title: "Finanças",
    description: "Gestão financeira do casal, com foco em renda passiva.",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfbf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0d12" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geist.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                "!bg-surface !border-border-strong !border !text-foreground !shadow-md !font-sans",
              title: "!text-foreground",
              description: "!text-muted-foreground",
            },
          }}
        />
      </body>
    </html>
  );
}
