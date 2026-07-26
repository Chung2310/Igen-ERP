// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AttendanceUtilityMenu from "./AttendanceUtilityMenu";

afterEach(cleanup);

describe("AttendanceUtilityMenu", () => {
  it("opens both export actions and invokes coefficient export", () => {
    const onCoefficients = vi.fn();
    render(
      <AttendanceUtilityMenu
        onExportCoefficients={onCoefficients}
        onExportHours={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Tiện ích" }));
    expect(
      screen.getByRole("menuitem", { name: "Xuất bảng số công" })
    ).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: "Xuất bảng số giờ" })
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("menuitem", { name: "Xuất bảng số công" })
    );
    expect(onCoefficients).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("invokes hours export and closes the menu", () => {
    const onHours = vi.fn();
    render(
      <AttendanceUtilityMenu
        onExportCoefficients={vi.fn()}
        onExportHours={onHours}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Tiện ích" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Xuất bảng số giờ" })
    );
    expect(onHours).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes when clicking outside", () => {
    render(
      <div>
        <button>Ngoài menu</button>
        <AttendanceUtilityMenu
          onExportCoefficients={vi.fn()}
          onExportHours={vi.fn()}
        />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Tiện ích" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Ngoài menu" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
