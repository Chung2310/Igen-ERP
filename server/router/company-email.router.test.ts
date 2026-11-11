import { describe, expect, it } from "vitest";
import { normalizeSmtpPayload } from "./company-email.router";

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
