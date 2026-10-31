// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TableFilterToolbar } from "./TableFilterToolbar";
import { emptyDatePeriodFilter } from "../../utils/datePeriodFilter";

afterEach(cleanup);

describe("TableFilterToolbar component", () => {
  it("renders search, children, count and handles search input", () => {
    const onSearchChange = vi.fn();
    render(
      <TableFilterToolbar
        search={{
          value: "test query",
          onChange: onSearchChange,
          placeholder: "Tìm kiếm...",
          ariaLabel: "Tìm kiếm bảng",
        }}
        totalCount={42}
        countLabel="mục"
      >
        <span data-testid="custom-child">Child filter</span>
      </TableFilterToolbar>,
    );

    expect(screen.getByTestId("custom-child")).not.toBeNull();
    const searchInput = screen.getByRole("textbox", { name: "Tìm kiếm bảng" }) as HTMLInputElement;
    expect(searchInput.value).toBe("test query");

    // Clear search button
    const clearBtn = screen.getByRole("button", { name: "Xóa từ khóa tìm kiếm" });
    fireEvent.click(clearBtn);
    expect(onSearchChange).toHaveBeenCalledWith("");

    // Count
    expect(screen.getByText("42")).not.toBeNull();
  }, 15000);

  it("renders reset button when active filters exist", () => {
    const onReset = vi.fn();
    render(
      <TableFilterToolbar
        totalCount={5}
        hasActiveFilters={true}
        onResetFilters={onReset}
        resetLabel="Đặt lại"
      />,
    );

    const resetBtn = screen.getByRole("button", { name: /Đặt lại/i });
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalled();
  });

  it("renders date filter when provided", () => {
    const onDateChange = vi.fn();
    render(
      <TableFilterToolbar
        dateFilter={{
          label: "ngày kiểm tra",
          value: emptyDatePeriodFilter(),
          onChange: onDateChange,
        }}
      />,
    );

    expect(screen.getByText("Thời gian:")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Hôm nay" })).not.toBeNull();
  });
});

