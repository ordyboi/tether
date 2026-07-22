"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Timer, Users2, QrCode } from "lucide-react";
import { mockInvite } from "@/lib/mock-data";

export default function ShareRoomPage() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard?.writeText(mockInvite.url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
      <Link
        href="/2/room"
        className="mb-5 flex w-fit items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-300"
      >
        <ArrowLeft size={14} />
        Back to room
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-neutral-50">
        Share this room
      </h1>

      {/* Fake QR placeholder — no QR library installed, this is a labeled visual stand-in. */}
      <div className="mb-6 flex flex-col items-center rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
        <div
          className="mb-3 grid h-40 w-40 grid-cols-8 grid-rows-8 gap-[3px] rounded-lg bg-white p-2"
          aria-hidden
        >
          {Array.from({ length: 64 }).map((_, i) => (
            <div
              key={i}
              className={
                // deterministic pseudo-random pattern for a stable placeholder
                (i * 7 + Math.floor(i / 8) * 3) % 5 < 2
                  ? "bg-neutral-950"
                  : "bg-transparent"
              }
            />
          ))}
        </div>
        <p className="flex items-center gap-1 text-[11px] font-medium text-neutral-600">
          <QrCode size={12} />
          Placeholder QR — not scannable
        </p>
      </div>

      <label className="mb-1.5 block text-xs font-semibold text-neutral-400">
        Invite link
      </label>
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-3">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-300">
          {mockInvite.url}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-400"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3.5">
          <Timer size={15} className="text-neutral-500" />
          <span className="flex-1 text-sm text-neutral-300">Expires in</span>
          <span className="text-sm font-medium text-neutral-100">
            {mockInvite.expiresInHours}h
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Users2 size={15} className="text-neutral-500" />
          <span className="flex-1 text-sm text-neutral-300">Uses</span>
          <span className="text-sm font-medium text-neutral-100">
            {mockInvite.uses} / {mockInvite.maxUses}
          </span>
        </div>
      </div>
    </div>
  );
}
