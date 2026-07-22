import { Radio, CircleDashed, EyeOff, Clock } from "lucide-react";
import clsx from "clsx";
import type { MockMember } from "@/lib/mock-data";
import { getStatePill, pillToneClasses } from "../lib/format";

const iconFor = {
  green: Radio,
  amber: CircleDashed,
  sky: Clock,
  neutral: EyeOff,
} as const;

export default function StatePill({ member }: { member: MockMember }) {
  const info = getStatePill(member);
  const Icon =
    member.sharingState === "ghost" ? EyeOff : iconFor[info.tone];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        pillToneClasses[info.tone],
      )}
    >
      <Icon size={11} strokeWidth={2.5} />
      {info.label}
    </span>
  );
}
