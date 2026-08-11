import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AuthProvider } from "@/components/auth-provider";

const harmony = localFont({
  src: [
    { path: "../fonts/HarmonySN-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/HarmonySN-700.woff2", weight: "700", style: "normal" },
    { path: "../fonts/HarmonySN-900.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-harmony",
  display: "swap",
  fallback: ["PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "sans-serif"],
  adjustFontFallback: false,
});

const monocraft = localFont({
  src: "../fonts/Monocraft-400.woff2",
  variable: "--font-monocraft",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
  adjustFontFallback: false,
});

const dseg7 = localFont({
  src: "../fonts/DSEG7-400.woff2",
  variable: "--font-dseg7",
  display: "swap",
  preload: false,
  fallback: ["monospace"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: {
    default: "Shenicest · 早期产品发现平台",
    template: "%s · Shenicest",
  },
  description: "发现、关注并支持正在被打造的早期产品。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${harmony.variable} ${monocraft.variable} ${dseg7.variable} h-full antialiased`}
      >
        <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
          <a
            href="#main-content"
            className="sr-only fixed left-4 top-4 z-[60] bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only"
          >
            跳到主要内容
          </a>
          <AuthProvider>
            <SiteHeader />
            <main id="main-content" className="flex-1">{children}</main>
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
