import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import NavStrip from "./_components/NavStrip";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Tether",
  description: "See where your crew is, on one shared live map.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body
        className="min-h-full w-full bg-[#1b140c] text-amber-50"
        style={{
          fontFamily:
            '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif',
        }}
      >
        <div className="relative mx-auto flex h-screen max-w-3xl flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto">{children}</main>
          <NavStrip />
        </div>
      </body>
    </html>
  );
}
