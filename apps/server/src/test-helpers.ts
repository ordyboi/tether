import { randomBytes } from "node:crypto";

import type { FastifyInstance } from "fastify";

export interface DeviceResponse {
  id: string;
}

export interface RoomCreateResponse {
  room: { id: string; nameCiphertext: string };
  memberAlias: string;
}

export async function registerDevice(app: FastifyInstance, cookie: string) {
  const response = await app.inject({
    method: "POST",
    url: "/devices",
    headers: { cookie },
    payload: { identityPublicKey: randomBytes(32).toString("base64"), platform: "ios" },
  });
  return response.json<DeviceResponse>();
}

export async function createRoom(
  app: FastifyInstance,
  cookie: string,
  ownerDeviceId: string,
  options: { roomId?: string; wrappedKey?: Buffer } = {},
) {
  const wrappedKey = options.wrappedKey ?? randomBytes(48);
  return app.inject({
    method: "POST",
    url: "/rooms",
    headers: { cookie },
    payload: {
      roomId: options.roomId,
      nameCiphertext: randomBytes(32).toString("base64"),
      precisionPolicy: "approximate_only",
      displayNameCiphertext: randomBytes(16).toString("base64"),
      envelopes: [{ deviceId: ownerDeviceId, wrappedKey: wrappedKey.toString("base64") }],
    },
  });
}
