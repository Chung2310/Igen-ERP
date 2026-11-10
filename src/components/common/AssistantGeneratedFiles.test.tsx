// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantGeneratedFiles } from "./AssistantGeneratedFiles";
import type { AssistantGeneratedFile } from "../../shared/assistant-document";

const downloadFile = vi.hoisted(() => vi.fn());
vi.mock("../../services/assistantService", () => ({ assistantService: { downloadFile } }));
const file: AssistantGeneratedFile = { id: "file", documentId: "document", conversationId: "conversation", version: 2, fileName: "Kế hoạch-v2.xlsx", format: "xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 2048 };
const createObjectURL = vi.fn(() => "blob:download");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  downloadFile.mockReset(); createObjectURL.mockClear(); revokeObjectURL.mockClear();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("downloads the selected version with branch context and an accessible action", async () => {
  downloadFile.mockResolvedValue(new Blob(["workbook"]));
  render(<AssistantGeneratedFiles files={[file]} branchId="branch-current" />);
  fireEvent.click(screen.getByRole("button", { name: "Tải xuống Kế hoạch-v2.xlsx" }));
  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(downloadFile).toHaveBeenCalledWith(file, "branch-current");
  expect(screen.getByText(/Phiên bản 2/)).toBeTruthy();
  expect(document.querySelector('a[href="blob:download"]')).toBeNull();
});

it("announces loading and shows download errors next to the file, allowing retry", async () => {
  let rejectDownload: (error: Error) => void = () => undefined;
  downloadFile.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectDownload = reject; }));
  render(<AssistantGeneratedFiles files={[file]} />);
  const button = screen.getByRole("button", { name: "Tải xuống Kế hoạch-v2.xlsx" }) as HTMLButtonElement;
  fireEvent.click(button);
  expect(button.disabled).toBe(true);
  expect(screen.getByRole("status").textContent).toContain("Đang tải tệp");
  rejectDownload(new Error("Tệp không tồn tại"));
  expect((await screen.findByRole("alert")).textContent).toBe("Tệp không tồn tại");
  expect(button.disabled).toBe(false);
  downloadFile.mockResolvedValueOnce(new Blob(["retry"]));
  fireEvent.click(button);
  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(screen.queryByRole("alert")).toBeNull();
});
