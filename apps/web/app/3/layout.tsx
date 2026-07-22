import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./atlas.css";
import NavStrip from "./_components/NavStrip";

export const metadata: Metadata = {
  title: "Tether — Atlas",
  description: "Minimal, native, translucent take on Tether room sharing.",
};

export default function AtlasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className="relative min-h-screen w-full bg-neutral-100 text-neutral-900 antialiased"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {children}
      <NavStrip />
    </div>
  );
}
