import type {
  DeviceCreate,
  EnvelopeQuery,
  InviteCreate,
  InviteLookup,
  InviteRedeem,
  Removal,
  RoomCreate,
} from "../types.js";

export class TetherApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`Tether API request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

export function createTetherClient(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  headers?: () => Promise<Record<string, string>> | Record<string, string>;
}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  async function request(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = { ...(await options.headers?.()) };
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await fetchImpl(`${options.baseUrl}${path}`, init);
    const responseBody = await response.json();
    if (!response.ok) {
      throw new TetherApiError(response.status, responseBody);
    }
    return responseBody;
  }

  function query(params: Record<string, string | number | undefined>) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, String(value));
    }
    const serialized = search.toString();
    return serialized.length > 0 ? `?${serialized}` : "";
  }

  return {
    createDevice: (body: DeviceCreate) => request("POST", "/devices", body),
    listRooms: () => request("GET", "/rooms"),
    createRoom: (body: RoomCreate) => request("POST", "/rooms", body),
    listRoomDevices: (roomId: string) => request("GET", `/rooms/${roomId}/devices`),
    removeMember: (roomId: string, body: Removal) =>
      request("POST", `/rooms/${roomId}/removals`, body),
    listEnvelopes: (queryParams: EnvelopeQuery) =>
      request("GET", `/envelopes${query(queryParams)}`),
    createInvite: (roomId: string, body: InviteCreate) =>
      request("POST", `/rooms/${roomId}/invites`, body),
    lookupInvite: (body: InviteLookup) => request("POST", "/invites/lookup", body),
    redeemInvite: (body: InviteRedeem) => request("POST", "/invites/redeem", body),
  };
}
