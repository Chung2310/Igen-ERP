// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PageChatSimulator } from "./PageChatSimulator";
vi.mock("../../../shared/context/AuthContext", () => ({ useAuth: () => ({ userProfile: { companyCode: "ACME" } }) }));
vi.mock("../../../shared/services/authService", () => ({ getAccessToken: () => "test" }));
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, "", "/"); });
it("keeps messages in separate simulated conversations", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { text: "Mình cần sơn trong hay ngoài nhà ạ?", stage: "Tìm hiểu", nextStep: "Hỏi phạm vi", sources: ["Tệp mô phỏng"] } }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<PageChatSimulator />);
  fireEvent.change(screen.getByLabelText("Tin nhắn khách"), { target: { value: "Anh cần sơn nhà" } });
  fireEvent.click(screen.getByText("Gửi thử"));
  const chat = screen.getByLabelText("Cuộc trò chuyện đang chọn");
  await within(chat).findByText("Mình cần sơn trong hay ngoài nhà ạ?");
  fireEvent.click(screen.getByText("Tạo cuộc trò chuyện"));
  expect(within(screen.getByLabelText("Cuộc trò chuyện đang chọn")).queryByText("Mình cần sơn trong hay ngoài nhà ạ?")).toBeNull();
  expect(screen.getByText("Nhập tin đầu tiên của khách để bắt đầu chat.")).toBeTruthy();
  fireEvent.click(screen.getByText("Anh cần sơn nhà"));
  await waitFor(() => expect(within(screen.getByLabelText("Cuộc trò chuyện đang chọn")).getByText("Mình cần sơn trong hay ngoài nhà ạ?")).toBeTruthy());
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("uses the ERP flow only when a new conversation is set to real mode", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {
    text: "Đơn thử RT-MAIN-001 đã được lưu vào module Bán hàng dưới dạng nháp, chưa thanh toán.",
    stage: "Đã lưu khách và đơn nháp", nextStep: "Kiểm tra đơn", sources: ["Module Bán hàng"],
    persisted: { customer: { id: "customer-1", name: "Khách Test", phone: "0900000999" },
      order: { id: "order-1", orderCode: "RT-MAIN-001", status: "draft", paymentStatus: "unpaid", total: 65000 } },
  } }) });
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState({}, "", "?pageId=PAGE_BAKERY_DEMO");
  render(<PageChatSimulator />);
  fireEvent.change(screen.getByLabelText("Chế độ chat"), { target: { value: "erp" } });
  fireEvent.change(screen.getByLabelText("Tin nhắn khách"), { target: { value: "Tôi muốn đặt bánh" } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi tin vào flow ERP" }));
  await within(screen.getByLabelText("Cuộc trò chuyện đang chọn")).findByText("Đơn thử RT-MAIN-001 đã được lưu vào module Bán hàng dưới dạng nháp, chưa thanh toán.");
  expect(screen.getByText(/RT-MAIN-001 · Nháp · Chưa thanh toán/)).toBeTruthy();
  const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/v1/company-knowledge/simulate-page-chat-real");
  expect(JSON.parse(String(request.body))).toMatchObject({ pageId: "PAGE_BAKERY_DEMO", message: "Tôi muốn đặt bánh" });
  expect(JSON.parse(String(request.body))).not.toHaveProperty("documentText");
});
