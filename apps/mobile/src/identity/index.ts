import type { createTetherClient } from "@tether/api/client";
import { generateIdentityKeyPair } from "@tether/crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { decodeBase64, encodeBase64 } from "../base64";
import { random } from "../random";

const SECRET_KEY_STORE_KEY = "tether.identity.secretKey";
const PUBLIC_KEY_STORE_KEY = "tether.identity.publicKey";
const DEVICE_ID_STORE_KEY = "tether.identity.deviceId";

export interface Identity {
  readonly deviceId: string;
  readonly secretKey: Uint8Array;
  readonly publicKey: Uint8Array;
}

async function loadOrCreateKeyPair() {
  const [storedSecret, storedPublic] = await Promise.all([
    SecureStore.getItemAsync(SECRET_KEY_STORE_KEY),
    SecureStore.getItemAsync(PUBLIC_KEY_STORE_KEY),
  ]);
  if (storedSecret && storedPublic) {
    return { secretKey: decodeBase64(storedSecret), publicKey: decodeBase64(storedPublic) };
  }

  const keyPair = generateIdentityKeyPair(random);
  await Promise.all([
    SecureStore.setItemAsync(SECRET_KEY_STORE_KEY, encodeBase64(keyPair.secretKey)),
    SecureStore.setItemAsync(PUBLIC_KEY_STORE_KEY, encodeBase64(keyPair.publicKey)),
  ]);
  return keyPair;
}

async function loadOrRegisterDevice(
  client: ReturnType<typeof createTetherClient>,
  publicKey: Uint8Array,
) {
  const stored = await SecureStore.getItemAsync(DEVICE_ID_STORE_KEY);
  if (stored) return stored;

  const platform = Platform.OS === "ios" ? "ios" : "android";
  const device = await client.createDevice({
    identityPublicKey: encodeBase64(publicKey),
    platform,
  });
  await SecureStore.setItemAsync(DEVICE_ID_STORE_KEY, device.id);
  return device.id;
}

// Idempotent: safe to call on every app start. Only hits the network once, on first run.
export async function ensureIdentity(
  client: ReturnType<typeof createTetherClient>,
): Promise<Identity> {
  const keyPair = await loadOrCreateKeyPair();
  const deviceId = await loadOrRegisterDevice(client, keyPair.publicKey);
  return { deviceId, ...keyPair };
}
