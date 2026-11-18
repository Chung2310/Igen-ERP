import { expect, it } from "vitest";
import { apiRejectionReason } from "./api-rejection";

it("keeps validation reasons from the real middleware envelope without internal context", () => {
  expect(apiRejectionReason({ message: "Dữ liệu yêu cầu không hợp lệ", errors: { body: ['Trường "email" phải là email hợp lệ.'] }, stack: "private", request: { password: "secret" } }))
    .toBe('Dữ liệu yêu cầu không hợp lệ\nTrường "email" phải là email hợp lệ.');
});
it("supports nested domain errors and plain conflict reasons", () => {
  expect(apiRejectionReason({ error: { code: "VALIDATION_FAILED", message: "Mã đã tồn tại.", details: [{ message: "Chọn mã khác.", context: { value: "private" } }] } }))
    .toBe("Mã đã tồn tại.\nChọn mã khác.");
});
