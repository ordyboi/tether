import {
  bytesToHex,
  chacha20Poly1305,
  encodeFields,
  stringField,
  uint64Field,
  utf8ToBytes,
  type RoomKey,
} from "@tether/crypto";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import { random } from "../random";

export const aead = chacha20Poly1305;
export const HOME_ROOM_NAME = "Home";

// No name-entry UI exists this phase (see PLAN.md) — every device seals this as its display name.
export function defaultDisplayName() {
  return Platform.OS === "ios" ? "iPhone" : "Android device";
}

export function sealRoomName(roomKey: RoomKey, roomId: string, epoch: number, name: string) {
  const aad = encodeFields([stringField("room-name"), stringField(roomId), uint64Field(epoch)]);
  return aead.seal(roomKey, utf8ToBytes(name), aad, random);
}

export function sealDisplayName(roomKey: RoomKey, roomId: string, deviceId: string, name: string) {
  const aad = encodeFields([
    stringField("display-name"),
    stringField(roomId),
    stringField(deviceId),
  ]);
  return aead.seal(roomKey, utf8ToBytes(name), aad, random);
}

// tokenHash must match the server's createHash("sha256").update(token).digest("hex") exactly,
// which hashes the token as a UTF-8 string — hence hex-encoding the random bytes first.
export async function createInviteToken() {
  const token = bytesToHex(random(32));
  const tokenHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token);
  return { token, tokenHash };
}
