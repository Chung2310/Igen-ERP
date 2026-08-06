// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

vi.mock("../../../pages/Toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { ImportWorkerModal, parseWorkerSheet } from "./ImportWorkerModal";
import { toast } from "../../../pages/Toast";

const sheet = (rows: unknown[][]) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));
};

const HEADERS = ["Họ và tên", "Số điện thoại", "Ngày sinh", "CCCD / CMND", "Email", "Địa chỉ", "Ghi chú"];

function upload(bytes: Uint8Array, name = "lao-dong.xlsx") {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([bytes], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  // jsdom's FileReader cannot read a File built from a Uint8Array reliably,
  // so hand the component the buffer directly.
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  fireEvent.change(input, { target: { files: [file] } });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("parseWorkerSheet", () => {
  it("maps Vietnamese headers in any order and normalizes phones", () => {
    const rows = parseWorkerSheet([
      ["Số điện thoại", "Họ và tên", "Email"],
      ["0912 345 678", "Nguyễn Văn A", "A@Example.com"],
      ["+84987654321", "Trần Thị B", ""],
    ]).rows;

    expect(rows).toHaveLength(2);
    expect(rows[0].data).toMatchObject({ fullName: "Nguyễn Văn A", phone: "0912345678", email: "A@Example.com" });
    expect(rows[1].data.phone).toBe("0987654321");
    expect(rows.every((row) => row.isValid)).toBe(true);
  });

  it("accepts unaccented and short header aliases", () => {
    const rows = parseWorkerSheet([
      ["ho ten", "sdt", "cmnd"],
      ["Nguyễn Văn A", "0912345678", "001"],
    ]).rows;
    expect(rows[0].data).toMatchObject({ fullName: "Nguyễn Văn A", phone: "0912345678", idCard: "001" });
  });

  it("reports missing required columns instead of parsing", () => {
    const result = parseWorkerSheet([["Email", "Địa chỉ"], ["a@b.c", "HN"]]);
    expect(result.error).toContain("Họ và tên");
    expect(result.error).toContain("Số điện thoại");
    expect(result.rows).toEqual([]);
  });

  it("flags empty name, empty phone, and duplicates within the file", () => {
    const rows = parseWorkerSheet([
      HEADERS,
      ["", "0912345678", "", "", "", "", ""],
      ["Trần Thị B", "", "", "", "", "", ""],
      ["Lê Văn C", "0912345678", "", "", "", "", ""],
      ["Phạm Thị D", "0912.345.678", "", "", "", "", ""],
    ]).rows;

    expect(rows[0].errors[0]).toContain("Họ và tên");
    expect(rows[1].errors[0]).toContain("Số điện thoại");
    expect(rows[2].isValid).toBe(true);
    expect(rows[3].errors[0]).toContain("trùng");
  });

  it("validates the birthday format and skips fully blank rows", () => {
    const rows = parseWorkerSheet([
      HEADERS,
      ["Nguyễn Văn A", "0912345678", "1995-12-25", "", "", "", ""],
      [null, null, null, null, null, null, null],
      ["Trần Thị B", "0987654321", "25/12/1995", "", "", "", ""],
    ]).rows;

    expect(rows).toHaveLength(2);
    expect(rows[0].errors[0]).toContain("DD/MM/YYYY");
    expect(rows[1].isValid).toBe(true);
  });

  it("keeps the spreadsheet row number so users can find the bad line", () => {
    const rows = parseWorkerSheet([HEADERS, ["A", "0912345678", "", "", "", "", ""], ["", "", "", "", "", "", ""], ["", "0987654321", "", "", "", "", ""]]).rows;
    expect(rows.map((row) => row.rowNum)).toEqual([2, 4]);
  });
});

describe("ImportWorkerModal", () => {
  const setup = (overrides: Record<string, unknown> = {}) => {
    const onImport = vi.fn().mockResolvedValue({ importedCount: 2, skippedCount: 0, errors: [] });
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(
      <ImportWorkerModal
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        onImport={onImport}
        projects={[{ id: "project-1", name: "Dự án Bắc Ninh" }]}
        {...(overrides as any)}
      />,
    );
    return { onImport, onClose, onSuccess };
  };

  it("renders nothing when closed", () => {
    setup({ isOpen: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts on the dropzone with a template download", () => {
    setup();
    expect(screen.getByRole("button", { name: /Tải file mẫu/ })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("previews parsed rows with a valid/error summary", async () => {
    setup();
    upload(sheet([HEADERS, ["Nguyễn Văn A", "0912345678", "", "", "", "", ""], ["", "0987654321", "", "", "", "", ""]]));

    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());
    expect(screen.getByText("1 hợp lệ")).toBeTruthy();
    expect(screen.getByText("1 lỗi")).toBeTruthy();
    expect(screen.getByText("0912345678")).toBeTruthy();
  });

  it("sends only valid rows and the chosen project", async () => {
    const { onImport, onSuccess } = setup();
    upload(sheet([HEADERS, ["Nguyễn Văn A", "0912 345 678", "", "", "", "", ""], ["", "0987654321", "", "", "", "", ""]]));
    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Gán vào dự án"), { target: { value: "project-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Nhập 1 lao động/ }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(onImport).toHaveBeenCalledWith(
      [expect.objectContaining({ fullName: "Nguyễn Văn A", phone: "0912345678" })],
      "project-1",
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("refuses to submit when no row is valid", async () => {
    const { onImport } = setup();
    upload(sheet([HEADERS, ["", "0987654321", "", "", "", "", ""]]));
    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Kiểm tra lỗi/ }));
    expect(onImport).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();
  });

  it("shows the server-side skip reasons after a partial import", async () => {
    const onImport = vi.fn().mockResolvedValue({
      importedCount: 1,
      skippedCount: 1,
      errors: [{ row: 2, name: "Trần Thị B", phone: "0987654321", reason: "Số điện thoại đã tồn tại trong hệ thống." }],
    });
    setup({ onImport });
    upload(sheet([HEADERS, ["Nguyễn Văn A", "0912345678", "", "", "", "", ""], ["Trần Thị B", "0987654321", "", "", "", "", ""]]));
    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Nhập 2 lao động/ }));
    await waitFor(() => expect(screen.getByText("Kết quả nhập dữ liệu")).toBeTruthy());
    expect(screen.getByText("Số điện thoại đã tồn tại trong hệ thống.")).toBeTruthy();
  });

  it("surfaces a failed request without closing", async () => {
    const onImport = vi.fn().mockRejectedValue(new Error("Máy chủ từ chối"));
    const { onClose } = setup({ onImport });
    upload(sheet([HEADERS, ["Nguyễn Văn A", "0912345678", "", "", "", "", ""]]));
    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Nhập 1 lao động/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Máy chủ từ chối"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("rejects a file with an unsupported extension", async () => {
    setup();
    upload(sheet([HEADERS]), "danh-sach.pdf");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(".xlsx"));
  });

  it("lets the user reset back to the dropzone", async () => {
    setup();
    upload(sheet([HEADERS, ["Nguyễn Văn A", "0912345678", "", "", "", "", ""]]));
    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("button", { name: /Tải file mẫu/ })).toBeTruthy();
  });
});
