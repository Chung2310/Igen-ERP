import { afterEach, describe, expect, it, vi } from "vitest";
import { companyEmailApi } from "./companyEmailService";

afterEach(() => vi.unstubAllGlobals());

describe("companyEmailApi.saveSmtp", () => {
  it("sends only writable SMTP fields", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ data: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => "token") });

    await companyEmailApi.saveSmtp({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      user: "sender@example.com",
      password: "app-password",
      fromEmail: "sender@example.com",
      fromName: "Example",
      hasPassword: true,
      data: { stale: true },
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      user: "sender@example.com",
      password: "app-password",
      fromEmail: "sender@example.com",
      fromName: "Example",
    });
  });
});
