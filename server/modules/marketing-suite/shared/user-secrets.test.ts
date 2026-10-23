import { afterEach, expect, it, vi } from "vitest";
import { UserModel } from "../../../model/user.model";

afterEach(() => vi.restoreAllMocks());
const privatePaths = ["elevenlabsAccess.apiKey", "canvaIntegration.accessToken", "canvaIntegration.refreshToken", "canvaIntegration.oauthState", "canvaIntegration.oauthStateExpiresAt", "canvaIntegration.oauthCodeVerifier"];

it("excludes new provider credentials from default database projections, including lean reads", async () => {
  const findOne = vi.spyOn(UserModel.collection, "findOne").mockResolvedValue(null);
  await UserModel.findById("507f1f77bcf86cd799439011").lean();
  expect(findOne).toHaveBeenCalledOnce();
  const options = findOne.mock.calls[0][1];
  for (const field of privatePaths) expect(options?.projection?.[field]).toBe(0);
});

it("also strips explicitly selected secrets when a User document is serialized", () => {
  const user = new UserModel({ email: "synthetic@erp.test", displayName: "Synthetic", elevenlabsAccess: { apiKey: "synthetic-voice-key" }, canvaIntegration: { connected: true, accessToken: "synthetic-access", refreshToken: "synthetic-refresh", oauthState: "synthetic-state", oauthCodeVerifier: "synthetic-verifier", oauthStateExpiresAt: new Date() } });
  for (const result of [user.toJSON(), user.toObject()]) {
    expect(result.elevenlabsAccess).not.toHaveProperty("apiKey");
    expect(result.canvaIntegration).toEqual({ connected: true });
  }
  expect(user.elevenlabsAccess?.apiKey).toBe("synthetic-voice-key");
  expect(user.canvaIntegration?.accessToken).toBe("synthetic-access");
});

it("lets only explicit server selections retrieve provider credentials", async () => {
  const findOne = vi.spyOn(UserModel.collection, "findOne").mockResolvedValue(null);
  await UserModel.findById("507f1f77bcf86cd799439011").select("companyCode +elevenlabsAccess.apiKey").lean();
  expect(findOne.mock.calls[0][1]?.projection).toMatchObject({ "elevenlabsAccess.apiKey": 1, companyCode: 1 });
  expect(findOne.mock.calls[0][1]?.projection).not.toHaveProperty("elevenlabsAccess");
});

it("selects Canva credentials without a parent/child projection collision", async () => {
  const findOne = vi.spyOn(UserModel.collection, "findOne").mockResolvedValue(null);
  await UserModel.findById("507f1f77bcf86cd799439011").select("canvaIntegration.connected canvaIntegration.tokenExpiresAt canvaIntegration.connectedAt +canvaIntegration.accessToken +canvaIntegration.refreshToken");
  expect(findOne.mock.calls[0][1]?.projection).toMatchObject({ "canvaIntegration.connected": 1, "canvaIntegration.accessToken": 1, "canvaIntegration.refreshToken": 1 });
  expect(findOne.mock.calls[0][1]?.projection).not.toHaveProperty("canvaIntegration");
});
