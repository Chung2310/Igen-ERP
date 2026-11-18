import { Router, type Request, type Response, type NextFunction } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { requirePermission, type AuthenticatedRequest } from "../../../../middleware/auth";
import { ChatTestSessionModel, ChatTestMessageModel } from "../model/chat-test.model";
import { MAX_CHAT_IMAGE_BYTES } from "../service/chat-visual-context";
import { CHAT_TEST_MAX_IMAGES } from "../../../../../shared/marketing-suite/chat-test";
import { prepareChatTestUploads } from "../service/chat-test-images";
import {
  addChatTestMessage, chatTestError, createChatTestSession, deleteChatTestSession,
  publicChatTestSession, readChatTestSession, readChatTestState, retryChatTestMessage,
  saveChatTestConfig, readChatTestOcrConfig, saveChatTestOcrConfig, previewChatTestReply,
  createChatTestLead,
} from "../service/chat-test.service";

export const chatTestRouter = Router();
chatTestRouter.use(requirePermission("omni-inbox:manage"));
function run(handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => { void handler(req as AuthenticatedRequest, res).catch(next); };
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CHAT_IMAGE_BYTES, files: CHAT_TEST_MAX_IMAGES, fields: 2, fieldSize: 20_000 },
}).array("image", CHAT_TEST_MAX_IMAGES);

chatTestRouter.get("/", run(async (req, res) => {
  const sessions = await ChatTestSessionModel.find({ companyCode: req.user!.companyCode, userId: req.user!.id,
    directLeadWrites: true, archived: { $ne: true } })
    .select("-aiConfig").sort({ createdAt: -1 }).limit(20).lean();
  return res.json({ status: "success", data: sessions.map(publicChatTestSession) });
}));

chatTestRouter.post("/", run(async (req, res) => {
  const session = await createChatTestSession(req.user!.companyCode, req.user!.id, req.body || {});
  return res.status(201).json({ status: "success", data: session });
}));

chatTestRouter.get("/:id", run(async (req, res) =>
  res.json({ status: "success", data: await readChatTestState(req.user!.companyCode, req.user!.id, req.params.id) })));

chatTestRouter.patch("/:id/config", run(async (req, res) =>
  res.json({ status: "success", data: await saveChatTestConfig(req.user!.companyCode, req.user!.id, req.params.id, req.body?.aiConfig) })));
chatTestRouter.post("/:id/lead", run(async (req, res) =>
  res.json({ status: "success", data: await createChatTestLead(req.user!.companyCode, req.user!.id, req.params.id) })));
chatTestRouter.get("/:id/ocr-config", run(async (req, res) =>
  res.json({ status: "success", data: await readChatTestOcrConfig(req.user!.companyCode, req.user!.id, req.params.id) })));
chatTestRouter.put("/:id/ocr-config", run(async (req, res) =>
  res.json({ status: "success", data: await saveChatTestOcrConfig(req.user!.companyCode, req.user!.id, req.params.id, req.body || {}) })));
chatTestRouter.post("/:id/preview", run(async (req, res) => {
  const { message = "", images = [] } = req.body || {};
  if (typeof message !== "string" || message.length > 5000 || !Array.isArray(images) || images.length > 3
    || images.some(image => typeof image !== "string" || image.length > 12 * 1024 * 1024)) throw chatTestError("Nội dung thử chưa hợp lệ.");
  return res.json({ status: "success", data: await previewChatTestReply(req.user!.companyCode, req.user!.id, req.params.id, message, images) });
}));

chatTestRouter.post("/:id/messages", (req, res, next) => {
  void readChatTestSession((req as AuthenticatedRequest).user!.companyCode, (req as AuthenticatedRequest).user!.id, req.params.id)
    .then(() => upload(req, res, error => error
      ? res.status(400).json({ status: "error", message: "Mỗi lượt tối đa 3 ảnh JPEG, PNG, WebP hoặc GIF, tổng dung lượng tối đa 8 MB." })
      : next())).catch(next);
}, run(async (req, res) => {
  const { text = "", clientMessageId } = req.body || {};
  const files = Array.isArray(req.files) ? req.files : [];
  if (typeof text !== "string" || text.length > 5000
    || typeof clientMessageId !== "string" || !/^[A-Za-z0-9_-]{12,80}$/.test(clientMessageId)
    || (!text.trim() && !files.length)) {
    throw chatTestError("Nhập tin nhắn tối đa 5.000 ký tự hoặc chọn ảnh để gửi.");
  }
  const imageFiles = await prepareChatTestUploads(files);
  const id = await addChatTestMessage({
    companyCode: req.user!.companyCode, userId: req.user!.id, sessionId: req.params.id,
    clientMessageId, text: text.trim(), imageFiles,
  });
  return res.status(202).json({ status: "success", data: { id } });
}));

chatTestRouter.post("/:id/messages/:messageId/retry", run(async (req, res) => {
  await retryChatTestMessage(req.user!.companyCode, req.user!.id, req.params.id, req.params.messageId);
  return res.status(202).json({ status: "success" });
}));

chatTestRouter.get("/:id/messages/:messageId/image", run(async (req, res) => {
  const session = await readChatTestSession(req.user!.companyCode, req.user!.id, req.params.id);
  if (!mongoose.isValidObjectId(req.params.messageId)) throw chatTestError("Ảnh không hợp lệ.");
  const index = req.query.index === undefined ? 0 : typeof req.query.index === "string" && /^[0-2]$/.test(req.query.index) ? Number(req.query.index) : -1;
  if (index < 0) throw chatTestError("Vị trí ảnh không hợp lệ.");
  const message = await ChatTestMessageModel.findOne({ _id: req.params.messageId, sessionId: session._id }).select("+imageData +imageFiles").lean();
  const data = message?.imageFiles?.[index]?.data || (index === 0 ? message?.imageData : undefined);
  if (!data) throw chatTestError("Không tìm thấy ảnh.", 404);
  const [header, base64] = data.split(",");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.type(header.slice(5, header.indexOf(";"))).send(Buffer.from(base64, "base64"));
}));

chatTestRouter.delete("/:id", run(async (req, res) => {
  await deleteChatTestSession(req.user!.companyCode, req.user!.id, req.params.id);
  return res.json({ status: "success" });
}));
