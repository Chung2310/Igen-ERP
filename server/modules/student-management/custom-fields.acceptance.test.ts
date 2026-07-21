import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { MODULE_KEYS, type ModuleKey } from "./interfaces/custom-field.interface";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const moduleWiring: Record<ModuleKey, { form: string; details?: string }> = {
  students: {
    form: "src/modules/student-management/components/Student/AddStudentModal.tsx",
    details: "src/modules/student-management/components/Student/DetailTabs/ProfileTab.tsx",
  },
  courses: {
    form: "src/modules/student-management/pages/Courses/CoursesPage.tsx",
  },
  batches: {
    form: "src/modules/student-management/pages/Batches/BatchesPage.tsx",
  },
  exams: {
    form: "src/modules/student-management/components/Exams/AddExamModal.tsx",
    details: "src/modules/student-management/components/Exams/ExamCard.tsx",
  },
  resources: {
    form: "src/modules/student-management/pages/Resources/components/AddResourceModal.tsx",
    details: "src/modules/student-management/pages/Resources/components/ResourceCard.tsx",
  },
  partners: {
    form: "src/modules/student-management/pages/Partners/components/AddPartnerModal.tsx",
    details: "src/modules/student-management/pages/Partners/components/PartnerDetailModal.tsx",
  },
};

test("the acceptance matrix contains exactly the supported modules", () => {
  assert.deepEqual(Object.keys(moduleWiring), MODULE_KEYS);
});

for (const moduleKey of MODULE_KEYS) {
  test(`${moduleKey} is wired across persistence, validation, trusted writes, forms, payloads and any existing details surface`, () => {
    const singular = moduleKey === "batches" ? "batch" : moduleKey.slice(0, -1);
    const model = source(`server/modules/student-management/models/${singular}.model.ts`);
    const validation = source(`server/modules/student-management/validations/${singular}.validation.ts`);
    const controller = source(`server/modules/student-management/controllers/${singular}.controller.ts`);
    const form = source(moduleWiring[moduleKey].form);

    assert.match(model, /customFields\s*:\s*\{\s*type:\s*Schema\.Types\.Mixed/, `${moduleKey} model`);
    assert.match(validation, /customFields\s*:\s*Joi\.object\(\)\.unknown\(true\)\.optional\(\)/, `${moduleKey} validation`);
    assert.match(controller, new RegExp(`moduleKey:\\s*["']${moduleKey}["']`), `${moduleKey} trusted write context`);
    assert.match(form, new RegExp(`CustomFieldsSection[\\s\\S]*?moduleKey=["']${moduleKey}["']`), `${moduleKey} form section`);
    assert.match(form, /customFields/, `${moduleKey} form payload`);
    const detailsPath = moduleWiring[moduleKey].details;
    if (detailsPath) {
      assert.match(
        source(detailsPath),
        new RegExp(`CustomFieldDetails[\\s\\S]*?moduleKey=["']${moduleKey}["']`),
        `${moduleKey} existing details surface`,
      );
    }
  });
}

test("custom fields remain absent from payment, notification and secondary action forms", () => {
  const excludedFiles = [
    "server/modules/student-management/routes/payment.routes.ts",
    "server/modules/student-management/routes/notification.routes.ts",
    "server/modules/student-management/services/payment.service.ts",
    "server/modules/student-management/services/notification.service.ts",
    "src/modules/student-management/components/Fees/AddPaymentModal.tsx",
    "src/modules/student-management/components/Student/DetailTabs/EditPaymentModal.tsx",
    "src/modules/student-management/pages/Notifications/NotificationsPage.tsx",
    "src/modules/student-management/components/Exams/AssignStudentModal.tsx",
    "src/modules/student-management/pages/Partners/components/CommissionLevelModal.tsx",
    "src/modules/student-management/pages/Partners/components/AddPayoutModal.tsx",
  ];

  for (const path of excludedFiles) {
    assert.doesNotMatch(
      source(path),
      /CustomFieldsSection|CustomFieldDetails|custom-fields|customFields/,
      path,
    );
  }
});

test("the custom-field API is mounted once and exposes no hard-delete endpoint", () => {
  const studentRouter = source("server/modules/student-management/router.ts");
  const customFieldRoutes = source("server/modules/student-management/routes/custom-field.routes.ts");

  assert.equal((studentRouter.match(/student-management\/custom-fields/g) ?? []).length, 1);
  assert.doesNotMatch(customFieldRoutes, /router\.delete\s*\(/i);
  assert.match(customFieldRoutes, /\/:moduleKey\/:id\/archive/);
  assert.match(customFieldRoutes, /\/:moduleKey\/:id\/restore/);
});
