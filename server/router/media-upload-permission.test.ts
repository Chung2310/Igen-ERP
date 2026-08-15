import { describe, expect, it } from "vitest";
import { permissionForMediaUpload } from "./media-upload-permission";

describe("permissionForMediaUpload", () => {
  it("allows Kanban task and project audio/video uploads through the work permission", () => {
    expect(permissionForMediaUpload("hr.kanban")).toBe("work:manage");
  });

  it("keeps generic and unknown uploads behind resource management", () => {
    expect(permissionForMediaUpload(undefined)).toBe("resource:manage");
    expect(permissionForMediaUpload("unknown.source")).toBe("resource:manage");
  });
});
