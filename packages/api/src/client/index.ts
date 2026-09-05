import type {
  DeviceCreate,
  DeviceResponse,
  EnvelopeListResponse,
  EnvelopeQuery,
  InviteCreate,
  InviteLookup,
  InviteLookupResponse,
  InviteRedeem,
  InviteResponse,
  RedeemResponse,
  RekeyResult,
  Removal,
  RoomCreate,
  RoomDevicesResponse,
  RoomListResponse,
  RoomSummary,
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

// Not every response body is JSON (an empty body, a gateway's HTML page) — fall back to raw text.
function parseBody(text: string): unknown {
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

export function createTetherClient(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  headers?: () => Promise<Record<string, string>> | Record<string, string>;
}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  async function request<T>(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = { ...(await options.headers?.()) };
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await fetchImpl(`${options.baseUrl}${path}`, init);
    const status = response.status;
    const text = await response.text();
    if (!response.ok) {
      throw new TetherApiError(status, parseBody(text));
    }
    return parseBody(text) as T;
  }

  return {
    createDevice: (body: DeviceCreate) => request<DeviceResponse>("POST", "/devices", body),
    listRooms: () => request<RoomListResponse>("GET", "/rooms"),
    createRoom: (body: RoomCreate) => request<RoomSummary>("POST", "/rooms", body),
    listRoomDevices: (roomId: string, params: { inviteToken?: string } = {}) =>
      request<RoomDevicesResponse>("GET", `/rooms/${roomId}/devices${query(params)}`),
    removeMember: (roomId: string, body: Removal) =>
      request<RekeyResult>("POST", `/rooms/${roomId}/removals`, body),
    listEnvelopes: (queryParams: EnvelopeQuery) =>
      request<EnvelopeListResponse>("GET", `/envelopes${query(queryParams)}`),
    createInvite: (roomId: string, body: InviteCreate) =>
      request<InviteResponse>("POST", `/rooms/${roomId}/invites`, body),
    lookupInvite: (body: InviteLookup) =>
      request<InviteLookupResponse>("POST", "/invites/lookup", body),
    redeemInvite: (body: InviteRedeem) => request<RedeemResponse>("POST", "/invites/redeem", body),
  };
}
