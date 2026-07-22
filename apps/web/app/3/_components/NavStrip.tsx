"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/3", label: "Home" },
  { href: "/3/create", label: "Create" },
  { href: "/3/join", label: "Join" },
  { href: "/3/room", label: "Room" },
  { href: "/3/room/share", label: "Share" },
  { href: "/3/room/history", label: "History" },
];

export default function NavStrip() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-3 left-1/2 z-[1000] -translate-x-1/2 px-2"
      aria-label="Prototype navigation"
    >
      <div className="flex max-w-[92vw] items-center gap-0.5 overflow-x-auto rounded-full border border-white/40 bg-white/60 px-1.5 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        <Link
          href="/"
          className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium text-neutral-400 transition hover:text-neutral-600"
          title="Back to all directions"
        >
          ← All
        </Link>
        <div className="h-4 w-px shrink-0 bg-neutral-300/70" />
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition",
                active
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-neutral-600 hover:bg-black/5",
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
