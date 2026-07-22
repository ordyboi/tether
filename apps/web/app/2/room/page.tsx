"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Settings, Map as MapIcon, List } from "lucide-react";
import clsx from "clsx";
import { mockRoom, mockMembers, type SharingState } from "@/lib/mock-data";
import BottomSheet from "../components/BottomSheet";
import MemberRow from "../components/MemberRow";
import RoomSettingsSheet from "./RoomSettingsSheet";

const RoomMap = dynamic(() => import("./RoomMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-xs text-neutral-600">
      Loading map…
    </div>
  ),
});

type Tab = "map" | "roster";

export default function RoomPage() {
  const [tab, setTab] = useState<Tab>("map");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selfSharing, setSelfSharing] = useState<SharingState>("exact");
  const [selfBlur, setSelfBlur] = useState<number | null>(null);

  const members = useMemo(
    () =>
      mockMembers.map((m) =>
        m.isSelf
          ? {
              ...m,
              sharingState: selfSharing,
              blurRadiusM: selfBlur,
              lastUpdateSecondsAgo: selfSharing === "ghost" ? null : 4,
            }
          : m,
      ),
    [selfSharing, selfBlur],
  );

  const focusedMember = members.find((m) => m.id === focusedId) ?? null;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-950 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-lg">{mockRoom.emoji}</span>
          <span className="truncate text-sm font-semibold text-neutral-100">
            {mockRoom.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-neutral-800 bg-neutral-900 p-0.5 text-xs font-medium">
            <button
              onClick={() => setTab("map")}
              className={clsx(
                "flex items-center gap-1 rounded-full px-3 py-1.5 transition",
                tab === "map"
                  ? "bg-sky-500 text-white"
                  : "text-neutral-500 hover:text-neutral-300",
              )}
            >
              <MapIcon size={12} />
              Map
            </button>
            <button
              onClick={() => setTab("roster")}
              className={clsx(
                "flex items-center gap-1 rounded-full px-3 py-1.5 transition",
                tab === "roster"
                  ? "bg-sky-500 text-white"
                  : "text-neutral-500 hover:text-neutral-300",
              )}
            >
              <List size={12} />
              Roster
            </button>
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-100"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {tab === "map" ? (
          <>
            <RoomMap members={members} focusedMember={focusedMember} />
            <BottomSheet
              title="Roster"
              subtitle={`${members.length} members`}
            >
              <div>
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    onClick={() => setFocusedId(m.id)}
                  />
                ))}
              </div>
            </BottomSheet>
          </>
        ) : (
          <div className="h-full overflow-y-auto">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                onClick={() => {
                  setFocusedId(m.id);
                  setTab("map");
                }}
              />
            ))}
          </div>
        )}

        <RoomSettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          sharingState={selfSharing}
          blurRadiusM={selfBlur}
          onChangePrecision={(state, blur) => {
            setSelfSharing(state);
            setSelfBlur(blur);
          }}
          onToggleGhost={() =>
            setSelfSharing((s) => (s === "ghost" ? "exact" : "ghost"))
          }
        />
      </div>
    </div>
  );
}
