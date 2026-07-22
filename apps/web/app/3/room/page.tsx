"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { mockRoom, mockMembers } from "@/lib/mock-data";
import type { SharingState } from "@/lib/mock-data";
import MemberSheet, { type SnapPoint } from "../_components/MemberSheet";
import MemberDetailCard from "../_components/MemberDetailCard";
import RoomTopBar from "../_components/RoomTopBar";
import PrecisionSheet from "../_components/PrecisionSheet";

const AtlasMap = dynamic(() => import("../_components/AtlasMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-sm text-neutral-400">
      Loading map…
    </div>
  ),
});

export default function RoomPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<SnapPoint>("peek");
  const [precisionOpen, setPrecisionOpen] = useState(false);
  const [selfGhost, setSelfGhost] = useState(false);
  const [selfBlur, setSelfBlur] = useState<number | null>(null);

  const members = useMemo(() => {
    return mockMembers.map((m) => {
      if (!m.isSelf) return m;
      const sharingState: SharingState = selfGhost
        ? "ghost"
        : selfBlur
          ? "approx"
          : "exact";
      return {
        ...m,
        sharingState,
        blurRadiusM: selfGhost ? null : selfBlur,
      };
    });
  }, [selfGhost, selfBlur]);

  const selected = members.find((m) => m.id === selectedId) ?? null;

  return (
    <main className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-0">
        <AtlasMap
          members={members}
          center={mockRoom.center}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
        />
      </div>

      <RoomTopBar
        emoji={mockRoom.emoji}
        name={mockRoom.name}
        memberCount={members.length}
        onOpenPrecision={() => setPrecisionOpen(true)}
      />

      {selected && (
        <MemberDetailCard member={selected} onClose={() => setSelectedId(null)} />
      )}

      <MemberSheet
        members={members}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
        snap={snap}
        onSnapChange={setSnap}
      />

      {precisionOpen && (
        <PrecisionSheet
          ghost={selfGhost}
          onGhostChange={setSelfGhost}
          blurRadiusM={selfBlur}
          onBlurChange={setSelfBlur}
          onClose={() => setPrecisionOpen(false)}
        />
      )}
    </main>
  );
}
