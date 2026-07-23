"use client";

import type { MockMember } from "@/lib/mock-data";
import { X, Crosshair } from "lucide-react";
import MemberAvatar from "./MemberAvatar";
import { sharingStateLabel, stalenessLabel } from "../_lib/visuals";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Drawer, DrawerClose, DrawerContent } from "@/components/ui/drawer";

export default function MemberSheet({
  member,
  onClose,
  onFocus,
}: {
  member: MockMember;
  onClose: () => void;
  onFocus: () => void;
}) {
  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-sm border-[3px] border-border bg-card p-5 sm:mx-auto">
        <DrawerClose
          render={
            <Button
              variant="tether-outline"
              size="tether-icon-sm"
              className="absolute top-4 right-4 border-2"
            />
          }
        >
          <X size={16} strokeWidth={3} />
        </DrawerClose>

        <div className="flex items-center gap-4">
          <MemberAvatar member={member} size="lg" ring />
          <div>
            <h2 className="text-xl font-extrabold text-foreground">
              {member.name}
              {member.isSelf && (
                <Badge variant="tag" className="ml-2">
                  (you)
                </Badge>
              )}
            </h2>
            {member.isOwner && (
              <span className="text-xs font-bold text-yellow-400">
                Room owner
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Card
            variant="tether"
            className="border-2 bg-background px-3 py-2.5 shadow-none"
          >
            <CardContent className="p-0">
              <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                Sharing
              </p>
              <p className="text-sm font-bold text-foreground">
                {sharingStateLabel(member)}
              </p>
            </CardContent>
          </Card>
          <Card
            variant="tether"
            className="border-2 bg-background px-3 py-2.5 shadow-none"
          >
            <CardContent className="p-0">
              <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                Status
              </p>
              <p className="text-sm font-bold text-foreground">
                {stalenessLabel(member)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Button
          onClick={onFocus}
          disabled={member.sharingState === "ghost"}
          variant="tether"
          size="tether-block"
          className="mt-5 py-3"
        >
          <Crosshair size={18} strokeWidth={3} />
          {member.sharingState === "ghost" ? "Location hidden" : "Focus on map"}
        </Button>
      </DrawerContent>
    </Drawer>
  );
}
