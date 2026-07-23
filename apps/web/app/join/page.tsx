"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Users } from "lucide-react";
import { mockRoom, mockMembers } from "@/lib/mock-data";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function JoinRoomPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");

  return (
    <div className="px-5 pt-10 pb-32">
      <p className="mb-1 text-xs font-extrabold tracking-widest text-blue-400 uppercase">
        You're invited
      </p>
      <h1 className="mb-6 text-3xl font-extrabold text-foreground">
        Join the crew
      </h1>

      <Card variant="tether" className="mb-8 flex-row items-center gap-4 p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px] border-blue-400 bg-background text-3xl">
          {mockRoom.emoji}
        </div>
        <CardContent className="px-0">
          <h2 className="text-xl font-extrabold text-foreground">
            {mockRoom.name}
          </h2>
          <p className="flex items-center gap-1 text-sm font-bold text-muted-foreground">
            <Users size={14} /> {mockMembers.length} members already in
          </p>
        </CardContent>
      </Card>

      <Label htmlFor="display-name">What should we call you?</Label>
      <Input
        id="display-name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Your display name"
        className="mb-8 focus-visible:border-blue-400 focus-visible:ring-blue-400/50"
      />

      <Button
        disabled={!displayName.trim()}
        onClick={() => router.push("/room")}
        variant="tether-info"
        size="tether-block"
      >
        <LogIn size={20} strokeWidth={2.5} />
        Join room
      </Button>

      <p className="mt-4 text-center text-xs text-muted-foreground/70">
        Your location is only shared while you're in this room.
      </p>
    </div>
  );
}
