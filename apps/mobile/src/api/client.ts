import { createTetherClient } from "@tether/api/client";

import { authClient } from "../auth/client";
import { env } from "../env";

export const tetherClient = createTetherClient({
  baseUrl: env.EXPO_PUBLIC_API_URL,
  headers: async () => ({ Cookie: await authClient.getCookie() }),
});
