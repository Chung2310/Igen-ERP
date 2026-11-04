// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import EmployeeWorkHoursTab from "./EmployeeWorkHoursTab";

describe("EmployeeWorkHoursTab", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the saved display name and does not repeat an email as the name", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        { _id: "1", displayName: "Nguyễn An", email: "an@igen.com" },
        { _id: "2", email: "a@gmail.com" },
      ] }),
    }));

    render(<EmployeeWorkHoursTab />);

    expect(await screen.findByText("Nguyễn An")).toBeTruthy();
    expect(screen.getAllByText("an@igen.com")).toHaveLength(1);
    expect(screen.getAllByText("a@gmail.com")).toHaveLength(1);
  });
});
