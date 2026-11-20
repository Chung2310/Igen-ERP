/** Explicit native transport opt-in. This header grants no additional permissions. */
export function mobileTokenResponse(client: unknown, refreshToken: string) {
  return client === "native" ? { refreshToken } : {};
}
