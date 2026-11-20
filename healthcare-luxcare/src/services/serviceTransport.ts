/** Platform boundary: web defaults remain lazy; native supplies its own transport. */
export interface ServiceTransport {
  fetch: typeof fetch;
  getAccessToken: () => string | null;
}

export const browserTransport: ServiceTransport = {
  fetch: (input, init) => globalThis.fetch(input, init),
  getAccessToken: () => localStorage.getItem("accessToken"),
};
