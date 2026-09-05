import type { RoomSummary } from "@tether/api";
import { generateRoomKey, unwrapRoomKey, wrapRoomKey } from "@tether/crypto";
import { useCallback, useEffect, useState } from "react";

import { tetherClient } from "../api/client";
import { decodeBase64, encodeBase64 } from "../base64";
import { ensureIdentity, type Identity } from "../identity";
import { random, randomUUID } from "../random";
import {
  aead,
  defaultDisplayName,
  HOME_ROOM_NAME,
  sealDisplayName,
  sealRoomName,
} from "../rooms/crypto";
import { loadRoomKey, storeRoomKey } from "../rooms/keystore";

const CREATION_EPOCH = 0;

async function createHomeRoom(identity: Identity): Promise<RoomSummary> {
  const roomId = randomUUID();
  const roomKey = generateRoomKey(random);

  const [nameCiphertext, displayNameCiphertext, wrappedKey] = await Promise.all([
    sealRoomName(roomKey, roomId, CREATION_EPOCH, HOME_ROOM_NAME),
    sealDisplayName(roomKey, roomId, identity.deviceId, defaultDisplayName()),
    wrapRoomKey(
      aead,
      roomKey,
      identity.publicKey,
      { roomId, epoch: CREATION_EPOCH, deviceId: identity.deviceId },
      random,
    ),
  ]);

  const room = await tetherClient.createRoom({
    roomId,
    nameCiphertext: encodeBase64(nameCiphertext),
    precisionPolicy: "on_request",
    approximateRadiusM: 500,
    displayNameCiphertext: encodeBase64(displayNameCiphertext),
    envelopes: [{ deviceId: identity.deviceId, wrappedKey: encodeBase64(wrappedKey) }],
  });

  await storeRoomKey(room.roomId, room.currentEpoch, roomKey);
  return room;
}

// Existing rooms can rekey between visits (another device joined or left); pull this
// device's envelope for the current epoch and unwrap it rather than trusting the cache.
async function syncRoomKey(room: RoomSummary, identity: Identity) {
  const cached = await loadRoomKey(room.roomId);
  if (cached && cached.epoch === room.currentEpoch) {
    return cached.key;
  }

  const { envelopes } = await tetherClient.listEnvelopes({
    deviceId: identity.deviceId,
    roomId: room.roomId,
    sinceEpoch: room.currentEpoch,
  });
  const envelope = envelopes.find((candidate) => candidate.epoch === room.currentEpoch);
  if (!envelope) {
    return cached?.key ?? null;
  }

  const roomKey = await unwrapRoomKey(aead, decodeBase64(envelope.wrappedKey), identity.secretKey, {
    roomId: room.roomId,
    epoch: room.currentEpoch,
    deviceId: identity.deviceId,
  });
  await storeRoomKey(room.roomId, room.currentEpoch, roomKey);
  return roomKey;
}

function toError(value: unknown) {
  return value instanceof Error ? value : new Error(String(value));
}

export interface RoomState {
  readonly room: RoomSummary | null;
  readonly roomKey: Uint8Array | null;
  readonly deviceId: string | null;
  readonly loading: boolean;
  readonly error: Error | null;
  readonly refresh: () => Promise<void>;
}

const initialState = {
  room: null,
  roomKey: null,
  deviceId: null,
  loading: true,
  error: null,
} as const;

// Lists the caller's rooms, auto-creating a "Home" room on first run (room creation
// is otherwise out of scope for this phase — see PLAN.md).
export function useRoom(): RoomState {
  const [state, setState] = useState<Omit<RoomState, "refresh">>(initialState);

  // Deliberately doesn't flip `loading` back to true here: the initial state already
  // starts loading, and a refresh should update in place rather than flash a spinner.
  const bootstrap = useCallback(async () => {
    try {
      const identity = await ensureIdentity(tetherClient);
      const { rooms } = await tetherClient.listRooms();
      const [existing] = rooms;
      const room = existing ?? (await createHomeRoom(identity));
      const roomKey = await syncRoomKey(room, identity);
      setState({ room, roomKey, deviceId: identity.deviceId, loading: false, error: null });
    } catch (error) {
      setState({
        room: null,
        roomKey: null,
        deviceId: null,
        loading: false,
        error: toError(error),
      });
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await bootstrap();
    })();
  }, [bootstrap]);

  return { ...state, refresh: bootstrap };
}
