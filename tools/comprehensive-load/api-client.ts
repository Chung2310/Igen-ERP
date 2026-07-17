import { STAGING_ORIGIN } from "./profile.js";

const ALLOWED_PREFIXES = Object.freeze([
  "/health",
  "/auth/login",
  "/auth/refresh-token",
  "/auth/me",
  "/auth/profile",
  "/auth/register-user",
  "/auth/users/",
  "/students",
  "/courses",
  "/batches",
  "/schedule",
  "/partners",
  "/student-resources",
  "/chat",
]);

export interface RuntimeCredentials {
  adminEmail: string;
  adminPassword: string;
  userPassword: string;
  bypassSecret: string;
}

export function requireRuntimeCredentials(env: Record<string, string | undefined>): RuntimeCredentials {
  if (!env.LOAD_TEST_ADMIN_EMAIL) throw new Error("LOAD_TEST_ADMIN_EMAIL is required");
  if (!env.LOAD_TEST_ADMIN_PASSWORD) throw new Error("LOAD_TEST_ADMIN_PASSWORD is required");
  if (!env.LOAD_TEST_USER_PASSWORD) throw new Error("LOAD_TEST_USER_PASSWORD is required");
  if (!env.LOAD_TEST_BYPASS_SECRET || env.LOAD_TEST_BYPASS_SECRET.length < 32) {
    throw new Error("LOAD_TEST_BYPASS_SECRET must be at least 32 characters");
  }
  return {
    adminEmail: env.LOAD_TEST_ADMIN_EMAIL,
    adminPassword: env.LOAD_TEST_ADMIN_PASSWORD,
    userPassword: env.LOAD_TEST_USER_PASSWORD,
    bypassSecret: env.LOAD_TEST_BYPASS_SECRET,
  };
}

function isAllowed(path: string): boolean {
  return path.startsWith("/") && !path.includes("..") && ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

export class LoadTestApiClient {
  private accessToken: string | null = null;

  constructor(private readonly fetchImpl: typeof fetch = fetch, private readonly bypassSecret?: string) {}

  async request(method: string, path: string, body?: unknown): Promise<unknown> {
    if (!isAllowed(path)) throw new Error(`path not allowlisted: ${path}`);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.bypassSecret) headers["x-igen-load-test-key"] = this.bypassSecret;
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`;
    const response = await this.fetchImpl(`${STAGING_ORIGIN}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(`staging API ${method} ${path} returned ${response.status}`);
    return payload;
  }

  async login(email: string, password: string): Promise<{ userId: string }> {
    const payload = await this.request("POST", "/auth/login", { email, password }) as {
      accessToken?: string;
      user?: { id?: string; _id?: string };
    };
    if (!payload.accessToken) throw new Error("login response missing access token");
    this.accessToken = payload.accessToken;
    return { userId: payload.user?.id ?? payload.user?._id ?? "" };
  }

  async createUser(input: { displayName: string; email: string; password: string }): Promise<{ id: string }> {
    const payload = await this.request("POST", "/auth/register-user", { ...input, role: "user" }) as {
      data?: { id?: string; _id?: string };
    };
    const id = payload.data?.id ?? payload.data?._id;
    if (!id) throw new Error("create user response missing id");
    return { id };
  }

  async deleteUser(id: string): Promise<void> {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("invalid user id");
    await this.request("DELETE", `/auth/users/${id}`);
  }

  async measure(method: string, path: string, body?: unknown): Promise<{ status?: number; latencyMs: number }> {
    const startedAt = performance.now();
    try {
      await this.request(method, path, body);
      return { status: 200, latencyMs: performance.now() - startedAt };
    } catch (error) {
      const match = error instanceof Error ? error.message.match(/returned (\d{3})/) : null;
      return { status: match ? Number(match[1]) : undefined, latencyMs: performance.now() - startedAt };
    }
  }
}
