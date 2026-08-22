// Stub auth — in-memory, wiped on reload. Mirrors the better-auth/expo client
// surface (signUp.email / signIn.email / signOut / getSession) so screen code can
// be pointed at the real client later without changing it. Real validation and
// error handling arrive with that integration; this only keeps the flow usable.

import { useEffect, useState } from "react";

export type SessionUser = { name: string; email: string };

export type AuthResult =
  | { data: SessionUser; error: null }
  | { data: null; error: { message: string } };

type StoredAccount = SessionUser & { password: string };

let account: StoredAccount | null = null;
let sessionActive = false;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const toSessionUser = (stored: StoredAccount): SessionUser => {
  return { name: stored.name, email: stored.email };
};

export const authStub = {
  async signUp(input: { name: string; email: string; password: string }): Promise<AuthResult> {
    account = {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
    };
    sessionActive = true;
    notify();
    return { data: toSessionUser(account), error: null };
  },

  async signIn(input: { email: string; password: string }): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    if (account === null || account.email !== email || account.password !== input.password) {
      return { data: null, error: { message: "That email and password don't match" } };
    }
    sessionActive = true;
    notify();
    return { data: toSessionUser(account), error: null };
  },

  async signOut(): Promise<{ data: null; error: null }> {
    sessionActive = false;
    notify();
    return { data: null, error: null };
  },

  getSession(): SessionUser | null {
    if (sessionActive === false || account === null) {
      return null;
    }
    return toSessionUser(account);
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useAuth() {
  const [session, setSession] = useState<SessionUser | null>(authStub.getSession());
  useEffect(() => {
    return authStub.subscribe(() => setSession(authStub.getSession()));
  }, []);
  return { session };
}
