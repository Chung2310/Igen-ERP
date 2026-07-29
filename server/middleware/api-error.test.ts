import assert from "node:assert/strict";
import test from "node:test";
import { classifyApiError } from "./api-error";

test("classifies expected API errors without turning them into 500", () => {
  assert.deepEqual(
    classifyApiError(new Error('Số điện thoại "0123456750" đã tồn tại cho đối tác của trung tâm.')),
    { statusCode: 409, message: 'Số điện thoại "0123456750" đã tồn tại cho đối tác của trung tâm.' },
  );

  assert.deepEqual(
    classifyApiError(Object.assign(new Error("duplicate key"), { code: 11000 })),
    { statusCode: 409, message: "Dữ liệu đã tồn tại." },
  );

  assert.deepEqual(
    classifyApiError(Object.assign(new Error("Dữ liệu không hợp lệ."), { isJoi: true })),
    { statusCode: 400, message: "Dữ liệu không hợp lệ." },
  );

  assert.deepEqual(
    classifyApiError(Object.assign(new Error("Dữ liệu vừa được thay đổi."), { status: 409 })),
    { statusCode: 409, message: "Dữ liệu vừa được thay đổi." },
  );

  assert.deepEqual(
    classifyApiError(new Error("Database unavailable")),
    { statusCode: 500, message: "Đã xảy ra lỗi hệ thống." },
  );
});
