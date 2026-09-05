import type { RoomSummary } from "@tether/api";
import { wrapRoomKeyForInvite } from "@tether/crypto";
import { useCallback, useEffect, useState } from "react";

import { tetherClient } from "../api/client";
import { encodeBase64, encodeBase64Url } from "../base64";
import { random, randomUUID } from "../random";
import { aead, createInviteToken } from "../rooms/crypto";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export interface InviteState {
  readonly link: string | null;
  readonly expiresAt: string | null;
  readonly loading: boolean;
  readonly error: Error | null;
}

function toError(value: unknown) {
  return value instanceof Error ? value : new Error(String(value));
}

// Creates a fresh, member-granting invite for the room and returns its shareable
// deep link. The fragment (the invite secret) is embedded client-side only — it
// never appears in any request this hook makes.
export function useInvite(room: RoomSummary | null, roomKey: Uint8Array | null): InviteState {
  const [state, setState] = useState<InviteState>({
    link: null,
    expiresAt: null,
    loading: true,
    error: null,
  });

  // Deliberately doesn't flip `loading` back to true here: the initial state already
  // starts loading, and a re-create should update in place rather than flash a spinner.
  const create = useCallback(async () => {
    if (!room || !roomKey) return;
    try {
      const inviteId = randomUUID();
      const inviteSecret = random(32);
      const { token, tokenHash } = await createInviteToken();
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

      const wrappedRoomKey = await wrapRoomKeyForInvite(
        aead,
        inviteSecret,
        roomKey,
        { roomId: room.roomId, epoch: room.currentEpoch, inviteId },
        random,
      );

      await tetherClient.createInvite(room.roomId, {
        id: inviteId,
        tokenHash,
        grantsRole: "member",
        wrappedRoomKey: encodeBase64(wrappedRoomKey),
        wrappedRoomKeyEpoch: room.currentEpoch,
        expiresAt,
      });

      const link = `tether://join/${token}#${encodeBase64Url(inviteSecret)}`;
      setState({ link, expiresAt, loading: false, error: null });
    } catch (error) {
      setState({ link: null, expiresAt: null, loading: false, error: toError(error) });
    }
  }, [room, roomKey]);

  useEffect(() => {
    void (async () => {
      await create();
    })();
  }, [create]);

  return state;
}
