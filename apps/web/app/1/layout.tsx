import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import NavStrip from "./_components/NavStrip";

export const metadata: Metadata = {
  title: "Trailhead — Tether",
  description: "Warm, playful, illustrated design direction for Tether.",
};

export default function TrailheadLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className="min-h-screen w-full bg-[#1b140c] text-amber-50"
      style={{
        fontFamily:
          '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="mx-auto flex h-screen max-w-3xl flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
        <NavStrip />
      </div>
    </div>
  );
}
