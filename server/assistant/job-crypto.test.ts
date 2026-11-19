import { afterEach, expect, it, vi } from "vitest";
vi.mock("../config/env",()=>({getJwtAccessSecret:()=>"test-only-assistant-secret-with-enough-entropy"}));
import { sealAssistantJob, openAssistantJob } from "./job-crypto";
afterEach(()=>vi.restoreAllMocks());
it("encrypts authorization and rejects tampering",()=>{
  const sealed=sealAssistantJob({authorization:"Bearer private-token",input:{text:"Đếm nhân viên"}});
  expect(sealed).not.toContain("private-token");
  expect(openAssistantJob(sealed).input.text).toBe("Đếm nhân viên");
  const bytes=Buffer.from(sealed,"base64");bytes[30]^=1;
  expect(()=>openAssistantJob(bytes.toString("base64"))).toThrow();
});
