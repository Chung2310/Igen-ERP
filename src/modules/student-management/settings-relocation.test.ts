import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

it("removes standalone settings from student management", () => {
  const source = read("./StudentManagementTab.tsx");
  assert.doesNotMatch(source, /SettingsPage/);
  assert.doesNotMatch(source, /cai-dat/);
  assert.doesNotMatch(source, /CÀI ĐẶT/);
});

it("hosts company configuration inside ERP settings for admins", () => {
  const erp = read("../../components/settings/ErpConfigTab.tsx");
  const settings = read("../../pages/SettingsTab.tsx");
  assert.match(erp, /StudentManagementErpSettings/);
  assert.match(erp, /CompanySmtpSettingsTab/);
  assert.match(erp, /userProfile\?\.role\s*===\s*["']admin["']/);
  assert.doesNotMatch(settings, /activeSubTab\s*===\s*["']smtp["']/);
  assert.doesNotMatch(settings, /id:\s*["']smtp["']/);
});

it("removes the legacy SMTP write route and request credential overrides", () => {
  const authRoutes = read("../../../server/modules/student-management/routes/auth.routes.ts");
  const routes = read("../../../server/modules/student-management/routes/index.ts");
  assert.doesNotMatch(authRoutes, /smtp-settings/);
  assert.doesNotMatch(routes, /smtpHost|smtpUser|smtpPass|smtpOwner|hasCustomSmtp/);
  assert.match(routes, /companyEmailService\.resolveLegacySettings/);
});

it("uses company SMTP without legacy user credential fallbacks", () => {
  for (const relative of [
    "../../../server/modules/student-management/services/batch.service.ts",
    "../../../server/modules/student-management/services/assignment.service.ts",
    "../../../server/modules/student-management/services/student-online-attendance.service.ts",
  ]) {
    const source = read(relative);
    assert.match(source, /companyEmailService\.resolveLegacySettings/);
    assert.doesNotMatch(source, /smtpHost smtpPort smtpSecure smtpUser smtpPass/);
    assert.doesNotMatch(source, /\.smtpHost|\.smtpUser|\.smtpPass/);
  }
});
