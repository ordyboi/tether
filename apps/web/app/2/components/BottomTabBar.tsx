"use client";

import Link from "next/link";
import { Home, DoorOpen, Activity, CircleUserRound } from "lucide-react";
import clsx from "clsx";

const tabs = [
  { label: "Home", icon: Home, href: "/2", active: true },
  { label: "Rooms", icon: DoorOpen, href: "/2", active: false },
  { label: "Activity", icon: Activity, href: "/2", active: false },
  { label: "Account", icon: CircleUserRound, href: "/2", active: false },
];

export default function BottomTabBar() {
  return (
    <nav className="grid shrink-0 grid-cols-4 border-t border-neutral-800 bg-neutral-950 pb-[env(safe-area-inset-bottom)]">
      {tabs.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          className={clsx(
            "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
            t.active ? "text-sky-400" : "text-neutral-600",
          )}
        >
          <t.icon size={20} strokeWidth={t.active ? 2.4 : 2} />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
