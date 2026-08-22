# PLAN.md

## Auth on this branch

Branch `2-better-auth-integration` implements issue #2: Better Auth email/password auth in the Fastify server, plus a minimal sign-in, sign-up, sign-out view in the Expo client.

The decisions below came from the design session on this branch and from the prototype screen in `client/src/app/prototype/`, which tested three sign-in screen variants against an in-memory stub that mirrors the better-auth/expo client surface (`signUp.email`, `signIn.email`, `signOut`, `getSession`).

## Decisions

**Scope.** Server and a minimal client view. Email/password only. No social providers, no verification emails, no background tracking on this branch.

**Signup collects a display name.** Better Auth requires a name anyway. Rooms will show it later, so a real field beats one derived from the email local part.

**Better Auth defaults, zero session config.** Seven-day sliding sessions with a one-day refresh window, rememberMe on, scrypt hashing, built-in rate limiting (100 requests per minute, 3 sign-in attempts per 10 seconds). A family app dies on weekly re-logins, and the sliding window already signs out anyone who stops opening the app.

**No biometric lock.** Whoever holds a signed-in phone sees the maps. That trade-off is accepted, so the security posture is session lifetime plus remote revoke.

**Background tracking gets its own device token.** Follow-up issue #22. Seven-day fixed lifetime, refreshed only on app launch, revoked with the session it was minted against. That keeps the "seven days without launching ends everything" promise without letting background posts silently refresh the session into an immortal one.

**Email verification and password reset are follow-up work.** Issue #23. No SMTP sender exists yet.

**Remote session management is follow-up work.** Issue #24. This branch's sign-out revokes only the current session.

**Verification is manual.** Curl the API and walk the flow in Expo Go, documented in the pull request. The test harness is issue #25.

## Stack facts

- better-auth 1.7.1, @better-auth/drizzle-adapter 1.7.1, @better-auth/expo 1.7.1
- The drizzle adapter's relations-v2 entry point accepts drizzle-orm 1.0.0-rc.4, which the server already pins. Pin drizzle-kit to the tested rc, since its npm latest tag is still 0.31.x.
- The auth CLI needs Node 22.12 or newer.
- No @fastify/cookie. Better Auth parses the Cookie header itself through `fromNodeHeaders`.
- Email/password works in Expo Go, so no dev build is needed for this branch.
- The server already reads CORS_ORIGIN from env and registers CORS before its routes.

## Implementation order

1. **Schema.** Run the auth CLI's generate step to write the auth tables (users, sessions, accounts, verifications) into the drizzle schema, then run drizzle-kit generate and migrate to create them in Postgres. The database is greenfield, so the 1.7 `account.issuer` column arrives with the fresh schema and needs no backfill.
2. **Auth instance.** Build the better-auth config with the email-and-password plugin, the drizzle adapter (relations-v2 entry), and trustedOrigins covering the client origin and the app scheme.
3. **Fastify wiring.** Register CORS with credentials before the catch-all `GET/POST /api/auth/*` route that forwards to `auth.handler()` with `fromNodeHeaders`.
4. **Protected route.** `GET /api/me` returns the session user through `auth.api.getSession`, and returns 401 when the request has no session.
5. **Client wiring.** Install @better-auth/expo and expo-secure-store. Create the authClient with baseURL and scheme, then swap the prototype stub for the real client. The stub mirrors the client surface, so the screen code stays unchanged.
6. **The sign-in view.** Wire the chosen prototype variant to the real client. Signup collects display name, email, and password. Then remove the throwaway prototype screens.