"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import clsx from "clsx";

const EMOJI_CHOICES = [
  "🏕️", "🏔️", "🌲", "🚗", "🎉", "🏖️", "🎪", "🚴",
  "🏈", "🎣", "🌅", "🛶", "🏹", "🐾", "🍕", "🎸",
  "🛹", "🏰", "🚀", "🌈",
];

export default function CreateRoomPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);

  return (
    <div className="px-5 pt-10 pb-32">
      <p className="mb-1 text-xs font-extrabold uppercase tracking-widest text-green-400">
        New room
      </p>
      <h1 className="mb-6 text-3xl font-extrabold text-amber-50">
        Name your crew
      </h1>

      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-amber-200/50">
        Room name
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Weekend Crew"
        className="mb-6 w-full rounded-2xl border-[3px] border-[#4a3420] bg-[#2a1d10] px-4 py-3 text-lg font-bold text-amber-50 placeholder:text-amber-200/30 focus:border-green-500 focus:outline-none"
      />

      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-amber-200/50">
        Pick an emoji
      </label>
      <div className="mb-8 grid grid-cols-5 gap-2 rounded-3xl border-[3px] border-[#4a3420] bg-[#2a1d10] p-4">
        {EMOJI_CHOICES.map((e) => (
          <button
            key={e}
            onClick={() => setEmoji(e)}
            className={clsx(
              "flex aspect-square items-center justify-center rounded-2xl border-[3px] text-2xl transition",
              emoji === e
                ? "border-green-500 bg-green-500/15 scale-105"
                : "border-transparent hover:border-[#5c4326]",
            )}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="mb-8 flex items-center gap-4 rounded-3xl border-[3px] border-dashed border-[#4a3420] bg-[#1b140c] p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-orange-500 bg-[#2a1d10] text-2xl">
          {emoji}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-200/40">
            Preview
          </p>
          <p className="text-lg font-extrabold text-amber-50">
            {name.trim() || "Your room name"}
          </p>
        </div>
      </div>

      <button
        disabled={!name.trim()}
        onClick={() => router.push("/room")}
        className="flex w-full items-center justify-center gap-2 rounded-full border-[3px] border-green-600 bg-green-500 py-4 text-base font-extrabold text-white shadow-[0_4px_0_0_#15803d] transition active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:border-stone-600 disabled:bg-stone-700 disabled:text-stone-400 disabled:shadow-none"
      >
        <Rocket size={20} strokeWidth={2.5} />
        Launch room
      </button>
    </div>
  );
}
