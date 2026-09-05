import * as SecureStore from "expo-secure-store";

import { decodeBase64, encodeBase64 } from "../base64";

function keyStoreKey(roomId: string) {
  return `tether.room.${roomId}.key`;
}

function epochStoreKey(roomId: string) {
  return `tether.room.${roomId}.epoch`;
}

export async function storeRoomKey(roomId: string, epoch: number, key: Uint8Array) {
  await Promise.all([
    SecureStore.setItemAsync(keyStoreKey(roomId), encodeBase64(key)),
    SecureStore.setItemAsync(epochStoreKey(roomId), String(epoch)),
  ]);
}

export async function loadRoomKey(roomId: string) {
  const [storedKey, storedEpoch] = await Promise.all([
    SecureStore.getItemAsync(keyStoreKey(roomId)),
    SecureStore.getItemAsync(epochStoreKey(roomId)),
  ]);
  if (!storedKey || !storedEpoch) return null;
  return { key: decodeBase64(storedKey), epoch: Number(storedEpoch) };
}
