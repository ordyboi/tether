"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Sparkles,
  DoorOpen,
  Map,
  Share2,
  History,
  ArrowLeftCircle,
} from "lucide-react";
import clsx from "clsx";

const links = [
  { href: "/1", label: "Home", icon: Home },
  { href: "/1/create", label: "Create", icon: Sparkles },
  { href: "/1/join", label: "Join", icon: DoorOpen },
  { href: "/1/room", label: "Room", icon: Map },
  { href: "/1/room/share", label: "Share", icon: Share2 },
  { href: "/1/room/history", label: "History", icon: History },
];

export default function NavStrip() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3">
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border-[3px] border-[#3d2b17] bg-[#2a1d10]/95 px-2 py-2 shadow-[0_6px_0_0_#150d06] backdrop-blur">
        {links.map((l) => {
          const active =
            l.href === "/1" ? pathname === "/1" : pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition",
                active
                  ? "bg-orange-500 text-white shadow-[0_3px_0_0_#9a3412]"
                  : "text-amber-200/70 hover:bg-[#3d2b17] hover:text-amber-100",
              )}
            >
              <Icon size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">{l.label}</span>
            </Link>
          );
        })}
        <Link
          href="/"
          className="ml-1 flex shrink-0 items-center gap-1.5 rounded-full border-l-2 border-[#3d2b17] pl-2 pr-3 py-2 text-xs font-bold text-amber-200/50 hover:text-amber-100"
        >
          <ArrowLeftCircle size={16} strokeWidth={2.5} />
          <span className="hidden sm:inline">All directions</span>
        </Link>
      </div>
    </nav>
  );
}
