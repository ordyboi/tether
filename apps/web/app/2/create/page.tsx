"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import clsx from "clsx";

const EMOJI_OPTIONS = [
  "🏕️", "🚗", "🎉", "🏔️", "🌊", "🎿",
  "🚴", "🎪", "🐾", "🍕", "🎸", "🛶",
  "🏖️", "🚌", "🎯", "🧗", "🛹", "🏈",
  "🎡", "🔥",
];

export default function CreateRoomPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_OPTIONS[0]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-sky-500">
        New room
      </p>
      <h1 className="mb-6 text-2xl font-bold text-neutral-50">
        Create a room
      </h1>

      <label className="mb-1.5 block text-xs font-semibold text-neutral-400">
        Room name
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Weekend Crew"
        className="mb-6 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-sky-500 focus:outline-none"
      />

      <label className="mb-1.5 block text-xs font-semibold text-neutral-400">
        Emoji
      </label>
      <div className="mb-8 grid grid-cols-5 gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-3">
        {EMOJI_OPTIONS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEmoji(e)}
            className={clsx(
              "flex h-11 w-11 items-center justify-center rounded-xl text-xl transition",
              emoji === e
                ? "bg-sky-500/20 ring-2 ring-sky-500"
                : "hover:bg-neutral-800",
            )}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-2xl">
          {emoji}
        </div>
        <div className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-300">
          {name || "Untitled room"}
        </div>
      </div>

      <button
        type="button"
        onClick={() => router.push("/2/room")}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-400 active:bg-sky-600"
      >
        <Rocket size={16} />
        Launch room
      </button>
    </div>
  );
}
