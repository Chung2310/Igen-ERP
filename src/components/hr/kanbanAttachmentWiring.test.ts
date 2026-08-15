import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Kanban attachment wiring", () => {
  it("uses the managed Kanban upload source for files, audio recordings, and video recordings", () => {
    const source = readFileSync(new URL("./KanbanTab.tsx", import.meta.url), "utf8");

    expect(source).toContain('sourceType: "hr.kanban"');
    expect(source).toContain("uploadToMediaRelay(f, f.name)");
    expect(source).toContain("uploadToMediaRelay(blob, name)");
    expect(source).toContain('type: "audio"');
    expect(source).toContain('type: "video"');
  });

  it("shares the attachment editor between task and project creation", () => {
    const source = readFileSync(new URL("./KanbanTab.tsx", import.meta.url), "utf8");

    expect(source).toContain("<AttachmentEditor attachments={editAttachments} onChange={setEditAttachments} />");
    expect(source).toContain("<AttachmentEditor attachments={newProjectAttachments} onChange={setNewProjectAttachments} />");
  });
});
