import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/sidebar";
import { TitleBar } from "@/components/titlebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DocuVault",
  description: "AI-Powered Document Management",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} dark`}
      style={{ height: "100%" }}
    >
      <body style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-canvas)", color: "var(--fg-primary)", WebkitFontSmoothing: "antialiased" }}>
        <Providers>
          <TitleBar />
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <Sidebar />
            <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--bg-canvas)" }}>
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
