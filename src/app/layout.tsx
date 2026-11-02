import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SetupNotice } from "@/components/common/setup-notice";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteUrl } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "BlogSpace", template: "%s · BlogSpace" },
  description:
    "Read articles, publish your own, and talk about them in the comments.",
  openGraph: { type: "website", siteName: "BlogSpace" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1f1c19" },
    { media: "(prefers-color-scheme: light)", color: "#f8f5ef" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider>
            <a
              href="#main"
              className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
            >
              Skip to content
            </a>
            <SiteHeader />
            <SetupNotice />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
            <Toaster richColors closeButton position="bottom-right" theme="system" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
