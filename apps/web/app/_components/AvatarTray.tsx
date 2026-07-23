"use client";

import type { MockMember } from "@/lib/mock-data";
import MemberAvatar from "./MemberAvatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
    <Card
      variant="tether"
      className="bg-card/95 px-4 py-3 shadow-[0_4px_0_0_rgba(0,0,0,0.3)] backdrop-blur"
    >
      <CardContent className="px-0">
        <p className="mb-2 text-[10px] font-bold tracking-widest text-muted-foreground/70 uppercase">
          Crew · {members.length}
        </p>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={cn(
                "shrink-0 rounded-full transition",
                selectedId === m.id && "scale-110",
              )}
            >
              <MemberAvatar member={m} size="md" showTimeLabel />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
