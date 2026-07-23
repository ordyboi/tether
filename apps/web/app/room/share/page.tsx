"use client";

import { useState } from "react";
import { Copy, Check, Clock, Users2 } from "lucide-react";
import { mockInvite } from "@/lib/mock-data";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function SharePage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mockInvite.url);
    } catch {
      // clipboard may be unavailable in this sandbox — still flip the UI
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="px-5 pt-10 pb-32">
      <p className="mb-1 text-xs font-extrabold tracking-widest text-orange-400 uppercase">
        Invite
      </p>
      <h1 className="mb-6 text-3xl font-extrabold text-foreground">
        Bring in the crew
      </h1>

      {/* QR placeholder */}
      <Card variant="tether" className="mb-6 items-center p-6">
        <CardContent className="flex flex-col items-center px-0">
          <div
            className="mb-3 grid grid-cols-8 grid-rows-8 gap-[3px] rounded-xl bg-amber-50 p-3"
            aria-hidden
          >
            {Array.from({ length: 64 }).map((_, i) => {
              // deterministic pseudo-random pattern, purely decorative
              const on = (i * 17 + Math.floor(i / 8) * 5) % 7 < 3;
              const isCorner =
                (i < 8 && (i % 8) < 3) ||
                (i >= 40 && i < 48 && (i % 8) < 3) ||
                (i < 24 && i % 8 >= 5);
              return (
                <span
                  key={i}
                  className={`h-3.5 w-3.5 rounded-[2px] ${
                    isCorner || on ? "bg-[#1b140c]" : "bg-transparent"
                  }`}
                />
              );
            })}
          </div>
          <p className="text-xs font-bold tracking-widest text-muted-foreground/70 uppercase">
            QR placeholder — not a real code
          </p>
        </CardContent>
      </Card>

      <Label>Invite link</Label>
      <div className="mb-6 flex items-center gap-2 rounded-2xl border-[3px] border-border bg-background p-2 pl-4">
        <span className="flex-1 truncate font-mono text-sm text-foreground">
          {mockInvite.url}
        </span>
        <Button onClick={handleCopy} variant="tether" size="tether-pill" className="rounded-xl">
          {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} strokeWidth={3} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card variant="tether" className="flex-row items-center gap-3 border-2 px-4 py-3 shadow-none">
          <Clock className="text-amber-300" size={20} />
          <CardContent className="px-0">
            <p className="text-[10px] font-bold tracking-wide text-muted-foreground/70 uppercase">
              Expires
            </p>
            <p className="text-sm font-extrabold text-foreground">
              {mockInvite.expiresInHours}h from now
            </p>
          </CardContent>
        </Card>
        <Card variant="tether" className="flex-row items-center gap-3 border-2 px-4 py-3 shadow-none">
          <Users2 className="text-amber-300" size={20} />
          <CardContent className="px-0">
            <p className="text-[10px] font-bold tracking-wide text-muted-foreground/70 uppercase">
              Uses
            </p>
            <p className="text-sm font-extrabold text-foreground">
              {mockInvite.uses} / {mockInvite.maxUses}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
