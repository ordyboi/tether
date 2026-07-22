"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { mockRoom, mockMembers } from "@/lib/mock-data";

export default function JoinRoomPage() {
  const router = useRouter();
  const [name, setName] = useState("");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 pb-24">
      <div className="w-full max-w-sm">
        <Link
          href="/3"
          className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft size={15} /> Back
        </Link>

        <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-xl">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
            You've been invited to
          </p>

          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-neutral-900/5 text-3xl">
              {mockRoom.emoji}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-neutral-900">
                {mockRoom.name}
              </h1>
              <p className="text-sm text-neutral-500">
                {mockMembers.length} members already sharing
              </p>
            </div>
          </div>

          <label className="mb-1.5 block text-xs font-medium text-neutral-500">
            Your display name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex"
            className="mb-6 w-full rounded-2xl border border-neutral-200 bg-white/80 px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
          />

          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => router.push("/3/room")}
            className="flex w-full items-center justify-center rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Join room
          </button>
          <p className="mt-3 text-center text-[11px] text-neutral-400">
            You choose what to share once you're in.
          </p>
        </div>
      </div>
    </main>
  );
}
