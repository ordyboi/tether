import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import NavStrip from "./components/NavStrip";

export const metadata: Metadata = {
  title: "Tether — Transit",
};

export default function Direction2Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <NavStrip />
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}
