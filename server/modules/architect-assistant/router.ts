import { randomUUID } from "node:crypto";
import { Router, type RequestHandler, type Response } from "express";
import Joi from "joi";
import mongoose from "mongoose";
import type { Db, Filter, OptionalUnlessRequiredId } from "mongodb";
import type { ArchitecturePlan, ArchitectureProject, ArchitectureVideoJob } from "../../../src/shared/architecture-assistant";
import { ForbiddenError, ConflictError, InternalError, NotFoundError, ValidationError } from "../../errors/app-error";
import { requirePermission, type AuthenticatedRequest } from "../../middleware/auth";
import { billAiCall, withAiUsage, aiSubscriptionService } from "../../service/ai-usage.service";
import { openrouterChat, openrouterGenerateImage } from "../../service/openrouter.service";
import { config } from "../quotation/config.js";
import { architectureScope, type ArchitectureActor } from "./scope";
import { deleteArchitectureAsset, downloadArchitectureImage, storeArchitectureImage, storeArchitectureVideo, type StoredArchitectureAsset } from "./storage";
import { downloadArchitectureVideo, getArchitectureVideoStatus, startArchitectureVideo } from "./openrouter-video.service";
import { ARCHITECT_ASSISTANT_MODELS } from "./models";

type StoredVideoJob = ArchitectureVideoJob & { providerJobId: string };
type StoredProject = Omit<ArchitectureProject, "renders" | "videoJobs"> & Pick<ArchitectureActor, "companyCode" | "branchId"> & { createdBy: string; updatedBy: string } & {
  renders: StoredArchitectureAsset[];
  videoJobs: StoredVideoJob[];
};

const indexes = new WeakMap<Db, Promise<void>>();

async function architectureDb(): Promise<Db> {
  const connectionDb = mongoose.connection.db;
  if (!connectionDb) throw new InternalError({ message: "Cơ sở dữ liệu ERP chưa sẵn sàng." });
  const db = connectionDb as unknown as Db;
  let ready = indexes.get(db);
  if (!ready) {
    ready = db.collection("architect_assistant_projects").createIndex(
      { companyCode: 1, branchId: 1, updatedAt: -1, _id: -1 },
    ).then(() => undefined).catch(error => {
      indexes.delete(db);
      throw error;
    });
    indexes.set(db, ready);
  }
  await ready;
  return db;
}

function projects(db: Db) {
  return db.collection<StoredProject>("architect_assistant_projects");
}

function scopeFilter(actor: ArchitectureActor) {
  return { companyCode: actor.companyCode, branchId: actor.branchId };
}

function publicProject(project: StoredProject): ArchitectureProject {
  const { companyCode: _companyCode, branchId: _branchId, createdBy: _createdBy, updatedBy: _updatedBy, ...visible } = project;
  return {
    ...visible,
    renders: (project.renders || []).map(({ storageAssetId: _storageAssetId, storageResourceType: _storageResourceType, ...asset }) => asset),
    videoJobs: (project.videoJobs || []).map(({ providerJobId: _providerJobId, ...job }) => job),
  };
}

function parseBody<T>(schema: Joi.ObjectSchema, value: unknown): T {
  const result = schema.validate(value, { abortEarly: true, convert: true, stripUnknown: false });
  if (result.error) throw new ValidationError("VALIDATION_FAILED", result.error.details[0]?.message || "Thông tin gửi lên không hợp lệ.");
  return result.value as T;
}

const createProjectSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  areaM2: Joi.number().min(20).max(20000).required(),
  floors: Joi.number().integer().min(1).max(12).required(),
  style: Joi.string().trim().min(2).max(100).required(),
  requirements: Joi.string().trim().max(3000).allow("").required(),
}).unknown(false);

const roomSchema = Joi.object({
  id: Joi.string().trim().min(1).max(80).required(),
  name: Joi.string().trim().min(1).max(80).required(),
  floor: Joi.number().integer().min(1).max(12).required(),
  x: Joi.number().min(0).max(100).required(),
  y: Joi.number().min(0).max(100).required(),
  width: Joi.number().greater(0).max(100).required(),
  height: Joi.number().greater(0).max(100).required(),
  areaM2: Joi.number().greater(0).max(20000).required(),
  style: Joi.string().trim().max(100),
  finishes: Joi.object({
    flooring: Joi.string().trim().max(80),
    walls: Joi.string().trim().max(80),
    ceiling: Joi.string().trim().max(80),
    doors: Joi.string().trim().max(80),
    windows: Joi.string().trim().max(80),
  }).unknown(false),
}).unknown(false);

const furnitureSchema = Joi.object({
  id: Joi.string().trim().min(1).max(80).required(),
  roomId: Joi.string().trim().min(1).max(80).required(),
  type: Joi.string().trim().min(1).max(50).required(),
  name: Joi.string().trim().min(1).max(80).required(),
  x: Joi.number().min(0).max(100).required(),
  y: Joi.number().min(0).max(100).required(),
  width: Joi.number().greater(0).max(100).required(),
  height: Joi.number().greater(0).max(100).required(),
  rotation: Joi.number().valid(0, 90, 180, 270).required(),
  style: Joi.string().trim().max(80),
  material: Joi.string().trim().max(80),
  color: Joi.string().pattern(/^#[0-9a-f]{6}$/i),
}).unknown(false);

const openingSchema = Joi.object({
  id: Joi.string().trim().min(1).max(80).required(),
  roomId: Joi.string().trim().min(1).max(80).required(),
  type: Joi.string().valid("door", "window").required(),
  wall: Joi.string().valid("north", "east", "south", "west").required(),
  offset: Joi.number().min(0).max(100).required(),
  width: Joi.number().greater(0).max(100).required(),
}).unknown(false);

const outlinePointSchema = Joi.object({
  x: Joi.number().min(0).max(100).required(),
  y: Joi.number().min(0).max(100).required(),
}).unknown(false);

const planSchema = Joi.object({
  rooms: Joi.array().items(roomSchema).min(1).max(40).required(),
  notes: Joi.string().max(1200).allow("").required(),
  furniture: Joi.array().items(furnitureSchema).max(400).default([]),
  openings: Joi.array().items(openingSchema).max(200).default([]),
  outline: Joi.array().items(outlinePointSchema).min(3).max(30),
}).unknown(false);

const generatePlanSchema = Joi.object({
  instructions: Joi.string().trim().max(1200).allow("").default(""),
  outline: Joi.array().items(outlinePointSchema).min(3).max(30),
}).unknown(false);

function pointInsideOutline(point: { x: number; y: number }, outline: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    const a = outline[index]; const b = outline[previous];
    const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
    if (Math.abs(cross) < 1e-7 && point.x >= Math.min(a.x, b.x) - 1e-7 && point.x <= Math.max(a.x, b.x) + 1e-7 && point.y >= Math.min(a.y, b.y) - 1e-7 && point.y <= Math.max(a.y, b.y) + 1e-7) return true;
    const crosses = (a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function roomFitsOutline(room: ArchitecturePlan["rooms"][number], outline: Array<{ x: number; y: number }>) {
  const corners = [
    { x: room.x, y: room.y }, { x: room.x + room.width, y: room.y },
    { x: room.x + room.width, y: room.y + room.height }, { x: room.x, y: room.y + room.height },
    { x: room.x + room.width / 2, y: room.y + room.height / 2 },
  ];
  if (corners.some(point => !pointInsideOutline(point, outline))) return false;
  return !outline.some(point => point.x > room.x + 0.01 && point.x < room.x + room.width - 0.01 && point.y > room.y + 0.01 && point.y < room.y + room.height - 0.01);
}

function roomsOverlap(left: ArchitecturePlan["rooms"][number], right: ArchitecturePlan["rooms"][number]) {
  return left.floor === right.floor && left.x < right.x + right.width - 0.01 && left.x + left.width > right.x + 0.01 && left.y < right.y + right.height - 0.01 && left.y + left.height > right.y + 0.01;
}

function parsePlan(value: unknown, floors = 12): ArchitecturePlan {
  const plan = parseBody<ArchitecturePlan>(planSchema, value);
  for (const [index, room] of plan.rooms.entries()) {
    if (room.floor > floors) throw new ValidationError("VALIDATION_FAILED", `Phòng “${room.name}” đang nằm ngoài số tầng của dự án.`);
    if (room.x + room.width > 100.01 || room.y + room.height > 100.01) {
      throw new ValidationError("VALIDATION_FAILED", "Một phòng nằm ngoài đường bao mặt bằng.");
    }
    if (plan.outline && !roomFitsOutline(room, plan.outline)) {
      throw new ValidationError("VALIDATION_FAILED", `Phòng “${room.name}” nằm ngoài hình dạng đường bao đã chọn.`);
    }
    if (plan.rooms.slice(0, index).some(previous => roomsOverlap(room, previous))) {
      throw new ValidationError("VALIDATION_FAILED", `Phòng “${room.name}” đang chồng lấn một phòng khác.`);
    }
  }
  const roomIds = new Set(plan.rooms.map(room => room.id));
  for (const furniture of plan.furniture || []) {
    if (!roomIds.has(furniture.roomId)) throw new ValidationError("VALIDATION_FAILED", "Đồ nội thất phải thuộc một phòng trong mặt bằng.");
    if (furniture.x + furniture.width > 100.01 || furniture.y + furniture.height > 100.01) {
      throw new ValidationError("VALIDATION_FAILED", "Đồ nội thất nằm ngoài phòng.");
    }
  }
  for (const opening of plan.openings || []) {
    if (!roomIds.has(opening.roomId)) throw new ValidationError("VALIDATION_FAILED", "Cửa và cửa sổ phải thuộc một phòng trong mặt bằng.");
  }
  return plan;
}

const updateProjectSchema = Joi.object({
  revision: Joi.number().integer().min(1).required(),
  name: Joi.string().trim().min(2).max(120),
  areaM2: Joi.number().min(20).max(20000),
  floors: Joi.number().integer().min(1).max(12),
  style: Joi.string().trim().min(2).max(100),
  requirements: Joi.string().trim().max(3000).allow(""),
  plan: planSchema.allow(null),
}).min(2).unknown(false);

const renderSchema = Joi.object({
  planImage: Joi.string().pattern(/^data:image\/png;base64,/i).max(5_000_000).required(),
  floor: Joi.number().integer().min(1).max(12).default(1),
  resolution: Joi.string().valid("1K", "2K", "4K").default("1K"),
  aspectRatio: Joi.string().valid("1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "1:4", "4:1", "1:8", "8:1", "21:9").default("4:3"),
  prompt: Joi.string().trim().max(1200).allow("").default(""),
}).unknown(false);

const imageToolSchema = Joi.object({
  kind: Joi.string().valid("render", "edit", "staging", "visual", "texture", "human", "enhance", "upscale", "sync", "canvas", "utilities").required(),
  prompt: Joi.string().trim().min(3).max(5000).required(),
  aspectRatio: Joi.string().valid("1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "1:4", "4:1", "1:8", "8:1", "21:9").default("4:3"),
  resolution: Joi.string().valid("1K", "2K", "4K").default("1K"),
  referenceImages: Joi.array().items(Joi.string().pattern(/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i).max(2_100_000)).max(10),
}).unknown(false);

const analyzeSyncSchema = Joi.object({
  image: Joi.string().pattern(/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i).max(2_100_000).required(),
  style: Joi.string().trim().max(100).allow("").default(""),
}).unknown(false);

const optimizePromptSchema = Joi.object({
  tool: Joi.string().valid("render", "edit", "staging", "visual", "texture", "human", "enhance", "upscale", "sync", "canvas", "utilities", "video").required(),
  prompt: Joi.string().trim().min(3).max(1200).required(),
  style: Joi.string().trim().max(100).allow("").default(""),
}).unknown(false);

const videoSchema = Joi.object({
  prompt: Joi.string().trim().min(3).max(1200).required(),
  aspectRatio: Joi.string().valid("16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3").default("16:9"),
  duration: Joi.number().integer().valid(4, 6, 8).default(4),
  resolution: Joi.string().valid("720p", "1080p").default("720p"),
  generateAudio: Joi.boolean().default(true),
  referenceImage: Joi.string().pattern(/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i).max(5_000_000),
}).unknown(false);

function publicVideoJob(job: StoredVideoJob): ArchitectureVideoJob {
  const { providerJobId: _providerJobId, ...visible } = job;
  return visible;
}

function route(handler: (request: AuthenticatedRequest, response: Response, db: Db, actor: ArchitectureActor) => Promise<void>): RequestHandler {
  return (request, response, next) => {
    const authenticated = request as AuthenticatedRequest;
    void (async () => {
      const actor = await architectureScope(authenticated);
      await handler(authenticated, response, await architectureDb(), actor);
    })().catch(next);
  };
}

async function findProject(db: Db, actor: ArchitectureActor, id: string) {
  const project = await projects(db).findOne({ _id: id, ...scopeFilter(actor) } as Filter<StoredProject>);
  if (!project) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy dự án kiến trúc trong chi nhánh hiện tại.");
  return project;
}

type ProjectChanges = Omit<Partial<Omit<ArchitectureProject, "renders">>, "videoJobs"> & {
  renders?: StoredArchitectureAsset[];
  videoJobs?: StoredVideoJob[];
};

async function updateProject(db: Db, actor: ArchitectureActor, current: StoredProject, revision: number, changes: ProjectChanges) {
  const result = await projects(db).updateOne(
    { _id: current._id, ...scopeFilter(actor), revision } as Filter<StoredProject>,
    { $set: { ...changes, updatedBy: actor.actorId, updatedAt: new Date().toISOString() }, $inc: { revision: 1 } },
  );
  if (!result.matchedCount) {
    if (!await projects(db).findOne({ _id: current._id, ...scopeFilter(actor) }, { projection: { _id: 1 } })) {
      throw new NotFoundError("RESOURCE_NOT_FOUND", "Dự án không còn tồn tại trong chi nhánh hiện tại.");
    }
    throw new ConflictError("RESOURCE_VERSION_CONFLICT", "Dự án đã được cập nhật ở nơi khác. Hãy tải lại trước khi lưu.");
  }
  return publicProject(await findProject(db, actor, current._id));
}

async function billAi<T>(actor: ArchitectureActor, kind: string, model: string, action: () => Promise<T>): Promise<T> {
  await aiSubscriptionService.available(actor.companyCode, 1, actor.actorId);
  return withAiUsage({ companyCode: actor.companyCode, userId: actor.actorId }, () => billAiCall(kind, model, action));
}

function parseGeneratedJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ValidationError("VALIDATION_FAILED", "AI chưa trả về sơ đồ phòng có thể dùng. Hãy thử tạo lại.");
  try { return JSON.parse(cleaned.slice(start, end + 1)) as unknown; }
  catch { throw new ValidationError("VALIDATION_FAILED", "AI trả về sơ đồ không đúng định dạng. Hãy thử tạo lại."); }
}

function assignRoomIds(plan: ArchitecturePlan): ArchitecturePlan {
  return { ...plan, rooms: plan.rooms.map(room => ({ ...room, id: randomUUID() })) };
}

export const architectAssistantRouter = Router();
architectAssistantRouter.use(requirePermission("architect-assistant:read") as RequestHandler);
architectAssistantRouter.use((_request, response, next) => { response.set("Cache-Control", "no-store"); next(); });

const manage = requirePermission("architect-assistant:manage") as RequestHandler;
const aiManage = requirePermission("architect-ai:manage") as RequestHandler;

architectAssistantRouter.get("/projects", route(async (_request, response, db, actor) => {
  const values = await projects(db).find(scopeFilter(actor)).sort({ updatedAt: -1, _id: -1 }).limit(100).toArray();
  response.json({ projects: values.map(publicProject) });
}));

architectAssistantRouter.post("/projects", manage, route(async (request, response, db, actor) => {
  const value = parseBody<Omit<ArchitectureProject, "_id" | "plan" | "renders" | "revision" | "createdAt" | "updatedAt">>(createProjectSchema, request.body);
  const now = new Date().toISOString();
  const project: StoredProject = {
    _id: randomUUID(), ...scopeFilter(actor), ...value, plan: null, renders: [], videoJobs: [], revision: 1,
    createdAt: now, updatedAt: now, createdBy: actor.actorId, updatedBy: actor.actorId,
  };
  await projects(db).insertOne(project as OptionalUnlessRequiredId<StoredProject>);
  response.status(201).json({ project: publicProject(project) });
}));

architectAssistantRouter.get("/projects/:projectId", route(async (request, response, db, actor) => {
  const project = await findProject(db, actor, request.params.projectId);
  response.json({ project: publicProject(project) });
}));

architectAssistantRouter.patch("/projects/:projectId", manage, route(async (request, response, db, actor) => {
  const value = parseBody<{ revision: number } & Omit<Partial<ArchitectureProject>, "videoJobs">>(updateProjectSchema, request.body);
  const project = await findProject(db, actor, request.params.projectId);
  const { revision, _id: _id, renders: _renders, createdAt: _createdAt, updatedAt: _updatedAt, ...changes } = value;
  const nextPlan = changes.plan ?? project.plan;
  if (nextPlan) {
    const checkedPlan = parsePlan(nextPlan, changes.floors ?? project.floors);
    if (changes.plan) changes.plan = checkedPlan;
  }
  response.json({ project: await updateProject(db, actor, project, revision, changes) });
}));

architectAssistantRouter.delete("/projects/:projectId", manage, route(async (request, response, db, actor) => {
  const revision = Number(request.query.revision);
  if (!Number.isInteger(revision) || revision < 1) throw new ValidationError("VALIDATION_FAILED", "Cần phiên bản dự án trước khi xóa.");
  const project = await findProject(db, actor, request.params.projectId);
  const result = await projects(db).deleteOne({ _id: project._id, ...scopeFilter(actor), revision } as Filter<StoredProject>);
  if (!result.deletedCount) throw new ConflictError("RESOURCE_VERSION_CONFLICT", "Dự án đã thay đổi. Tải lại trước khi xóa.");
  response.json({ success: true });
}));

architectAssistantRouter.post("/projects/:projectId/generate-plan", manage, aiManage, route(async (request, response, db, actor) => {
  const project = await findProject(db, actor, request.params.projectId);
  const value = parseBody<{ instructions: string; outline?: Array<{ x: number; y: number }> }>(generatePlanSchema, request.body);
  const outline = value.outline || project.plan?.outline;
  const model = ARCHITECT_ASSISTANT_MODELS.floorPlan;
  const generated = await billAi(actor, "architect.floorplan.generate", model, () => openrouterChat({
    model,
    allowFallback: false,
    temperature: 0.35,
    maxTokens: 2200,
    jsonMode: true,
    responseSchema: {
      type: "object", additionalProperties: false, required: ["rooms", "notes"],
      properties: {
        notes: { type: "string" },
        rooms: { type: "array", minItems: 3, maxItems: 14, items: {
          type: "object", additionalProperties: false,
          required: ["name", "floor", "x", "y", "width", "height", "areaM2"],
          properties: {
            name: { type: "string" }, floor: { type: "integer", minimum: 1, maximum: project.floors }, x: { type: "number", minimum: 0, maximum: 100 },
            y: { type: "number", minimum: 0, maximum: 100 }, width: { type: "number", exclusiveMinimum: 0, maximum: 100 },
            height: { type: "number", exclusiveMinimum: 0, maximum: 100 }, areaM2: { type: "number", exclusiveMinimum: 0 },
          },
        } },
      },
    },
    messages: [
      { role: "system", content: "Bạn là kiến trúc sư nhà ở. Trả lời bằng sơ đồ mặt bằng 2D nhìn từ trên xuống, chỉ JSON theo schema. Tọa độ x,y,width,height là phần trăm trong đường bao 100x100. Nếu người dùng cung cấp đa giác outline, tất cả phòng phải nằm trọn bên trong đa giác đó và tránh các vùng khuyết. Các phòng không chồng lấn, có lối giao thông nối với nhau; tổng diện tích phòng không vượt quá diện tích sàn. Bố trí khu sinh hoạt chung gần cửa vào, phòng ngủ riêng tư hơn, khu vệ sinh gần trục kỹ thuật. Giữ đúng số tầng, diện tích và yêu cầu người dùng; không thêm ghi chú pháp lý hoặc khẳng định bản vẽ thi công." },
      { role: "user", content: JSON.stringify({ name: project.name, areaM2: project.areaM2, floors: project.floors, style: project.style, requirements: project.requirements, instructions: value.instructions, outline }) },
    ],
  }));
  const parsed = parseGeneratedJson(generated.text) as { rooms?: unknown; notes?: unknown };
  const normalized = parsePlan({ rooms: Array.isArray(parsed.rooms) ? parsed.rooms.map(room => ({ ...(room as object), id: randomUUID() })) : [], notes: typeof parsed.notes === "string" ? parsed.notes : "", outline }, project.floors);
  response.json({ project: await updateProject(db, actor, project, project.revision, { plan: normalized }) });
}));

architectAssistantRouter.post("/projects/:projectId/render", manage, aiManage, route(async (request, response, db, actor) => {
  const project = await findProject(db, actor, request.params.projectId);
  const value = parseBody<{ planImage: string; aspectRatio: string; resolution: string; prompt: string; floor: number }>(renderSchema, request.body);
  if (value.floor > project.floors) throw new ValidationError("VALIDATION_FAILED", "Tầng phối cảnh nằm ngoài số tầng của dự án.");
  if (!project.plan?.rooms.some(room => room.floor === value.floor)) throw new ConflictError("CONFLICT", "Hãy tạo hoặc lưu mặt bằng cho tầng này trước khi tạo phối cảnh.");
  if (!config.cloudinaryConfigured) throw new ConflictError("CONFLICT", "ERP chưa cấu hình kho ảnh Cloudinary để lưu phối cảnh.");
  const model = ARCHITECT_ASSISTANT_MODELS.render;
  const image = await billAi(actor, "architect.render.generate", model, () => openrouterGenerateImage({
    model,
    exactModel: true,
    useImagesApi: true,
    aspectRatio: value.aspectRatio,
    resolution: value.resolution,
    allowFallback: false,
    referenceImages: [value.planImage],
    prompt: [
      "Create one photorealistic architectural interior cutaway rendering based on the supplied 2D floor plan.",
      "Preserve the room count, room positions, wall boundaries, doors and circulation from the reference exactly.",
      `Project style: ${project.style}. Floors: ${project.floors}. Render floor ${value.floor}. Floor area: ${project.areaM2} square meters.`,
      project.requirements ? `Requirements: ${project.requirements}` : "",
      value.prompt,
      "Do not add labels, dimensions, text, watermarks or additional rooms.",
    ].filter(Boolean).join("\n"),
  }));
  const asset = await storeArchitectureImage(image.url, actor, model, "render", value.prompt, value.resolution as ArchitectureProject["renders"][number]["resolution"]);
  const updated = await updateProject(db, actor, project, project.revision, { renders: [...(project.renders || []), asset].slice(-60) });
  response.status(201).json({ project: updated, render: updated.renders[updated.renders.length - 1] });
}));

architectAssistantRouter.post("/projects/:projectId/generate-image", manage, aiManage, route(async (request, response, db, actor) => {
  const project = await findProject(db, actor, request.params.projectId);
  const value = parseBody<{ kind: NonNullable<ArchitectureProject["renders"][number]["kind"]>; prompt: string; aspectRatio: string; resolution: string; referenceImages?: string[] }>(imageToolSchema, request.body);
  if ((value.referenceImages || []).reduce((total, image) => total + image.length, 0) > 21_000_000) {
    throw new ValidationError("VALIDATION_FAILED", "Tổng dung lượng ảnh tham chiếu vượt quá giới hạn. Hãy chọn tối đa 10 ảnh đã thu nhỏ.");
  }
  if (!config.cloudinaryConfigured) throw new ConflictError("CONFLICT", "ERP chÆ°a cáº¥u hÃ¬nh kho áº£nh Cloudinary Ä‘á»ƒ lÆ°u áº£nh.");
  const model = ARCHITECT_ASSISTANT_MODELS.render;
  const image = await billAi(actor, `architect.${value.kind}.generate`, model, () => openrouterGenerateImage({
    model,
    exactModel: true,
    useImagesApi: true,
    allowFallback: false,
    aspectRatio: value.aspectRatio,
    resolution: value.resolution,
    referenceImages: value.referenceImages,
    prompt: [
      `Create one high-quality architecture design image for the ${value.kind} workflow.`,
      `Project style: ${project.style}. Floor area: ${project.areaM2} square meters. Floors: ${project.floors}.`,
      project.requirements ? `Project requirements: ${project.requirements}` : "",
      value.prompt,
      "Keep the result realistic and useful for an architectural presentation. Do not add labels, dimensions, logos, watermarks, or unrelated objects.",
    ].filter(Boolean).join("\n"),
  }));
  const asset = await storeArchitectureImage(image.url, actor, model, value.kind, value.prompt, value.resolution as ArchitectureProject["renders"][number]["resolution"]);
  const updated = await updateProject(db, actor, project, project.revision, { renders: [...(project.renders || []), asset].slice(-60) });
  response.status(201).json({ project: updated, asset: updated.renders[updated.renders.length - 1] });
}));

architectAssistantRouter.post("/projects/:projectId/analyze-sync", manage, aiManage, route(async (request, response, db, actor) => {
  const project = await findProject(db, actor, request.params.projectId);
  const value = parseBody<{ image: string; style: string }>(analyzeSyncSchema, request.body);
  const model = ARCHITECT_ASSISTANT_MODELS.vision;
  const analysis = await billAi(actor, "architect.sync.analyze", model, () => openrouterChat({
    model,
    allowFallback: false,
    temperature: 0.35,
    maxTokens: 1600,
    jsonMode: true,
    responseSchema: {
      type: "object", additionalProperties: false, required: ["categories"],
      properties: { categories: { type: "array", minItems: 3, maxItems: 5, items: {
        type: "object", additionalProperties: false, required: ["name", "suggestions"],
        properties: { name: { type: "string" }, suggestions: { type: "array", minItems: 2, maxItems: 4, items: {
          type: "object", additionalProperties: false, required: ["title", "text"],
          properties: { title: { type: "string" }, text: { type: "string" } },
        } } },
      } } },
    },
    messages: [
      { role: "system", content: "Bạn là chuyên gia phân tích ảnh kiến trúc. Phân tích ảnh công trình người dùng gửi, sau đó đề xuất góc nhìn và cách khai thác ảnh theo 3 đến 5 nhóm như phối cảnh ngoại thất, không gian nội thất, chi tiết vật liệu, ánh sáng và bối cảnh. Mỗi nhóm có 2 đến 4 phương án. Tiêu đề ngắn, prompt tiếng Việt cụ thể, giữ nhận diện công trình, hình khối, bảng màu và vật liệu trong ảnh. Chỉ trả JSON theo schema; không tự khẳng định chi tiết không nhìn thấy." },
      { role: "user", content: [
        { type: "text", text: JSON.stringify({ project: project.name, style: value.style || project.style, areaM2: project.areaM2, floors: project.floors, task: "Phân tích ảnh và tạo các lựa chọn prompt cho những ảnh đồng bộ tiếp theo." }) },
        { type: "image_url", image_url: { url: value.image } },
      ] },
    ],
  }));
  const parsed = parseGeneratedJson(analysis.text) as { categories?: unknown };
  const categories = Array.isArray(parsed.categories) ? parsed.categories.slice(0, 5).flatMap((category, categoryIndex) => {
    if (!category || typeof category !== "object") return [];
    const item = category as { name?: unknown; suggestions?: unknown };
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 100) : "";
    const suggestions = Array.isArray(item.suggestions) ? item.suggestions.slice(0, 4).flatMap((suggestion, suggestionIndex) => {
      if (!suggestion || typeof suggestion !== "object") return [];
      const entry = suggestion as { title?: unknown; text?: unknown };
      const title = typeof entry.title === "string" ? entry.title.trim().slice(0, 100) : "";
      const text = typeof entry.text === "string" ? entry.text.trim().slice(0, 1200) : "";
      return title && text ? [{ id: `${categoryIndex}-${suggestionIndex}`, title, text }] : [];
    }) : [];
    return name && suggestions.length ? [{ name, suggestions }] : [];
  }) : [];
  if (categories.length < 3) throw new ValidationError("VALIDATION_FAILED", "AI chưa tạo đủ nhóm gợi ý đồng bộ. Hãy thử phân tích lại.");
  response.json({ categories });
}));

architectAssistantRouter.post("/projects/:projectId/optimize-prompt", manage, aiManage, route(async (request, response, db, actor) => {
  await findProject(db, actor, request.params.projectId);
  const value = parseBody<{ tool: string; prompt: string; style: string }>(optimizePromptSchema, request.body);
  const model = ARCHITECT_ASSISTANT_MODELS.floorPlan;
  const optimized = await billAi(actor, `architect.${value.tool}.prompt`, model, () => openrouterChat({
    model,
    allowFallback: false,
    temperature: 0.4,
    maxTokens: 400,
    messages: [
      { role: "system", content: "Bạn là chuyên gia viết prompt kiến trúc. Hãy viết lại prompt thành một chỉ dẫn hình ảnh rõ ràng, súc tích, nêu góc máy, ánh sáng, vật liệu và yêu cầu giữ nguyên bố cục khi có ảnh tham chiếu. Chỉ trả về prompt đã tối ưu bằng tiếng Việt, không giải thích, không thêm dấu ngoặc kép." },
      { role: "user", content: JSON.stringify({ tool: value.tool, style: value.style, prompt: value.prompt }) },
    ],
  }));
  response.json({ prompt: optimized.text.trim().slice(0, 1200) });
}));

architectAssistantRouter.post("/projects/:projectId/videos", manage, aiManage, route(async (request, response, db, actor) => {
  const project = await findProject(db, actor, request.params.projectId);
  const value = parseBody<{ prompt: string; aspectRatio: string; duration: number; resolution: string; generateAudio: boolean; referenceImage?: string }>(videoSchema, request.body);
  const model = ARCHITECT_ASSISTANT_MODELS.video;
  const started = await billAi(actor, "architect.video.generate", model, () => startArchitectureVideo({
    model,
    prompt: value.prompt,
    aspectRatio: value.aspectRatio,
    duration: value.duration,
    resolution: value.resolution,
    generateAudio: value.generateAudio,
    referenceImage: value.referenceImage,
  }));
  const job: StoredVideoJob = {
    id: randomUUID(),
    providerJobId: started.id,
    status: started.status === "in_progress" ? "in_progress" : "pending",
    prompt: value.prompt,
    createdAt: new Date().toISOString(),
  };
  const updated = await updateProject(db, actor, project, project.revision, { videoJobs: [...(project.videoJobs || []), job].slice(-20) });
  response.status(202).json({ project: updated, job: publicVideoJob(job) });
}));

architectAssistantRouter.get("/projects/:projectId/videos/:jobId", route(async (request, response, db, actor) => {
  const project = await findProject(db, actor, request.params.projectId);
  const job = (project.videoJobs || []).find(item => item.id === request.params.jobId);
  if (!job) throw new NotFoundError("RESOURCE_NOT_FOUND", "KhÃ´ng tÃ¬m tháº¥y tÃ¡c vá»¥ video trong dá»± Ã¡n hiá»‡n táº¡i.");
  if (job.status === "completed" || job.status === "failed") {
    response.json({ job: publicVideoJob(job), project: publicProject(project) });
    return;
  }
  const provider = await getArchitectureVideoStatus(job.providerJobId);
  if (provider.status === "failed") {
    const failed: StoredVideoJob = { ...job, status: "failed", error: (provider.error || "OpenRouter không tạo được video.").slice(0, 500) };
    const updated = await updateProject(db, actor, project, project.revision, { videoJobs: (project.videoJobs || []).map(item => item.id === job.id ? failed : item) });
    response.json({ job: publicVideoJob(failed), project: updated });
    return;
  }
  if (provider.status !== "completed" || !provider.contentUrl) {
    const status = provider.status === "in_progress" ? "in_progress" : "pending";
    response.json({ job: publicVideoJob({ ...job, status }), project: publicProject(project) });
    return;
  }
  if (!config.cloudinaryConfigured) throw new ConflictError("CONFLICT", "ERP chÆ°a cáº¥u hÃ¬nh kho lÆ°u video Cloudinary.");
  const bytes = await downloadArchitectureVideo(provider.contentUrl);
  const asset = await storeArchitectureVideo(bytes, actor, ARCHITECT_ASSISTANT_MODELS.video, job.prompt);
  const completed: StoredVideoJob = { ...job, status: "completed", assetId: asset.id };
  const updated = await updateProject(db, actor, project, project.revision, {
    renders: [...(project.renders || []), asset].slice(-60),
    videoJobs: (project.videoJobs || []).map(item => item.id === job.id ? completed : item),
  });
  response.json({ job: publicVideoJob(completed), project: updated });
}));

architectAssistantRouter.get("/projects/:projectId/assets/:assetId", route(async (request, response, db, actor) => {
  const project = await findProject(db, actor, request.params.projectId);
  const asset = project.renders.find(item => item.id === request.params.assetId);
  if (!asset) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy ảnh phối cảnh trong dự án hiện tại.");
  const bytes = await downloadArchitectureImage(asset);
  response.set({ "Cache-Control": "private, no-store", "Content-Type": asset.mimeType, "Content-Length": String(bytes.length) });
  response.send(bytes);
}));

architectAssistantRouter.delete("/projects/:projectId/assets/:assetId", manage, route(async (request, response, db, actor) => {
  const project = await findProject(db, actor, request.params.projectId);
  const asset = project.renders.find(item => item.id === request.params.assetId);
  if (!asset) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy kết quả trong thư viện dự án.");
  const updated = await updateProject(db, actor, project, project.revision, {
    renders: project.renders.filter(item => item.id !== asset.id),
  });
  let storageDeleted = false;
  try { storageDeleted = await deleteArchitectureAsset(asset); } catch { /* the project no longer exposes the asset; report storage cleanup status */ }
  response.json({ project: updated, storageDeleted });
}));
