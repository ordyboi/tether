"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import clsx from "clsx";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const EMOJI_CHOICES = [
  "🏕️", "🏔️", "🌲", "🚗", "🎉", "🏖️", "🎪", "🚴",
  "🏈", "🎣", "🌅", "🛶", "🏹", "🐾", "🍕", "🎸",
  "🛹", "🏰", "🚀", "🌈",
];

export default function CreateRoomPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);

  return (
    <div className="px-5 pt-10 pb-32">
      <p className="mb-1 text-xs font-extrabold tracking-widest text-green-400 uppercase">
        New room
      </p>
      <h1 className="mb-6 text-3xl font-extrabold text-foreground">
        Name your crew
      </h1>

      <Label htmlFor="room-name">Room name</Label>
      <Input
        id="room-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Weekend Crew"
        className="mb-6 focus-visible:border-green-500 focus-visible:ring-green-500/50"
      />

      <Label>Pick an emoji</Label>
      <Card variant="tether" className="mb-8 grid grid-cols-5 gap-2 p-4">
        {EMOJI_CHOICES.map((e) => (
          <button
            key={e}
            onClick={() => setEmoji(e)}
            className={clsx(
              "flex aspect-square items-center justify-center rounded-2xl border-[3px] text-2xl transition",
              emoji === e
                ? "scale-105 border-green-500 bg-green-500/15"
                : "border-transparent hover:border-[#5c4326]",
            )}
          >
            {e}
          </button>
        ))}
      </Card>

      <Card variant="tether-dashed" className="mb-8 flex-row items-center gap-4 p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] border-orange-500 bg-card text-2xl">
          {emoji}
        </div>
        <CardContent className="px-0">
          <p className="text-xs font-bold tracking-wide text-muted-foreground/70 uppercase">
            Preview
          </p>
          <p className="text-lg font-extrabold text-foreground">
            {name.trim() || "Your room name"}
          </p>
        </CardContent>
      </Card>

      <Button
        disabled={!name.trim()}
        onClick={() => router.push("/room")}
        variant="tether-success"
        size="tether-block"
      >
        <Rocket size={20} strokeWidth={2.5} />
        Launch room
      </Button>
    </div>
  );
}
