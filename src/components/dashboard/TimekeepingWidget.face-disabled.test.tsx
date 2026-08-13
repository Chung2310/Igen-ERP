// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("../../pages/Toast", () => ({ toast: toastMocks }));
vi.mock("../attendance/AttendanceCameraModal", () => ({
  default: () => <div data-testid="attendance-camera">camera</div>,
}));

import { TimekeepingWidget } from "./TimekeepingWidget";

describe("TimekeepingWidget with attendance face checking disabled", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue({ state: "granted", onchange: null }) },
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({ coords: { latitude: 10.7, longitude: 106.6 } } as GeolocationPosition),
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Đã check-in" }),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("submits coordinates immediately without opening the camera or attaching a file", async () => {
    const user = userEvent.setup();
    render(
      <TimekeepingWidget
        todayTimekeeping={null}
        todayWorkCalendar={{ date: "2026-08-13", isWorkingDay: true }}
        isLoading={false}
        onRefresh={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Check-In" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(screen.queryByTestId("attendance-camera")).toBeNull();
    const request = vi.mocked(fetch).mock.calls[0][1];
    const body = request?.body as FormData;
    expect(body.get("latitude")).toBe("10.7");
    expect(body.get("longitude")).toBe("106.6");
    expect(body.has("file")).toBe(false);
  });
});
