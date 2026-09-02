import { auth } from "./auth.js";

export async function createSignedInUser() {
  const { headers, response } = await auth.api.signInAnonymous({ returnHeaders: true });
  const cookie = headers.get("set-cookie");
  if (!cookie) {
    throw new Error("sign-in-anonymous did not set a session cookie");
  }
  if (!response) {
    throw new Error("sign-in-anonymous returned no response");
  }
  return { userId: response.user.id, cookie };
}
