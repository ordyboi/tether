import clsx from "clsx";
import type { MockMember } from "@/lib/mock-data";
import StatePill from "./StatePill";
import { formatRelativeTime, stalenessDotClass } from "../lib/format";

export default function MemberRow({
  member,
  onClick,
}: {
  member: MockMember;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-neutral-800/80 px-4 py-3 text-left last:border-b-0 hover:bg-neutral-900/60 active:bg-neutral-900"
    >
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
        style={{ backgroundColor: `${member.color}26` }}
      >
        {member.emoji}
        <span
          className={clsx(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-neutral-950",
            stalenessDotClass(member.lastUpdateSecondsAgo),
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-neutral-100">
            {member.name}
          </span>
          {member.isSelf && (
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
              You
            </span>
          )}
          {member.isOwner && !member.isSelf && (
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
              Owner
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-neutral-500">
          {formatRelativeTime(member.lastUpdateSecondsAgo)}
        </div>
      </div>

      <StatePill member={member} />
    </button>
  );
}
