import { afterEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { GoogleDriveService } from "./personal-google-drive.service";

const USER_ID = "507f1f77bcf86cd799439011";
const originalEnv = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
};

afterEach(() => {
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Google Drive OAuth state", () => {
  it("uses a signed, user-bound state instead of exposing the user id", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
    vi.stubEnv("GOOGLE_REDIRECT_URI", "https://erp.example.test/oauth/callback");
    vi.stubEnv("JWT_ACCESS_SECRET", "test-secret-that-is-long-enough");

    const authUrl = new URL(GoogleDriveService.getAuthUrl(USER_ID));
    const state = authUrl.searchParams.get("state");
    const decoded = jwt.decode(state!) as { exp?: number; iat?: number } | null;

    expect(state).not.toBe(USER_ID);
    expect(decoded?.exp).toBeGreaterThan(decoded?.iat ?? Number.POSITIVE_INFINITY);
    expect((decoded!.exp! - decoded!.iat!)).toBeLessThanOrEqual(10 * 60);
    expect(GoogleDriveService.getUserIdFromOAuthState(state!)).toBe(USER_ID);
    expect(GoogleDriveService.getUserIdFromOAuthState(USER_ID)).toBeNull();
  });
});
