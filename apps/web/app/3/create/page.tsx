"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";

const EMOJI_CHOICES = [
  "🏕️",
  "🥾",
  "🚴",
  "🏔️",
  "🌊",
  "🎡",
  "🎉",
  "🍻",
  "🚗",
  "✈️",
  "🎸",
  "⛺",
  "🏄",
  "🍕",
  "🐾",
  "🌲",
  "🛶",
  "🎿",
  "🌅",
  "🧭",
];

export default function CreateRoomPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);

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
          <h1 className="mb-1 text-lg font-semibold text-neutral-900">
            Create a room
          </h1>
          <p className="mb-6 text-sm text-neutral-500">
            Give it a name and a symbol everyone will recognise.
          </p>

          <label className="mb-1.5 block text-xs font-medium text-neutral-500">
            Room name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Weekend Crew"
            className="mb-5 w-full rounded-2xl border border-neutral-200 bg-white/80 px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-400"
          />

          <label className="mb-1.5 block text-xs font-medium text-neutral-500">
            Emoji
          </label>
          <div className="mb-6 grid grid-cols-5 gap-2">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={clsx(
                  "flex h-11 w-11 items-center justify-center rounded-xl text-xl transition",
                  emoji === e
                    ? "bg-neutral-900 shadow-sm"
                    : "bg-neutral-900/5 hover:bg-neutral-900/10",
                )}
              >
                {e}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => router.push("/3/room")}
            className="flex w-full items-center justify-center rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Launch {emoji} {name.trim() || "room"}
          </button>
        </div>
      </div>
    </main>
  );
}
