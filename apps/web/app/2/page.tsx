import Link from "next/link";
import { ArrowRight, Users, QrCode, KeyRound } from "lucide-react";
import { mockRoom, mockMembers } from "@/lib/mock-data";
import BottomTabBar from "./components/BottomTabBar";

export default function Direction2Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-sky-500">
          Tether
        </p>
        <h1 className="mb-6 text-2xl font-bold text-neutral-50">
          Where&apos;s everyone at?
        </h1>

        <Link
          href="/2/room"
          className="mb-4 flex items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-700"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-3xl">
            {mockRoom.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-neutral-50">
              {mockRoom.name}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
              <Users size={12} />
              {mockMembers.length} members · live now
            </div>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white">
            Enter room
            <ArrowRight size={13} />
          </span>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/2/create"
            className="flex flex-col items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-700"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
              <KeyRound size={16} />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-50">
                Create a room
              </div>
              <div className="text-xs text-neutral-500">
                Name it, pick an emoji
              </div>
            </div>
          </Link>

          <Link
            href="/2/join"
            className="flex flex-col items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-700"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
              <QrCode size={16} />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-50">
                Join with invite
              </div>
              <div className="text-xs text-neutral-500">
                Have a link? Use it
              </div>
            </div>
          </Link>
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}
