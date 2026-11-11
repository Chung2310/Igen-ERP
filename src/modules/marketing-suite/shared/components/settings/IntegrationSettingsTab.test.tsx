// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import IntegrationSettingsTab from "./IntegrationSettingsTab";

vi.mock("./TelegramOrderConfigCard", () => ({
  default: ({ userProfile }: { userProfile: unknown }) => (
    <div data-testid="telegram-card">Telegram Card for {JSON.stringify(userProfile)}</div>
  ),
}));

vi.mock("./SepayConfigCard", () => ({
  default: ({ userProfile }: { userProfile: unknown }) => (
    <div data-testid="sepay-card">Sepay Card for {JSON.stringify(userProfile)}</div>
  ),
}));

it("renders both Telegram and SePay config cards with userProfile", () => {
  const profile = { email: "admin@erp.test", role: "admin", companyCode: "ERP" } as any;
  render(<IntegrationSettingsTab userProfile={profile} />);

  expect(screen.getByTestId("telegram-card")).toBeDefined();
  expect(screen.getByTestId("sepay-card")).toBeDefined();
  expect(screen.getByText(/Telegram Card for/)).toBeDefined();
  expect(screen.getByText(/Sepay Card for/)).toBeDefined();
});

