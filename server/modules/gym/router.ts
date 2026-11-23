import { Router, type RequestHandler } from "express";
import multer from "multer";
import { gymEntities, type GymEntity } from "../../../shared/gym/types";
import {
  requirePermission,
  type AuthenticatedRequest,
} from "../../middleware/auth";
import { ValidationError } from "../../errors/app-error";
import { gymScope, assertGymAdmin, type GymActor } from "./access";
import {
  getRecord,
  listRecords,
  publicRecord,
  recordId,
  removeRecord,
  saveRecord,
} from "./store";
import {
  assignPlan,
  createTrainer,
  updateTrainer,
  deleteTrainer,
  dashboard,
  publishKnowledge,
  publishGoal,
  publishMeasurement,
  publishWorkoutPlan,
  publishNutritionPlan,
  generateProgressReport,
  publishProgressReport,
  publishRoadmap,
  requestTransfer,
  respondTransfer,
  seedStandardKnowledge,
  trainers,
  trainerPage,
  transfer,
  transferBatch,
} from "./operations";
import { seedDefaultExercises, seedDefaultFoods } from "./seed-catalog";
import { searchKnowledge } from "./knowledge-index";
import {
  regenerateFoodImageAi,
  saveImage,
  updateFoodImageWithUpload,
  uploadKnowledge,
  uploadSessionPhoto,
  uploadTrainerAvatar,
} from "./media";
import {
  analyzeNutrition,
  createWorkoutProposal,
  generateExercise,
  generateNutritionPlan,
  generateRoadmap,
  generateWorkoutTemplate,
  saveExerciseBulk,
  scanInBody,
} from "./ai";

import { saveConsultation } from "./customer-notes";
import { createMuscleGroup, deleteMuscleGroup, listMuscleGroups } from "./muscle-groups";

export const gymRouter = Router();
gymRouter.use(requirePermission("gym:read") as RequestHandler);
gymRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 8 },
});
type Action = (req: AuthenticatedRequest, actor: GymActor) => Promise<unknown>;
const route =
  (action: Action): RequestHandler =>
  (req, res, next) => {
    void gymScope(req as AuthenticatedRequest)
      .then((actor) => action(req as AuthenticatedRequest, actor))
      .then((data) => res.json(data))
      .catch(next);
  };
const write = requirePermission("gym:manage") as RequestHandler;
const revision = (value: unknown) => {
  if (!Number.isInteger(Number(value)) || Number(value) < 1)
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Thiếu phiên bản dữ liệu. Vui lòng tải lại.",
    );
  return Number(value);
};
const entity = (value: unknown): GymEntity => {
  if (!gymEntities.includes(value as GymEntity))
    throw new ValidationError("VALIDATION_FAILED", "Nghiệp vụ không hợp lệ.");
  return value as GymEntity;
};
gymRouter.post(
  "/customers/:id/consultations",
  write,
  route((req, actor) => {
    const { revision: version, ...input } = req.body;
    return saveConsultation(
      actor,
      recordId(req.params.id),
      input,
      revision(version),
    );
  }),
);
gymRouter.patch(
  "/customers/:id/consultations/:noteId",
  write,
  route((req, actor) => {
    const { revision: version, ...input } = req.body;
    return saveConsultation(
      actor,
      recordId(req.params.id),
      input,
      revision(version),
      recordId(req.params.noteId),
    );
  }),
);
gymRouter.delete(
  "/customers/:id/consultations/:noteId",
  write,
  route((req, actor) =>
    saveConsultation(
      actor,
      recordId(req.params.id),
      undefined,
      revision(req.body.revision),
      recordId(req.params.noteId),
      true,
    ),
  ),
);
gymRouter.get(
  "/dashboard",
  route((req, actor) => dashboard(actor, req.query as Record<string, unknown>)),
);
gymRouter.post(
  "/food-images/seed-defaults",
  write,
  route((_req, actor) => seedDefaultFoods(actor)),
);
gymRouter.post(
  "/exercises/seed-defaults",
  write,
  route((_req, actor) => seedDefaultExercises(actor)),
);
gymRouter.get(
  "/trainers",
  route((_req, actor) => trainers(actor)),
);
gymRouter.get("/trainers/page", route((req, actor) => trainerPage(actor, req.query)));
gymRouter.post(
  "/trainers",
  write,
  route((req, actor) => createTrainer(actor, req.body || {})),
);
gymRouter.post("/trainers/avatar/upload", write, upload.single("file"), route((req, actor) => uploadTrainerAvatar(actor, req.file)));
gymRouter.patch("/trainers/:id", write, route((req, actor) => updateTrainer(actor, recordId(req.params.id), req.body || {})));
gymRouter.delete("/trainers/:id", write, route((req, actor) => deleteTrainer(actor, recordId(req.params.id))));
gymRouter.post(
  "/transfers",
  write,
  route((req, actor) => transfer(actor, req.body)),
);
gymRouter.post(
  "/transfers/batch",
  write,
  route((req, actor) => transferBatch(actor, req.body || {})),
);
gymRouter.post(
  "/transfers/request",
  write,
  route((req, actor) => requestTransfer(actor, req.body || {})),
);
gymRouter.patch(
  "/transfers/:id/:action",
  write,
  route((req, actor) => {
    const act = String(req.params.action);
    if (!["accept", "reject", "cancel", "approve"].includes(act)) {
      throw new ValidationError("VALIDATION_FAILED", "Thao tác điều chuyển không hợp lệ.");
    }
    return respondTransfer(
      actor,
      req.params.id,
      act as "accept" | "reject" | "cancel" | "approve",
    );
  }),
);
gymRouter.patch(
  "/roadmaps/:id/:action",
  write,
  route((req, actor) => {
    if (!["publish", "unpublish"].includes(String(req.params.action))) {
      throw new ValidationError("VALIDATION_FAILED", "Thao tác không hợp lệ.");
    }
    return publishRoadmap(
      actor,
      recordId(req.params.id),
      revision(req.body.revision),
      req.params.action === "publish",
    );
  }),
);
gymRouter.post(
  "/assign-plan",
  write,
  route((req, actor) =>
    assignPlan(
      actor,
      recordId(req.body.customerId),
      recordId(req.body.templateId),
    ),
  ),
);
gymRouter.post(
  "/progress-reports/generate",
  write,
  route((req, actor) => generateProgressReport(actor, req.body || {})),
);
gymRouter.patch(
  "/progress-reports/:id/:action",
  write,
  route((req, actor) => {
    if (!["publish", "unpublish"].includes(String(req.params.action)))
      throw new ValidationError("VALIDATION_FAILED", "Thao tác báo cáo không hợp lệ.");
    return publishProgressReport(actor, recordId(req.params.id), revision(req.body.revision), req.params.action === "publish");
  }),
);
gymRouter.post(
  "/sessions/photos/upload",
  write,
  upload.single("file"),
  route((req, actor) => uploadSessionPhoto(actor, recordId(req.body.customerId), req.file)),
);
gymRouter.post(
  "/measurements/scan",
  write,
  upload.array("file", 5),
  route((req, actor) =>
    scanInBody(
      actor,
      (req.files as Express.Multer.File[] | undefined) || (req.file ? [req.file] : []),
      req.body || {},
    ),
  ),
);
gymRouter.post(
  "/nutrition/analyze",
  write,
  route((req, actor) => analyzeNutrition(actor, req.body || {})),
);
gymRouter.post(
  "/nutrition/generate-plan",
  write,
  route((req, actor) => generateNutritionPlan(actor, req.body || {})),
);
gymRouter.post(
  "/workouts/generate-exercise",
  write,
  route((req, actor) => generateExercise(actor, req.body || {})),
);
gymRouter.post(
  "/exercises/bulk",
  write,
  route((req, actor) => saveExerciseBulk(actor, req.body || {})),
);
gymRouter.post(
  "/workouts/proposal",
  write,
  route((req, actor) => createWorkoutProposal(actor, req.body || {})),
);
gymRouter.post(
  "/workouts/generate-template",
  write,
  route((req, actor) => generateWorkoutTemplate(actor, req.body || {})),
);
gymRouter.post(
  "/roadmaps/generate",
  write,
  route((req, actor) => generateRoadmap(actor, req.body || {})),
);
gymRouter.post(
  "/food-images/upload",
  write,
  upload.single("file"),
  route((req, actor) => saveImage(actor, req.body, req.file)),
);
gymRouter.post(
  "/food-images/generate",
  write,
  route((req, actor) => saveImage(actor, req.body, undefined, true)),
);
gymRouter.post(
  "/food-images/:id/upload",
  write,
  upload.single("file"),
  route((req, actor) =>
    updateFoodImageWithUpload(actor, recordId(req.params.id), req.body, req.file),
  ),
);
gymRouter.post(
  "/food-images/:id/regenerate-ai",
  write,
  route((req, actor) =>
    regenerateFoodImageAi(actor, recordId(req.params.id), req.body?.prompt),
  ),
);
gymRouter.post(
  "/knowledge/upload",
  write,
  upload.array("file", 10),
  route(async (req, actor) => {
    const files = (req.files as Express.Multer.File[] | undefined) || (req.file ? [req.file] : []);
    if (!files.length) {
      throw new ValidationError("VALIDATION_FAILED", "Vui lòng chọn ít nhất 1 tài liệu để tải lên.");
    }
    const created = [];
    for (const f of files) {
      created.push(await uploadKnowledge(actor, f, req.body.topic));
    }
    return created.length === 1 ? created[0] : { count: created.length, data: created };
  }),
);
gymRouter.post(
  "/knowledge/seed-standard",
  write,
  route((_req, actor) => seedStandardKnowledge(actor)),
);
gymRouter.get("/knowledge/search", route((req, actor) => {
  const query = String(req.query.q || "").trim().slice(0, 300);
  if (!query) throw new ValidationError("VALIDATION_FAILED", "Nhập nội dung cần tìm trong kho tri thức.");
  return searchKnowledge(actor, query, Number(req.query.limit) || 5);
}));
gymRouter.patch(
  "/workout-plans/:id/:action",
  write,
  route((req, actor) => {
    if (!["publish", "unpublish"].includes(String(req.params.action)))
      throw new ValidationError("VALIDATION_FAILED", "Thao tác giáo án không hợp lệ.");
    return publishWorkoutPlan(actor, recordId(req.params.id), revision(req.body.revision), req.params.action === "publish");
  }),
);
gymRouter.patch(
  "/nutrition-plans/:id/:action",
  write,
  route((req, actor) => {
    if (!["publish", "unpublish"].includes(String(req.params.action)))
      throw new ValidationError("VALIDATION_FAILED", "Thao tác thực đơn không hợp lệ.");
    return publishNutritionPlan(actor, recordId(req.params.id), revision(req.body.revision), req.params.action === "publish");
  }),
);
gymRouter.patch(
  "/measurements/:id/:action",
  write,
  route((req, actor) => {
    if (!["publish", "unpublish"].includes(String(req.params.action)))
      throw new ValidationError("VALIDATION_FAILED", "Thao tác InBody không hợp lệ.");
    return publishMeasurement(actor, recordId(req.params.id), revision(req.body.revision), req.params.action === "publish");
  }),
);
gymRouter.patch(
  "/goals/:id/:action",
  write,
  route((req, actor) => {
    if (!["publish", "unpublish"].includes(String(req.params.action)))
      throw new ValidationError("VALIDATION_FAILED", "Thao tác mục tiêu không hợp lệ.");
    return publishGoal(actor, recordId(req.params.id), revision(req.body.revision), req.params.action === "publish");
  }),
);
gymRouter.patch(
  "/knowledge/:id/:action",
  write,
  route((req, actor) => {
    if (!["publish", "unpublish"].includes(String(req.params.action)))
      throw new ValidationError("VALIDATION_FAILED", "Thao tác không hợp lệ.");
    return publishKnowledge(
      actor,
      recordId(req.params.id),
      revision(req.body.revision),
      req.params.action === "publish",
    );
  }),
);
gymRouter.get("/muscle-groups", route((_req, actor) => listMuscleGroups(actor)));
gymRouter.post("/muscle-groups", write, route((req, actor) => createMuscleGroup(actor, req.body?.name)));
gymRouter.delete("/muscle-groups/:id", write, route((req, actor) => deleteMuscleGroup(actor, recordId(req.params.id))));
gymRouter.get(
  "/:entity",
  route((req, actor) =>
    listRecords(actor, entity(req.params.entity), req.query),
  ),
);
gymRouter.get(
  "/:entity/:id",
  route(async (req, actor) =>
    publicRecord(
      await getRecord(
        actor,
        entity(req.params.entity),
        recordId(req.params.id),
      ),
    ),
  ),
);
gymRouter.post(
  "/:entity",
  write,
  route((req, actor) => {
    const name = entity(req.params.entity);
    return saveRecord(actor, name, req.body);
  }),
);
gymRouter.patch(
  "/:entity/:id",
  write,
  route((req, actor) =>
    saveRecord(
      actor,
      entity(req.params.entity),
      req.body,
      recordId(req.params.id),
    ),
  ),
);
gymRouter.delete(
  "/:entity/:id",
  write,
  route(async (req, actor) => {
    await removeRecord(
      actor,
      entity(req.params.entity),
      recordId(req.params.id),
      revision(req.body.revision),
    );
    return { message: "Đã xóa dữ liệu." };
  }),
);
