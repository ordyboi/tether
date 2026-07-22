"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sparkles, DoorOpen, Map, Share2, History } from "lucide-react";
import clsx from "clsx";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/create", label: "Create", icon: Sparkles },
  { href: "/join", label: "Join", icon: DoorOpen },
  { href: "/room", label: "Room", icon: Map },
  { href: "/room/share", label: "Share", icon: Share2 },
  { href: "/room/history", label: "History", icon: History },
];

export default function NavStrip() {
  const pathname = usePathname();

  return (
    <nav className="absolute right-2 top-1/2 z-50 -translate-y-1/2">
      <div className="flex flex-col items-center gap-1 rounded-full border-[3px] border-[#3d2b17] bg-[#2a1d10]/95 p-2 shadow-[0_6px_0_0_#150d06] backdrop-blur">
        {links.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "group relative flex shrink-0 items-center justify-center rounded-full p-2.5 text-xs font-bold transition",
                active
                  ? "bg-orange-500 text-white shadow-[0_3px_0_0_#9a3412]"
                  : "text-amber-200/70 hover:bg-[#3d2b17] hover:text-amber-100",
              )}
            >
              <Icon size={18} strokeWidth={2.5} />
              <span className="pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-lg border-2 border-[#3d2b17] bg-[#2a1d10] px-2 py-1 text-[11px] font-bold text-amber-100 opacity-0 shadow-[0_3px_0_0_#150d06] transition group-hover:opacity-100">
                {l.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
