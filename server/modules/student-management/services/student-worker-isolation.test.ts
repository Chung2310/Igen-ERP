import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function scanDirectory(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanDirectory(filePath, fileList);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

describe("module separation isolation check", () => {
  it("ensures worker-management does not import student-management models", () => {
    const workerDir = path.join(process.cwd(), "server/modules/worker-management");
    const files = scanDirectory(workerDir);

    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      // Check for incorrect student-management imports
      expect(content).not.toContain("student-management/models/student.model");
      expect(content).not.toContain("student-management/models/batch.model");
      expect(content).not.toContain("student-management/models/course.model");
    });
  });

  it("ensures student-management router has no worker attendance routes mounted", () => {
    const routerPath = path.join(process.cwd(), "server/modules/student-management/router.ts");
    const content = fs.readFileSync(routerPath, "utf8");
    
    expect(content).not.toContain("worker-attendance.routes");
    expect(content).not.toContain("/attendance/worker");
  });
});
