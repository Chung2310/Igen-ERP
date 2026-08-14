// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PayrollPayslipsPanel } from "./PayrollPayslipsPanel";

describe("PayrollPayslipsPanel publication controls", () => {
  it("lets a payroll manager publish or republish a closed run", () => {
    const publish = vi.fn();
    render(<PayrollPayslipsPanel
      canManage
      publishedCount={1}
      runStatus="closed"
      onPublish={publish}
      onExport={vi.fn()}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Phát hành lại phiếu lương" }));

    expect(publish).toHaveBeenCalledOnce();
  });

  it("does not offer publication before close or to a read-only user", () => {
    const { rerender } = render(<PayrollPayslipsPanel
      canManage
      publishedCount={0}
      runStatus="review"
      onPublish={vi.fn()}
      onExport={vi.fn()}
    />);
    expect(screen.queryByRole("button", { name: "Phát hành phiếu lương" })).toBeNull();

    rerender(<PayrollPayslipsPanel
      canManage={false}
      publishedCount={0}
      runStatus="closed"
      onPublish={vi.fn()}
      onExport={vi.fn()}
    />);
    expect(screen.queryByRole("button", { name: "Phát hành phiếu lương" })).toBeNull();
  });
});
