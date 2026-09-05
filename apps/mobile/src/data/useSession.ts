import { authClient } from "../auth/client";

export function useSession() {
  return authClient.useSession();
}
