"use client";

import type { MockMember } from "@/lib/mock-data";
import MemberAvatar from "./MemberAvatar";
import clsx from "clsx";

export default function AvatarTray({
  members,
  selectedId,
  onSelect,
}: {
  members: MockMember[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-3xl border-[3px] border-[#4a3420] bg-[#2a1d10]/95 px-4 py-3 shadow-[0_4px_0_0_rgba(0,0,0,0.3)] backdrop-blur">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-200/40">
        Crew · {members.length}
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={clsx(
              "shrink-0 rounded-full transition",
              selectedId === m.id && "scale-110",
            )}
          >
            <MemberAvatar member={m} size="md" showTimeLabel />
          </button>
        ))}
      </div>
    </div>
  );
}
