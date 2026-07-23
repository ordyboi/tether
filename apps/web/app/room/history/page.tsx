"use client";

import { useState } from "react";
import { Trash2, ShieldCheck, MapPinned } from "lucide-react";
import { mockHistorySegments } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [deleted, setDeleted] = useState(false);

  return (
    <div className="px-5 pt-10 pb-32">
      <p className="mb-1 text-xs font-extrabold tracking-widest text-orange-400 uppercase">
        Trail log
      </p>
      <h1 className="mb-6 text-3xl font-extrabold text-foreground">
        Your history
      </h1>

      <Card variant="tether-dashed" className="mb-6 flex-row items-start gap-3 border-2 px-4 py-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-green-400" size={20} />
        <CardContent className="px-0">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Location history is kept for{" "}
            <strong className="text-amber-100">30 days</strong> and then
            automatically deleted. You can also wipe it early below.
          </p>
        </CardContent>
      </Card>

      {deleted ? (
        <Card variant="tether" className="mb-6 p-8 text-center">
          <CardContent className="px-0">
            <p className="text-sm font-bold text-muted-foreground">
              History cleared. New waypoints will start showing up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ol className="relative mb-6 space-y-4 border-l-[3px] border-border pl-6">
          {mockHistorySegments.map((point, i) => (
            <li key={point.timestamp} className="relative">
              <span
                className="absolute top-1 -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border-[3px] border-background bg-orange-500"
                aria-hidden
              >
                <MapPinned size={10} className="text-white" />
              </span>
              <Card variant="tether" className="border-2 px-4 py-3 shadow-none">
                <CardContent className="px-0">
                  <p className="text-[11px] font-bold tracking-wide text-muted-foreground/70 uppercase">
                    {formatTimestamp(point.timestamp)}
                  </p>
                  <p className="text-sm font-bold text-foreground">{point.label}</p>
                </CardContent>
              </Card>
              {i === mockHistorySegments.length - 1 && (
                <span className="absolute top-8 -left-[9px] text-[10px] font-bold text-muted-foreground/50">
                  now
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      <Button
        onClick={() => setDeleted(true)}
        disabled={deleted}
        variant="tether-danger"
        size="tether-block"
        className="py-3.5"
      >
        <Trash2 size={16} strokeWidth={2.5} />
        Delete my history
      </Button>
    </div>
  );
}
