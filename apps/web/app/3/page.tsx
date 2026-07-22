import Link from "next/link";
import { mockRoom, mockMembers } from "@/lib/mock-data";

export default function AtlasHome() {
  const onlineCount = mockMembers.filter(
    (m) => m.sharingState !== "ghost",
  ).length;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 pb-24">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-400">
            Atlas
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Tether
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            See everyone, calmly, on one map.
          </p>
        </div>

        <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-neutral-900/5 text-3xl">
              {mockRoom.emoji}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-neutral-900">
                {mockRoom.name}
              </h2>
              <p className="text-sm text-neutral-500">
                {mockMembers.length} members · {onlineCount} sharing now
              </p>
            </div>
          </div>

          <Link
            href="/3/room"
            className="mt-6 flex w-full items-center justify-center rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.98]"
          >
            Enter room
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            href="/3/create"
            className="rounded-2xl border border-white/60 bg-white/50 px-4 py-4 text-center text-sm font-medium text-neutral-700 shadow-sm backdrop-blur-xl transition hover:bg-white/70"
          >
            Create a room
          </Link>
          <Link
            href="/3/join"
            className="rounded-2xl border border-white/60 bg-white/50 px-4 py-4 text-center text-sm font-medium text-neutral-700 shadow-sm backdrop-blur-xl transition hover:bg-white/70"
          >
            Join with invite
          </Link>
        </div>
      </div>
    </main>
  );
}
