import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("student quality routes are mounted with the student module and area guard", () => {
  const router = read("server/modules/student-management/router.ts");
  assert.match(router, /studentQualityRoutes/);
  assert.match(router, /use\("\/student-quality", authMiddleware as unknown as RequestHandler, requireStudentModule, areaRead\("student-quality"\), studentQualityRoutes\)/);
});

test("student quality routes use teacher operation guards for class-scoped updates", () => {
  const routes = read("server/modules/student-management/routes/student-quality.routes.ts");
  assert.match(routes, /router\.get\("\/"/);
  assert.match(routes, /router\.patch\("\/batches\/:batchId\/students\/:studentId", requireTeacherOperation/);
  assert.match(routes, /router\.post\("\/batches\/:batchId\/students\/:studentId\/mini-tests", requireTeacherOperation/);
  assert.match(routes, /assignments\/:assignmentId/, "assignment scores should be managed from the quality tab");
});
