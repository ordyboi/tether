"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/", label: "← All directions" },
  { href: "/2", label: "Home" },
  { href: "/2/create", label: "Create" },
  { href: "/2/join", label: "Join" },
  { href: "/2/room", label: "Room" },
  { href: "/2/room/share", label: "Share" },
  { href: "/2/room/history", label: "History" },
];

/** Review-only nav strip. Not part of the product surface itself. */
export default function NavStrip() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-neutral-800 bg-neutral-950/95 px-3 py-2 text-xs">
      {links.map((l) => {
        const active = l.href !== "/" && pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={clsx(
              "shrink-0 rounded-full px-2.5 py-1 font-medium transition-colors",
              active
                ? "bg-sky-500 text-white"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
