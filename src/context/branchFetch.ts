export function buildBranchRequestInit(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  selectedBranchId: string | null
): RequestInit {
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const pathname = new URL(url, "http://localhost").pathname;
  // Company-level branch management must work even when the saved branch was removed.
  const managesBranches = /^\/api\/v1\/auth\/branches(?:\/|$)/.test(pathname);
  if (selectedBranchId && !managesBranches && !headers.has("x-branch-id")) {
    headers.set("x-branch-id", selectedBranchId);
  }
  return { ...init, headers };
}
