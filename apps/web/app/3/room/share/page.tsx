"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { mockInvite, mockRoom } from "@/lib/mock-data";

export default function SharePage() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(mockInvite.url);
    } catch {
      // clipboard may be unavailable in the sandbox — fail silently
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 pb-24">
      <div className="w-full max-w-sm">
        <Link
          href="/3/room"
          className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft size={15} /> Back to map
        </Link>

        <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-xl">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
            Invite to
          </p>
          <h1 className="mb-5 flex items-center gap-2 text-lg font-semibold text-neutral-900">
            <span className="text-xl">{mockRoom.emoji}</span> {mockRoom.name}
          </h1>

          <div className="mx-auto mb-5 grid w-40 grid-cols-8 gap-[3px] rounded-2xl bg-white p-3 shadow-sm">
            {Array.from({ length: 64 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-[2px]"
                style={{
                  background:
                    // deterministic pseudo-random pattern for a stable placeholder
                    (i * 37 + i * i * 11) % 5 === 0 ? "#171717" : "transparent",
                }}
              />
            ))}
          </div>
          <p className="mb-5 text-center text-[11px] text-neutral-400">
            QR placeholder — not a scannable code
          </p>

          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white/80 px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-xs text-neutral-600">
              {mockInvite.url}
            </span>
            <button
              onClick={handleCopy}
              className="flex shrink-0 items-center gap-1 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-neutral-900/[0.035] px-4 py-3 text-xs text-neutral-500">
            <span>Expires in {mockInvite.expiresInHours}h</span>
            <span>
              {mockInvite.uses}/{mockInvite.maxUses} uses
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
