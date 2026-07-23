"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sparkles, DoorOpen, Map, Share2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
    <nav className="absolute top-1/2 right-2 z-50 -translate-y-1/2">
      <div className="flex flex-col items-center gap-1 rounded-full border-[3px] border-[#3d2b17] bg-card/95 p-2 shadow-[0_6px_0_0_var(--shadow-hard-color)] backdrop-blur">
        {links.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Tooltip key={l.href}>
              <TooltipTrigger
                render={
                  <Button
                    render={<Link href={l.href} />}
                    nativeButton={false}
                    variant="ghost"
                    size="tether-icon"
                    className={cn(
                      "text-muted-foreground hover:bg-[#3d2b17] hover:text-foreground",
                      active &&
                        "bg-orange-500 text-white shadow-[0_3px_0_0_#9a3412] hover:bg-orange-500 hover:text-white",
                    )}
                  />
                }
              >
                <Icon size={18} strokeWidth={2.5} />
              </TooltipTrigger>
              <TooltipContent side="left">{l.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </nav>
  );
}
