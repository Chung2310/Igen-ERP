import { afterEach, expect, it, vi } from "vitest";
import { Batch } from "../models/batch.model";
import { LearningRoadmap } from "../models/learning-roadmap.model";
import { LearningRoadmapService } from "./learning-roadmap.service";

afterEach(() => vi.restoreAllMocks());

it("uses the source class's assigned roadmap and the first later step in order", async () => {
  const sharedCourse = "shared-course";
  const step = (id: string, order: number, courseId: string) => ({ id, order, courseId });
  const assigned = { _id: "assigned", steps: [step("later", 5, "course-5"), step("current", 1, sharedCourse), step("next", 3, "course-3")] };
  const other = { _id: "other", steps: [step("other-start", 1, sharedCourse), step("other-next", 2, "different-course")] };
  const batch = { _id: "batch", courseId: sharedCourse, roadmapId: "assigned", roadmapStepId: "current", learnerIds: [] };
  vi.spyOn(Batch, "findOne").mockReturnValue({ lean: async () => batch } as never);
  vi.spyOn(LearningRoadmap, "find").mockImplementation((query) => {
    const id = (query as { _id?: string } | undefined)?._id;
    return { lean: async () => [other, assigned].filter((roadmap) => !id || roadmap._id === id) } as never;
  });

  const result = await LearningRoadmapService.getBatchProgression("owner", "batch", undefined, "branch");

  expect(result.selectedRoadmapId).toBe("assigned");
  expect(result.sourceStep?.id).toBe("current");
  expect(result.targetStep).toMatchObject({ id: "next", courseId: "course-3" });
  await expect(LearningRoadmapService.getBatchProgression("owner", "batch", "other", "branch")).rejects.toThrow("lộ trình khác");
});

it("does not guess a new roadmap if the assigned roadmap is missing", async () => {
  const batch = { _id: "batch", courseId: "shared-course", roadmapId: "missing", roadmapStepId: "current", learnerIds: [] };
  vi.spyOn(Batch, "findOne").mockReturnValue({ lean: async () => batch } as never);
  vi.spyOn(LearningRoadmap, "find").mockReturnValue({ lean: async () => [] } as never);

  await expect(LearningRoadmapService.getBatchProgression("owner", "batch", undefined, "branch")).rejects.toThrow("Không tìm thấy lộ trình đã gắn");
});
