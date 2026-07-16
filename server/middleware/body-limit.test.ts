import assert from "node:assert/strict";
import test from "node:test";
import { isLargeBodyRoute } from "./body-limit";

test("classifies approved base64 upload routes as large-body routes", () => {
  assert.equal(isLargeBodyRoute("/api/v1/media/upload"), true);
  assert.equal(isLargeBodyRoute("/api/v1/resources/drive/upload"), true);
  assert.equal(isLargeBodyRoute("/api/v1/integrations/google-drive/upload"), true);
  assert.equal(isLargeBodyRoute("/api/v1/integrations/google-drive/upload/group/room-1"), true);
});

test("keeps ordinary and metadata routes on the general body limit", () => {
  assert.equal(isLargeBodyRoute("/api/v1/auth/login"), false);
  assert.equal(isLargeBodyRoute("/api/v1/media/sign-upload"), false);
  assert.equal(isLargeBodyRoute("/api/v1/resources"), false);
  assert.equal(isLargeBodyRoute("/api/v1/health"), false);
});
