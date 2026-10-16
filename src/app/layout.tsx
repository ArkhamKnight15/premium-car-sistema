import type { Metadata, Viewport } from "next";
import { Inter, Michroma } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const michroma = Michroma({ subsets: ["latin"], weight: "400", variable: "--font-michroma", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Premium Car · Gestão", template: "%s · Premium Car" },
  description: "Sistema de gestão interna da Premium Car.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#08080a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${michroma.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
