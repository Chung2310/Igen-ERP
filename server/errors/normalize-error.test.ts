import assert from "node:assert/strict";
import test from "node:test";
import Joi from "joi";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import multer from "multer";
import { ConflictError, InternalError } from "./app-error";
import { normalizeError } from "./normalize-error";

test("returns an AppError unchanged", () => {
  const expected = new ConflictError("CONFLICT", "Xung đột");
  assert.equal(normalizeError(expected), expected);
});

test("normalizes Joi validation fields without exposing implementation metadata", () => {
  const { error } = Joi.object({ phone: Joi.string().required() }).validate({});
  const normalized = normalizeError(error);
  assert.equal(normalized.status, 400);
  assert.equal(normalized.code, "VALIDATION_FAILED");
  assert.deepEqual(normalized.details, { fields: ["phone"] });
});

test("normalizes Mongoose validation and cast errors", () => {
  const validation = new mongoose.Error.ValidationError();
  validation.addError("name", new mongoose.Error.ValidatorError({ path: "name", message: "required" }));
  const normalizedValidation = normalizeError(validation);
  assert.equal(normalizedValidation.code, "MODEL_VALIDATION_FAILED");
  assert.deepEqual(normalizedValidation.details, { fields: ["name"] });

  const cast = new mongoose.Error.CastError("ObjectId", "bad-secret-id", "partnerId");
  const normalizedCast = normalizeError(cast);
  assert.equal(normalizedCast.status, 400);
  assert.equal(normalizedCast.code, "INVALID_IDENTIFIER");
  assert.deepEqual(normalizedCast.details, { field: "partnerId" });
  assert.equal(JSON.stringify(normalizedCast).includes("bad-secret-id"), false);
});

test("normalizes duplicate keys without exposing their values", () => {
  const normalized = normalizeError(Object.assign(new Error("duplicate 0123456750"), {
    code: 11000,
    keyPattern: { phone: 1 },
    keyValue: { phone: "0123456750" },
  }));
  assert.equal(normalized.status, 409);
  assert.equal(normalized.code, "DATABASE_CONFLICT");
  assert.deepEqual(normalized.details, { fields: ["phone"] });
  assert.equal(normalized.message.includes("0123456750"), false);
});

test("normalizes JWT and Multer errors by explicit type or code", () => {
  assert.equal(normalizeError(new jwt.TokenExpiredError("expired", new Date())).code, "AUTH_TOKEN_EXPIRED");
  assert.equal(normalizeError(new jwt.JsonWebTokenError("invalid signature")).code, "AUTH_TOKEN_INVALID");

  const upload = normalizeError(new multer.MulterError("LIMIT_FILE_SIZE"));
  assert.equal(upload.status, 413);
  assert.equal(upload.code, "PAYLOAD_TOO_LARGE");
});

test("temporarily accepts a numeric legacy HTTP status", () => {
  const normalized = normalizeError(Object.assign(new Error("Không tìm thấy"), { statusCode: 404 }));
  assert.equal(normalized.status, 404);
  assert.equal(normalized.code, "LEGACY_HTTP_ERROR");
  assert.equal(normalized.message, "Không tìm thấy");
});

test("plain errors become private internal errors and preserve the cause", () => {
  const source = new Error("database password leaked");
  const normalized = normalizeError(source);
  assert.equal(normalized instanceof InternalError, true);
  assert.equal(normalized.status, 500);
  assert.equal(normalized.expose, false);
  assert.equal(normalized.cause, source);
  assert.equal(normalized.message.includes("password"), false);
});

test("does not infer status from message text", () => {
  const normalized = normalizeError(new Error("phone already exists duplicate key unauthorized"));
  assert.equal(normalized.status, 500);
  assert.equal(normalized.code, "INTERNAL_ERROR");
});

test("normalizes Joi-shaped validation errors without array details", () => {
  const normalized = normalizeError({ isJoi: true, name: "ValidationError", details: undefined });
  assert.equal(normalized.status, 400);
  assert.equal(normalized.code, "VALIDATION_FAILED");
});
