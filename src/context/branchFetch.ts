export function buildBranchRequestInit(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  selectedBranchId: string | null
): RequestInit {
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  if (selectedBranchId && !headers.has("x-branch-id")) {
    headers.set("x-branch-id", selectedBranchId);
  }
  return { ...init, headers };
}
