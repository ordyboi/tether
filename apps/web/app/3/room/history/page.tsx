"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Route, Trash2 } from "lucide-react";
import { mockHistorySegments, mockRoom } from "@/lib/mock-data";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [deleted, setDeleted] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 pb-24">
      <div className="w-full max-w-sm">
        <Link
          href="/3/room"
          className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft size={15} /> Back to map
        </Link>

        <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2">
            <Route size={17} className="text-neutral-500" />
            <h1 className="text-lg font-semibold text-neutral-900">
              Today's trail
            </h1>
          </div>

          <p className="mb-5 text-sm text-neutral-500">
            {mockRoom.name} keeps a light trail of where the room has been,
            drawn as a soft line on the map behind the live markers — not a
            precise tracklog, just enough context to see the shape of the day.
          </p>

          {deleted ? (
            <div className="rounded-2xl bg-neutral-900/[0.035] px-4 py-6 text-center text-sm text-neutral-400">
              History cleared for this room.
            </div>
          ) : (
            <ul className="mb-5 space-y-0">
              {mockHistorySegments.map((h, i) => (
                <li key={h.timestamp} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900/5">
                      <MapPin size={12} className="text-neutral-500" />
                    </div>
                    {i < mockHistorySegments.length - 1 && (
                      <div className="my-0.5 w-px flex-1 bg-neutral-200" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-xs font-medium text-neutral-400">
                      {formatTime(h.timestamp)}
                    </p>
                    <p className="text-sm text-neutral-800">{h.label}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mb-4 rounded-2xl bg-neutral-900/[0.035] px-4 py-3 text-xs text-neutral-500">
            History is kept for {mockRoom.retentionDays} days, then deleted
            automatically. Only room members can see it.
          </div>

          <button
            onClick={() => setDeleted(true)}
            disabled={deleted}
            className="flex w-full items-center justify-center gap-1.5 rounded-full border border-red-200 bg-red-50/70 px-5 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={14} /> Delete my history
          </button>
        </div>
      </div>
    </main>
  );
}
