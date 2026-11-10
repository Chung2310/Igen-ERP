import { afterEach, describe, expect, it, vi } from "vitest";
import {
  celebrationAssistantPatchSchema,
  normalizeSmtpPayload,
  updateCelebrationAssistantSettings,
} from "./company-email.router";
import { CompanyModel } from "../model/company.model";

afterEach(() => vi.restoreAllMocks());

const smtp = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  user: "sender@example.com",
  password: "app-password",
  fromEmail: "sender@example.com",
  fromName: "Example",
};

describe("normalizeSmtpPayload", () => {
  it("unwraps nested data envelopes before SMTP validation", () => {
    expect(normalizeSmtpPayload({ data: { data: smtp } })).toEqual(smtp);
  });
});

describe("celebration assistant partial updates", () => {
  it("accepts only partial editable fields and enforces template limits", () => {
    expect(celebrationAssistantPatchSchema.validate({ birthdayEnabled: true }).error).toBeUndefined();
    expect(celebrationAssistantPatchSchema.validate({ holidayHtml: "<p>Xin chào</p>" }).error).toBeUndefined();
    expect(celebrationAssistantPatchSchema.validate({}).error).toBeDefined();
    expect(celebrationAssistantPatchSchema.validate({ uploadTokens: ["token"] }).error).toBeDefined();
    expect(celebrationAssistantPatchSchema.validate({ sendTime: "25:00" }).error).toBeDefined();
    expect(celebrationAssistantPatchSchema.validate({ birthdayHtml: "x".repeat(4001) }).error).toBeDefined();
  });

  it("updates only named settings through dotted paths and returns readable field labels", async () => {
    const updateOne = vi.spyOn(CompanyModel, "updateOne").mockResolvedValue({ matchedCount: 1 } as any);

    await expect(updateCelebrationAssistantSettings("ACME", { birthdayEnabled: false, sendTime: "08:30" })).resolves.toEqual({
      updatedFields: ["Email sinh nh\u1EADt", "Gi\u1EDD g\u1EEDi"],
    });

    expect(updateOne).toHaveBeenCalledWith(
      { code: "ACME" },
      { $set: { "celebrationConfig.birthdayEnabled": false, "celebrationConfig.sendTime": "08:30" } },
      { runValidators: true },
    );
  });
});
