// @vitest-environment jsdom
import React from "react";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { superAdminAuthService } from "../../services/superAdminAuthService";
import { ErpAuthenticatorDialog } from "./ErpAuthenticatorDialog";

vi.mock("../../services/superAdminAuthService", () => ({
  superAdminAuthService: {
    startEnrollment: vi.fn(),
    confirmEnrollment: vi.fn(),
    verifyTotp: vi.fn(),
    verifyRecovery: vi.fn(),
  },
}));

const challenge = {
  status: "challenge_required" as const,
  challengeId: "c1",
  enrollmentRequired: false,
  expiresAt: "2099-01-01T00:00:00.000Z",
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ErpAuthenticatorDialog", () => {
  it("verifies TOTP once without submitting the outer form and hydrates once", async () => {
    vi.mocked(superAdminAuthService.verifyTotp).mockResolvedValue({ accessToken: "token" });
    const onAuthenticated = vi.fn().mockResolvedValue(undefined);
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <ErpAuthenticatorDialog challenge={challenge} onAuthenticated={onAuthenticated} onCancel={vi.fn()} />
      </form>,
    );

    fireEvent.change(screen.getByLabelText("Mã Google Authenticator"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác thực" }));

    await waitFor(() => assert.equal(vi.mocked(superAdminAuthService.verifyTotp).mock.calls.length, 1));
    assert.deepEqual(vi.mocked(superAdminAuthService.verifyTotp).mock.calls[0], ["c1", "123456"]);
    await waitFor(() => assert.equal(onAuthenticated.mock.calls.length, 1));
    assert.equal(onSubmit.mock.calls.length, 0);
  });

  it("keeps the dialog visible and shows an invalid TOTP error inline", async () => {
    vi.mocked(superAdminAuthService.verifyTotp).mockRejectedValue(new Error("Mã xác thực không hợp lệ"));

    render(<ErpAuthenticatorDialog challenge={challenge} onAuthenticated={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Mã Google Authenticator"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác thực" }));

    await screen.findByText("Mã xác thực không hợp lệ");
    assert.ok(screen.getByRole("dialog"));
  });

  it("loads enrollment QR, confirms, and waits for recovery-code acknowledgement", async () => {
    vi.mocked(superAdminAuthService.startEnrollment).mockResolvedValue({ qrDataUrl: "data:image/png;base64,qr", manualEntryKey: "JBSWY3DPEHPK3PXP" });
    vi.mocked(superAdminAuthService.confirmEnrollment).mockResolvedValue({
      accessToken: "token",
      recoveryCodes: ["AAAAA-BBBBB"],
    });
    const onAuthenticated = vi.fn().mockResolvedValue(undefined);

    render(
      <React.StrictMode>
        <ErpAuthenticatorDialog
          challenge={{ ...challenge, enrollmentRequired: true }}
          onAuthenticated={onAuthenticated}
          onCancel={vi.fn()}
        />
      </React.StrictMode>,
    );

    const qr = await screen.findByAltText("Mã QR Google Authenticator");
    assert.equal(qr.getAttribute("src"), "data:image/png;base64,qr");
    assert.equal(vi.mocked(superAdminAuthService.startEnrollment).mock.calls.length, 1);

    fireEvent.change(screen.getByLabelText("Mã Google Authenticator"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Kích hoạt và đăng nhập" }));

    await screen.findByText("AAAAA-BBBBB");
    assert.deepEqual(vi.mocked(superAdminAuthService.confirmEnrollment).mock.calls[0], ["c1", "123456"]);
    assert.equal(onAuthenticated.mock.calls.length, 0);
    fireEvent.click(screen.getByRole("button", { name: "Tôi đã lưu mã khôi phục" }));
    await waitFor(() => assert.equal(onAuthenticated.mock.calls.length, 1));
  });

  it("verifies a recovery code", async () => {
    vi.mocked(superAdminAuthService.verifyRecovery).mockResolvedValue({ accessToken: "token" });
    const onAuthenticated = vi.fn().mockResolvedValue(undefined);

    render(<ErpAuthenticatorDialog challenge={challenge} onAuthenticated={onAuthenticated} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Dùng mã khôi phục" }));
    fireEvent.change(screen.getByLabelText("Mã khôi phục"), { target: { value: "AAAAA-BBBBB" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác thực" }));

    await waitFor(() => assert.equal(vi.mocked(superAdminAuthService.verifyRecovery).mock.calls.length, 1));
    assert.deepEqual(vi.mocked(superAdminAuthService.verifyRecovery).mock.calls[0], ["c1", "AAAAA-BBBBB"]);
  });
});
