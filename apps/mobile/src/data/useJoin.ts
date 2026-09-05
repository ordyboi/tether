import type { InviteLookupResponse } from "@tether/api";
import { TetherApiError } from "@tether/api/client";
import { generateRoomKey, unwrapRoomKeyForInvite, wrapRoomKey } from "@tether/crypto";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tetherClient } from "../api/client";
import { decodeBase64, decodeBase64Url, encodeBase64 } from "../base64";
import { ensureIdentity, type Identity } from "../identity";
import { random } from "../random";
import {
  aead,
  defaultDisplayName,
  HOME_ROOM_NAME,
  sealDisplayName,
  sealRoomName,
} from "../rooms/crypto";
import { storeRoomKey } from "../rooms/keystore";

export type JoinPhase = "resolving" | "confirm" | "joining" | "success" | "error";

export interface JoinState {
  readonly phase: JoinPhase;
  readonly roomId: string | null;
  readonly error: string | null;
  readonly confirm: () => void;
}

interface ParsedJoinUrl {
  readonly token: string;
  readonly inviteSecret: Uint8Array;
}

const JOIN_PATH_MARKER = "join/";

// expo-router's param parsing doesn't reliably preserve URL fragments, so the caller
// must pass the raw URL (from Linking.useURL()) and this splits it by hand.
export function parseJoinUrl(url: string): ParsedJoinUrl | null {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;

  const beforeFragment = url.slice(0, hashIndex);
  const fragment = url.slice(hashIndex + 1);
  const markerIndex = beforeFragment.indexOf(JOIN_PATH_MARKER);
  if (markerIndex === -1 || fragment.length === 0) return null;

  const token = beforeFragment.slice(markerIndex + JOIN_PATH_MARKER.length);
  if (token.length === 0) return null;

  return { token, inviteSecret: decodeBase64Url(fragment) };
}

function describeError(error: unknown): string {
  if (error instanceof TetherApiError) {
    if (error.status === 404) {
      return "This invite link has expired or already been used.";
    }
    const code = (error.body as { code?: string } | undefined)?.code;
    if (code === "already_member") {
      return "You're already a member of this room.";
    }
  }
  return "Something went wrong joining this room.";
}

function isStaleEpoch(error: unknown) {
  return (
    error instanceof TetherApiError &&
    error.status === 409 &&
    (error.body as { code?: string } | undefined)?.code === "stale_epoch"
  );
}

// Mints the next epoch's room key and wraps it for every active device plus this one —
// self-service join, per docs/key-management-spec.md §4. Re-derives the current epoch
// from the device roster fresh each call, so a stale_epoch 409 can simply be retried.
async function attemptJoin(token: string, roomId: string, identity: Identity) {
  const devicesResponse = await tetherClient.listRoomDevices(roomId, { inviteToken: token });
  const newEpoch = devicesResponse.epoch + 1;
  const roomKey = generateRoomKey(random);

  const recipients = [
    ...devicesResponse.devices,
    { deviceId: identity.deviceId, identityPublicKey: encodeBase64(identity.publicKey) },
  ];

  const envelopes = await Promise.all(
    recipients.map(async (recipient) => ({
      deviceId: recipient.deviceId,
      wrappedKey: encodeBase64(
        await wrapRoomKey(
          aead,
          roomKey,
          decodeBase64(recipient.identityPublicKey),
          { roomId, epoch: newEpoch, deviceId: recipient.deviceId },
          random,
        ),
      ),
    })),
  );

  const [nameCiphertext, displayNameCiphertext] = await Promise.all([
    sealRoomName(roomKey, roomId, newEpoch, HOME_ROOM_NAME),
    sealDisplayName(roomKey, roomId, identity.deviceId, defaultDisplayName()),
  ]);

  const result = await tetherClient.redeemInvite({
    token,
    displayNameCiphertext: encodeBase64(displayNameCiphertext),
    expectedEpoch: devicesResponse.epoch,
    nameCiphertext: encodeBase64(nameCiphertext),
    envelopes,
  });

  return { result, roomKey };
}

async function joinWithRetry(token: string, roomId: string, identity: Identity) {
  try {
    return await attemptJoin(token, roomId, identity);
  } catch (error) {
    if (isStaleEpoch(error)) {
      return attemptJoin(token, roomId, identity);
    }
    throw error;
  }
}

export function useJoin(url: string | null): JoinState {
  const [phase, setPhase] = useState<JoinPhase>("resolving");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const parsedRef = useRef<ParsedJoinUrl | null>(null);
  const lookupRef = useRef<InviteLookupResponse | null>(null);

  // A link that fails to parse is a render-time fact about `url`, not something to
  // reach with setState from an effect — it's derived, not fetched.
  const parsed = useMemo(() => (url ? parseJoinUrl(url) : null), [url]);
  const brokenLink = url !== null && parsed === null;

  useEffect(() => {
    if (!parsed) return;
    parsedRef.current = parsed;

    (async () => {
      try {
        const lookup = await tetherClient.lookupInvite({ token: parsed.token });
        // Proves the invite is genuine without trusting any server-held secret — the
        // room key only comes out if the fragment's inviteSecret actually unwraps it.
        await unwrapRoomKeyForInvite(
          aead,
          parsed.inviteSecret,
          decodeBase64(lookup.wrappedRoomKey),
          {
            roomId: lookup.roomId,
            epoch: lookup.wrappedRoomKeyEpoch,
            inviteId: lookup.id,
          },
        );
        lookupRef.current = lookup;
        setRoomId(lookup.roomId);
        setPhase("confirm");
      } catch (caught) {
        setPhase("error");
        setError(describeError(caught));
      }
    })();
  }, [parsed]);

  const confirm = useCallback(() => {
    const parsed = parsedRef.current;
    const lookup = lookupRef.current;
    if (!parsed || !lookup) return;

    setPhase("joining");
    (async () => {
      try {
        const identity = await ensureIdentity(tetherClient);
        const { result, roomKey } = await joinWithRetry(parsed.token, lookup.roomId, identity);
        await storeRoomKey(result.roomId, result.newEpoch, roomKey);
        setRoomId(result.roomId);
        setPhase("success");
      } catch (caught) {
        setPhase("error");
        setError(describeError(caught));
      }
    })();
  }, []);

  if (brokenLink) {
    return { phase: "error", roomId: null, error: "This invite link looks broken.", confirm };
  }

  return { phase, roomId, error, confirm };
}
