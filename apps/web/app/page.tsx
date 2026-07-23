import Link from "next/link";
import { ArrowRight, Sparkles, DoorOpen, Users } from "lucide-react";
import { mockRoom, mockMembers } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";

export default function TrailheadHome() {
  return (
    <div className="px-5 pt-10 pb-32">
      <p className="mb-1 text-xs font-extrabold tracking-widest text-orange-400 uppercase">
        Trailhead
      </p>
      <h1 className="mb-2 text-3xl font-extrabold text-foreground">
        Where's everyone?
      </h1>
      <p className="mb-8 max-w-sm text-muted-foreground">
        Tether keeps your crew on one map — share a link, appear together,
        gone whenever you leave.
      </p>

      <Card
        variant="tether"
        render={<Link href="/room" />}
        className="group mb-6 px-5 transition active:translate-y-1 active:shadow-none"
      >
        <CardContent className="px-0">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px] border-orange-500 bg-background text-3xl">
              {mockRoom.emoji}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-extrabold text-foreground">
                {mockRoom.name}
              </h2>
              <p className="flex items-center gap-1 text-sm font-bold text-muted-foreground">
                <Users size={14} /> {mockMembers.length} members active
              </p>
            </div>
            <ArrowRight
              className="text-orange-400 transition group-hover:translate-x-1"
              size={22}
            />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 rounded-full border-[3px] border-orange-600 bg-orange-500 py-3 text-sm font-extrabold text-white shadow-[0_4px_0_0_var(--shadow-hard-color)]">
            Enter room
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card
          variant="tether"
          render={<Link href="/create" />}
          className="items-center px-4 py-5 text-center transition active:translate-y-1 active:shadow-none"
        >
          <CardContent className="flex flex-col items-center gap-2 px-0">
            <Sparkles className="text-green-400" size={26} strokeWidth={2.5} />
            <span className="text-sm font-extrabold text-foreground">
              Create a room
            </span>
            <span className="text-xs text-muted-foreground">
              Start something new
            </span>
          </CardContent>
        </Card>
        <Card
          variant="tether"
          render={<Link href="/join" />}
          className="items-center px-4 py-5 text-center transition active:translate-y-1 active:shadow-none"
        >
          <CardContent className="flex flex-col items-center gap-2 px-0">
            <DoorOpen className="text-blue-400" size={26} strokeWidth={2.5} />
            <span className="text-sm font-extrabold text-foreground">
              Join with invite
            </span>
            <span className="text-xs text-muted-foreground">
              Got a link? Hop in
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
