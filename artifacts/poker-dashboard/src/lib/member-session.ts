// Asking the server who is signed in. A slow or unreachable server is not the same as being
// signed out, so those cases are retried and reported separately.

export type MemberAuthSession = { authenticated: boolean; memberName?: string };

export function landingPathForSessions(memberAuthenticated: boolean, adminAuthenticated: boolean): "/dashboard" | "/admin" | null {
  if (memberAuthenticated) return "/dashboard";
  if (adminAuthenticated) return "/admin";
  return null;
}

export type SessionCheckDeps = {
  fetchSession: () => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  wait: (ms: number) => Promise<void>;
  isCancelled: () => boolean;
};

const RETRY_DELAYS_MS = [0, 700, 1600, 3200];

/**
 * Resolves to the session, `null` when the member really is signed out (or the check was
 * cancelled), or "unreachable" when every attempt failed with a network or server error.
 */
export async function checkMemberSession(deps: SessionCheckDeps): Promise<MemberAuthSession | null | "unreachable"> {
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await deps.wait(delay);
    if (deps.isCancelled()) return null;
    try {
      const response = await deps.fetchSession();
      if (response.ok) {
        const session = (await response.json()) as MemberAuthSession;
        return session.authenticated ? session : null;
      }
      // A client error is a clear answer; only server errors are worth another try.
      if (response.status >= 400 && response.status < 500) return null;
    } catch {
      // Network error: try again.
    }
  }
  return "unreachable";
}

export const browserSessionDeps = (isCancelled: () => boolean): SessionCheckDeps => ({
  fetchSession: () => fetch("/api/auth/member/session", { credentials: "include" }),
  wait: (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
  isCancelled,
});
