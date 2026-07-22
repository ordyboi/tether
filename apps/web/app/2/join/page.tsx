"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, LogIn } from "lucide-react";
import { mockRoom, mockMembers } from "@/lib/mock-data";

export default function JoinRoomPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-sky-500">
        You&apos;re invited
      </p>
      <h1 className="mb-6 text-2xl font-bold text-neutral-50">
        Join a room
      </h1>

      <div className="mb-8 flex items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-3xl">
          {mockRoom.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-neutral-50">
            {mockRoom.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
            <Users size={12} />
            {mockMembers.length} members already sharing
          </div>
        </div>
      </div>

      <label className="mb-1.5 block text-xs font-semibold text-neutral-400">
        Your display name
      </label>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="e.g. Jordan"
        className="mb-6 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-sky-500 focus:outline-none"
      />

      <p className="mb-6 text-xs leading-relaxed text-neutral-500">
        You control what you share once inside — exact location, an
        approximate area, or hidden entirely. Nothing is shared until you
        choose.
      </p>

      <button
        type="button"
        onClick={() => router.push("/2/room")}
        className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-400 active:bg-sky-600"
      >
        <LogIn size={16} />
        Join room
      </button>
    </div>
  );
}
