import mongoose from "mongoose";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { LearningRoadmapService } from "./learning-roadmap.service";

describe("LearningRoadmapService.listRoadmapSteps", () => {
  const originalReadyState = mongoose.connection.readyState;
  const originalQueryExec = mongoose.Query.prototype.exec;
  let roadmapResult: any = null;
  let courseResult: any[] = [];
  let roadmapFilter: Record<string, any> | undefined;
  let courseFilter: Record<string, any> | undefined;

  Object.defineProperty(mongoose.connection, "readyState", { get: () => 1, configurable: true });
  mongoose.Query.prototype.exec = async function (this: any) {
    const modelName = this.model.modelName;
    if (modelName === "LearningRoadmap") {
      roadmapFilter = this.getFilter();
      return roadmapResult;
    }
    if (modelName === "Course") {
      courseFilter = this.getFilter();
      return courseResult;
    }
    return [];
  };

  beforeEach(() => {
    roadmapResult = {
      steps: [
        { id: "basic", courseId: "course-a", order: 1, minClassSize: 4, maxClassSize: 12 },
        { id: "advanced", courseId: "course-b", order: 2, minClassSize: 2, maxClassSize: 8 },
      ],
    };
    courseResult = [{ _id: "course-a", title: "Tiếng Anh cơ bản", code: "EN-A" }];
    roadmapFilter = undefined;
    courseFilter = undefined;
  });

  afterAll(() => {
    Object.defineProperty(mongoose.connection, "readyState", { get: () => originalReadyState, configurable: true });
    mongoose.Query.prototype.exec = originalQueryExec;
  });

  it("returns only steps matching the selected course and scopes both reads", async () => {
    const result = await LearningRoadmapService.listRoadmapSteps(["owner-a", "owner-b"], "roadmap-id", "branch-a", "course-a");
    expect(roadmapFilter).toMatchObject({ _id: "roadmap-id", ownerId: { $in: ["owner-a", "owner-b"] }, branchId: "branch-a", status: "active" });
    expect(courseFilter).toMatchObject({ _id: { $in: ["course-a"] }, ownerId: { $in: ["owner-a", "owner-b"] }, branchId: "branch-a" });
    expect(result).toEqual([{
      stepId: "basic",
      name: "Chặng 1: Tiếng Anh cơ bản",
      code: "EN-A",
      courseId: "course-a",
      courseTitle: "Tiếng Anh cơ bản",
      courseCode: "EN-A",
      order: 1,
      minClassSize: 4,
      maxClassSize: 12,
    }]);
  });

  it("does not offer steps for an inactive or inaccessible roadmap", async () => {
    roadmapResult = null;
    const result = await LearningRoadmapService.listRoadmapSteps("owner-a", "roadmap-id", "branch-a");
    expect(result).toBeNull();
    expect(courseFilter).toBeUndefined();
  });
});
