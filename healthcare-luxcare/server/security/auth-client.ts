export type AuthClient = "web" | "mobile";

export function normalizeAuthClient(value: unknown): AuthClient {
  return value === "native" || value === "mobile" ? "mobile" : "web";
}

export function getActiveSessionId(
  user: {
    activeSessionId?: string;
    activeWebSessionId?: string;
    activeMobileSessionId?: string;
  },
  authClient: AuthClient,
): string | undefined {
  if (authClient === "mobile")
    return user.activeMobileSessionId || (!user.activeWebSessionId ? user.activeSessionId : undefined);
  return user.activeWebSessionId || user.activeSessionId || undefined;
}
