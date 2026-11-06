// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MarketingIntegrationsPage from "./MarketingIntegrationsPage";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { role: "admin" } }) }));
vi.mock("../components/settings/CompanyIntegrationsTab", () => ({ default: function CompanyTab() {
  const [broken, setBroken] = React.useState(false);
  if (broken) throw new Error("Lỗi dữ liệu tích hợp Facebook");
  return <button type="button" onClick={() => setBroken(true)}>Facebook</button>;
} }));
vi.mock("../components/settings/PersonalIntegrationsTab", () => ({ default: () => <p>MXH cá nhân</p> }));

afterEach(cleanup);

it("keeps Marketing navigation visible when an integration form fails to render", () => {
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(<MarketingIntegrationsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Facebook" }));
    expect(screen.getByRole("alert").textContent).toContain("Lỗi dữ liệu tích hợp Facebook");
    expect(screen.getByText("MXH Doanh nghiệp")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeTruthy();
  } finally {
    consoleSpy.mockRestore();
  }
});
