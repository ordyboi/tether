import Link from "next/link";
import { ArrowRight, Sparkles, DoorOpen, Users } from "lucide-react";
import { mockRoom, mockMembers } from "@/lib/mock-data";

export default function TrailheadHome() {
  return (
    <div className="px-5 pt-10 pb-32">
      <p className="mb-1 text-xs font-extrabold uppercase tracking-widest text-orange-400">
        Trailhead
      </p>
      <h1 className="mb-2 text-3xl font-extrabold text-amber-50">
        Where's everyone?
      </h1>
      <p className="mb-8 max-w-sm text-amber-200/60">
        Tether keeps your crew on one map — share a link, appear together,
        gone whenever you leave.
      </p>

      <Link
        href="/1/room"
        className="group mb-6 block rounded-3xl border-[3px] border-[#4a3420] bg-[#2a1d10] p-5 shadow-[0_5px_0_0_#150d06] transition active:translate-y-1 active:shadow-none"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px] border-orange-500 bg-[#1b140c] text-3xl">
            {mockRoom.emoji}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-extrabold text-amber-50">
              {mockRoom.name}
            </h2>
            <p className="flex items-center gap-1 text-sm font-bold text-amber-200/50">
              <Users size={14} /> {mockMembers.length} members active
            </p>
          </div>
          <ArrowRight
            className="text-orange-400 transition group-hover:translate-x-1"
            size={22}
          />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 rounded-full border-[3px] border-orange-600 bg-orange-500 py-3 text-sm font-extrabold text-white shadow-[0_4px_0_0_#9a3412]">
          Enter room
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/1/create"
          className="flex flex-col items-center gap-2 rounded-3xl border-[3px] border-[#4a3420] bg-[#2a1d10] px-4 py-5 text-center shadow-[0_4px_0_0_#150d06] transition active:translate-y-1 active:shadow-none"
        >
          <Sparkles className="text-green-400" size={26} strokeWidth={2.5} />
          <span className="text-sm font-extrabold text-amber-50">
            Create a room
          </span>
          <span className="text-xs text-amber-200/50">Start something new</span>
        </Link>
        <Link
          href="/1/join"
          className="flex flex-col items-center gap-2 rounded-3xl border-[3px] border-[#4a3420] bg-[#2a1d10] px-4 py-5 text-center shadow-[0_4px_0_0_#150d06] transition active:translate-y-1 active:shadow-none"
        >
          <DoorOpen className="text-blue-400" size={26} strokeWidth={2.5} />
          <span className="text-sm font-extrabold text-amber-50">
            Join with invite
          </span>
          <span className="text-xs text-amber-200/50">Got a link? Hop in</span>
        </Link>
      </div>
    </div>
  );
}
