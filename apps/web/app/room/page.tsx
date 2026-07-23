"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Share2, Ghost, Users, Radio } from "lucide-react";
import { mockRoom, mockMembers, staleness, type SharingState } from "@/lib/mock-data";
import AvatarTray from "../_components/AvatarTray";
import MemberSheet from "../_components/MemberSheet";
import GhostControls from "../_components/GhostControls";

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
      <div className="flex items-center justify-between gap-3 border-b-[3px] border-[#4a3420] bg-[#1b140c] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-orange-500 bg-[#2a1d10] text-lg">
            {mockRoom.emoji}
          </div>
          <div>
            <p className="text-sm font-extrabold leading-tight text-amber-50">
              {mockRoom.name}
            </p>
            <p className="flex items-center gap-1 text-[11px] font-bold text-amber-200/50">
              <Users size={11} /> {members.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full border-2 border-green-500/60 bg-green-500/10 px-2.5 py-1 text-xs font-extrabold text-green-300">
            <Radio size={12} strokeWidth={3} />
            {liveCount} live
          </span>
          <button
            onClick={() => setShowGhostControls(true)}
            className="flex items-center gap-1 rounded-full border-2 border-[#4a3420] bg-[#2a1d10] px-2.5 py-1.5 text-xs font-extrabold text-amber-200/70 hover:text-amber-100"
          >
            <Ghost size={14} strokeWidth={2.5} />
            {self.sharingState === "ghost"
              ? "Ghost"
              : self.sharingState === "approx"
                ? "Blurred"
                : "Exact"}
          </button>
          <Link
            href="/room/share"
            className="flex items-center gap-1 rounded-full border-2 border-orange-600 bg-orange-500 px-2.5 py-1.5 text-xs font-extrabold text-white"
          >
            <Share2 size={14} strokeWidth={2.5} />
            Share
          </Link>
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
