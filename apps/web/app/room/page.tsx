"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Share2, Ghost, Users, Radio } from "lucide-react";
import { mockRoom, mockMembers, staleness, type SharingState } from "@/lib/mock-data";
import AvatarTray from "../_components/AvatarTray";
import MemberSheet from "../_components/MemberSheet";
import GhostControls from "../_components/GhostControls";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const RoomMap = dynamic(() => import("../_components/RoomMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#241a0f] text-amber-200/40">
      Loading map…
    </div>
  ),
});

export default function RoomPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGhostControls, setShowGhostControls] = useState(false);
  const [selfSharingState, setSelfSharingState] = useState<SharingState>("exact");
  const [selfBlur, setSelfBlur] = useState<number | null>(null);
  const [focusTarget, setFocusTarget] = useState<
    { lat: number; lng: number; zoom?: number } | null
  >(null);

  const members = useMemo(
    () =>
      mockMembers.map((m) =>
        m.isSelf
          ? {
              ...m,
              sharingState: selfSharingState,
              blurRadiusM: selfSharingState === "approx" ? selfBlur : null,
              lastUpdateSecondsAgo: selfSharingState === "ghost" ? null : 2,
            }
          : m,
      ),
    [selfSharingState, selfBlur],
  );

  const liveCount = members.filter(
    (m) => staleness(m.lastUpdateSecondsAgo) === "live",
  ).length;

  const selectedMember = members.find((m) => m.id === selectedId) ?? null;
  const self = members.find((m) => m.isSelf)!;

  return (
    <div className="flex h-full flex-col">
      {/* status bar */}
      <div className="flex items-center justify-between gap-3 border-b-[3px] border-border bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-orange-500 bg-card text-lg">
            {mockRoom.emoji}
          </div>
          <div>
            <p className="text-sm leading-tight font-extrabold text-foreground">
              {mockRoom.name}
            </p>
            <p className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
              <Users size={11} /> {members.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="live">
            <Radio size={12} strokeWidth={3} />
            {liveCount} live
          </Badge>
          <Button
            onClick={() => setShowGhostControls(true)}
            variant="tether-outline"
            size="tether-pill"
          >
            <Ghost size={14} strokeWidth={2.5} />
            {self.sharingState === "ghost"
              ? "Ghost"
              : self.sharingState === "approx"
                ? "Blurred"
                : "Exact"}
          </Button>
          <Button
            render={<Link href="/room/share" />}
            nativeButton={false}
            variant="tether"
            size="tether-pill"
          >
            <Share2 size={14} strokeWidth={2.5} />
            Share
          </Button>
        </div>
      </div>

      {/* map */}
      <div className="relative flex-1">
        <RoomMap
          members={members}
          center={mockRoom.center}
          selectedId={selectedId}
          onSelectMember={setSelectedId}
          focusTarget={focusTarget}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3">
          <div className="pointer-events-auto">
            <AvatarTray
              members={members}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </div>
      </div>

      {selectedMember && (
        <MemberSheet
          member={selectedMember}
          onClose={() => setSelectedId(null)}
          onFocus={() => {
            setFocusTarget({ lat: selectedMember.lat, lng: selectedMember.lng, zoom: 17 });
            setSelectedId(null);
          }}
        />
      )}

      {showGhostControls && (
        <GhostControls
          sharingState={selfSharingState}
          blurRadiusM={selfBlur}
          onChange={({ sharingState, blurRadiusM }) => {
            setSelfSharingState(sharingState);
            setSelfBlur(blurRadiusM);
          }}
          onClose={() => setShowGhostControls(false)}
        />
      )}
    </div>
  );
}
