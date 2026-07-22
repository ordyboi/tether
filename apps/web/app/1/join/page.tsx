"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Users } from "lucide-react";
import { mockRoom, mockMembers } from "@/lib/mock-data";

export default function JoinRoomPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");

  return (
    <div className="px-5 pt-10 pb-32">
      <p className="mb-1 text-xs font-extrabold uppercase tracking-widest text-blue-400">
        You're invited
      </p>
      <h1 className="mb-6 text-3xl font-extrabold text-amber-50">
        Join the crew
      </h1>

      <div className="mb-8 flex items-center gap-4 rounded-3xl border-[3px] border-[#4a3420] bg-[#2a1d10] p-5 shadow-[0_4px_0_0_#150d06]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px] border-blue-400 bg-[#1b140c] text-3xl">
          {mockRoom.emoji}
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-amber-50">
            {mockRoom.name}
          </h2>
          <p className="flex items-center gap-1 text-sm font-bold text-amber-200/50">
            <Users size={14} /> {mockMembers.length} members already in
          </p>
        </div>
      </div>

      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-amber-200/50">
        What should we call you?
      </label>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Your display name"
        className="mb-8 w-full rounded-2xl border-[3px] border-[#4a3420] bg-[#2a1d10] px-4 py-3 text-lg font-bold text-amber-50 placeholder:text-amber-200/30 focus:border-blue-400 focus:outline-none"
      />

      <button
        disabled={!displayName.trim()}
        onClick={() => router.push("/1/room")}
        className="flex w-full items-center justify-center gap-2 rounded-full border-[3px] border-blue-500 bg-blue-500 py-4 text-base font-extrabold text-white shadow-[0_4px_0_0_#1d4ed8] transition active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:border-stone-600 disabled:bg-stone-700 disabled:text-stone-400 disabled:shadow-none"
      >
        <LogIn size={20} strokeWidth={2.5} />
        Join room
      </button>

      <p className="mt-4 text-center text-xs text-amber-200/40">
        Your location is only shared while you're in this room.
      </p>
    </div>
  );
}
