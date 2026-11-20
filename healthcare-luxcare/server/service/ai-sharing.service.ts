import { createHash } from "node:crypto";
import { UserModel } from "../model/user.model";
import { mapModelName } from "./openrouter.service";
import { aiSharingContext } from "./ai-sharing-context";
import type { AiSharingDisclosure, AiSharingDisclosurePreview, AiSharingScope, AiSharingRecipient } from "../../shared/ai-sharing";

// Increment when the wording or data categories of the disclosure change.
type ProviderMetadata = { name: string; slug: string; privacy_policy_url: string };
const VERSION = "2026-10-21.2";
const PRIVACY_URL = "https://luxcare.igentechnology.net/privacy-policy";
type Policy = { model: string; providers: string[]; recipients: AiSharingRecipient[] };
const cache = new Map<string, { until: number; promise: Promise<Policy> }>();
export class AiSharingError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);
  }
}
export const assistantSharingModel = () =>
  mapModelName(process.env.CHATBOT_MODEL?.trim() || process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash");
async function metadata(path: string) {
  const response = await fetch(`https://openrouter.ai/api/v1/${path}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("AI provider metadata unavailable");
  return (await response.json()).data;
}
async function modelPolicy(model: string): Promise<Policy> {
  const previous = cache.get(model);
  if (previous && previous.until > Date.now()) return previous.promise;
  const promise = (async () => {
    try {
      const [details, catalog] = await Promise.all([
        metadata(`models/${model.split("/").map(encodeURIComponent).join("/")}/endpoints`),
        metadata("providers"),
      ]);
      if (!Array.isArray(details?.endpoints) || !Array.isArray(catalog)) throw new Error("Invalid AI metadata");
      const allowed = new Map<string, AiSharingRecipient>();
      for (const endpoint of details.endpoints) {
        const provider = (catalog as ProviderMetadata[]).find(
          (item) =>
            item.name === endpoint.provider_name &&
            (endpoint.tag === item.slug || String(endpoint.tag).startsWith(`${item.slug}/`)),
        );
        if (!provider || !/^[a-z0-9-]+$/.test(provider.slug)) continue;
        // Keep routing limited to eligible OpenRouter endpoints; OpenRouter is the disclosed AI service.
        try {
          if (new URL(provider.privacy_policy_url).protocol !== "https:") continue;
        } catch {
          continue;
        }
        allowed.set(provider.slug, { name: provider.name, privacyUrl: provider.privacy_policy_url });
      }
      if (!allowed.size) throw new Error("No eligible OpenRouter model endpoint available");
      const providers = [...allowed.keys()].sort();
      return {
        model,
        providers,
        // LuxCare's configured AI service is OpenRouter. Its DPA and subprocessor terms govern model routing.
        recipients: [{ name: "OpenRouter", privacyUrl: "https://openrouter.ai/privacy" }],
      };
    } catch {
      cache.delete(model);
      throw new AiSharingError(
        "Chưa thể tải thông tin bên xử lý AI. Vui lòng thử lại sau.",
        503,
        "AI_DISCLOSURE_UNAVAILABLE",
      );
    }
  })();
  cache.set(model, { until: Date.now() + 5 * 60_000, promise });
  return promise;
}
async function processingPolicy(scope: AiSharingScope) {
  const model = assistantSharingModel();
  const models = new Set([model]);
  if (scope === "company") {
    if (process.env.KNOWLEDGE_EMBEDDING_MODEL?.trim()) models.add(process.env.KNOWLEDGE_EMBEDDING_MODEL.trim());
    if (process.env.KNOWLEDGE_RERANK_ENABLED === "true")
      models.add(
        mapModelName(
          process.env.KNOWLEDGE_RERANK_MODEL?.trim() || process.env.CHATBOT_MODEL?.trim() || "google/gemini-2.5-flash",
        ),
      );
    models.add(mapModelName(process.env.KNOWLEDGE_PDF_OCR_MODEL?.trim() || "google/gemini-2.5-flash"));
  }
  const policies = await Promise.all([...models].sort().map(modelPolicy));
  const recipients = new Map(
    policies.flatMap((policy) => policy.recipients.map((item) => [item.name + item.privacyUrl, item] as const)),
  );
  return {
    model,
    providers: policies.find((policy) => policy.model === model)!.providers,
    routes: Object.fromEntries(policies.map((policy) => [policy.model, policy.providers])),
    recipients: [...recipients.values()],
  };
}
async function userForConsent(userId: string) {
  const user = await UserModel.findOne({ _id: userId, disabledAt: null })
    .select("+aiSharingConsent companyCode")
    .lean();
  if (!user) throw new AiSharingError("Tài khoản không khả dụng.", 403, "AI_ACCOUNT_UNAVAILABLE");
  return user;
}
function disclosureFor(
  user: Awaited<ReturnType<typeof userForConsent>>,
  scope: AiSharingScope,
  policy: Awaited<ReturnType<typeof processingPolicy>>,
): AiSharingDisclosure {
  const companyCode = scope === "company" ? user.companyCode || "SYSTEM" : "";
  const disclosureKey = createHash("sha256")
    .update(JSON.stringify({ version: VERSION, userId: String(user._id), scope, companyCode, ...policy }))
    .digest("hex");
  const grant = user.aiSharingConsent?.[scope];
  const accepted = grant?.disclosureKey === disclosureKey && Boolean(grant.acceptedAt);
  return {
    scope,
    version: VERSION,
    disclosureKey,
    model: policy.model,
    recipients: policy.recipients,
    dataTypes:
      scope === "personal"
        ? ["Prompt text you enter / Nội dung câu hỏi bạn nhập."]
        : [
            "Your question and recent assistant messages / Câu hỏi và tin nhắn gần đây với trợ lý.",
            "Relevant company document or work-record excerpts you can access / Đoạn tài liệu hoặc dữ liệu công việc bạn được phép xem.",
            "For legal comparisons, relevant text from the selected draft and source document / Khi đối chiếu pháp lý, phần liên quan trong dự thảo và văn bản gốc.",
            "For Knowledge uploads, document text and pages or images needing OCR / Khi tải lên Kho tri thức, văn bản và trang hoặc ảnh cần OCR.",
          ],
    purpose:
      scope === "personal"
        ? "Generate an AI response to your prompt. / Tạo câu trả lời AI từ nội dung bạn nhập."
        : "Answer questions, search Knowledge documents, and compare selected legal text when requested. / Trả lời câu hỏi, tìm tài liệu Kho tri thức và đối chiếu văn bản pháp lý khi bạn yêu cầu.",
    processingSafeguards:
      "OpenRouter is LuxCare's only configured AI service. It processes requests under LuxCare's Data Processing Agreement and its subprocessor terms, and may route them to model endpoints to provide the requested result. Requests are restricted to eligible endpoints with zero data retention and data collection denied; fallback is disabled and requests fail if no eligible endpoint is available. OpenRouter's subprocessor protections are required to be at least equivalent to the safeguards described in this Privacy Policy. / OpenRouter là dịch vụ AI duy nhất LuxCare cấu hình. OpenRouter xử lý yêu cầu theo Thỏa thuận xử lý dữ liệu với LuxCare và các điều khoản dành cho bên xử lý phụ; dịch vụ có thể định tuyến yêu cầu đến endpoint model để tạo kết quả. Yêu cầu chỉ được gửi đến endpoint phù hợp có chính sách không lưu giữ dữ liệu và từ chối thu thập dữ liệu; tính năng chuyển dự phòng bị tắt và yêu cầu sẽ lỗi nếu không có endpoint phù hợp. Các biện pháp bảo vệ dành cho bên xử lý phụ của OpenRouter phải tương đương ít nhất với các biện pháp trong Chính sách bảo mật này.",
    privacyUrl: PRIVACY_URL,
    accepted,
    acceptedAt: accepted ? new Date(grant.acceptedAt).toISOString() : null,
  };
}
export async function aiSharingDisclosure(userId: string, scope: AiSharingScope) {
  const [user, policy] = await Promise.all([userForConsent(userId), processingPolicy(scope)]);
  return disclosureFor(user, scope, policy);
}
export async function aiSharingDisclosurePreview(scope: AiSharingScope): Promise<AiSharingDisclosurePreview> {
  const policy = await processingPolicy(scope);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ version: VERSION, scope, ...policy }))
    .digest("hex");
  return {
    fingerprint,
    model: policy.model,
    recipients: policy.recipients,
    dataTypes: scope === "personal"
      ? ["Prompt text you enter / Nội dung câu hỏi bạn nhập."]
      : [
          "Your question, recent assistant messages, and authorized work-record excerpts / Câu hỏi, tin nhắn gần đây và trích đoạn dữ liệu công việc được phép xem.",
          "Knowledge uploads: document text and pages or images needing OCR / Tài liệu Kho tri thức: văn bản và trang hoặc ảnh cần OCR.",
          "Legal comparison: relevant text from the selected draft and source document / Đối chiếu pháp lý: phần liên quan trong dự thảo và văn bản gốc.",
        ],
    purpose:
      scope === "personal"
        ? "Generate an AI response to your prompt. / Tạo câu trả lời AI từ nội dung bạn nhập."
        : "Answer questions, search Knowledge documents, and compare selected legal text when requested. / Trả lời câu hỏi, tìm tài liệu Kho tri thức và đối chiếu văn bản pháp lý khi bạn yêu cầu.",
    processingSafeguards:
      "OpenRouter is LuxCare's only configured AI service. It processes requests under LuxCare's Data Processing Agreement and its subprocessor terms, and may route them to model endpoints to provide the requested result. Requests are restricted to eligible endpoints with zero data retention and data collection denied; fallback is disabled and requests fail if no eligible endpoint is available. OpenRouter's subprocessor protections are required to be at least equivalent to the safeguards described in this Privacy Policy. / OpenRouter là dịch vụ AI duy nhất LuxCare cấu hình. OpenRouter xử lý yêu cầu theo Thỏa thuận xử lý dữ liệu với LuxCare và các điều khoản dành cho bên xử lý phụ; dịch vụ có thể định tuyến yêu cầu đến endpoint model để tạo kết quả. Yêu cầu chỉ được gửi đến endpoint phù hợp có chính sách không lưu giữ dữ liệu và từ chối thu thập dữ liệu; tính năng chuyển dự phòng bị tắt và yêu cầu sẽ lỗi nếu không có endpoint phù hợp. Các biện pháp bảo vệ dành cho bên xử lý phụ của OpenRouter phải tương đương ít nhất với các biện pháp trong Chính sách bảo mật này.",
    privacyUrl: PRIVACY_URL,
  };
}
export async function initialPersonalAiSharingConsent(userId: string, expectedFingerprint?: string) {
  const policy = await processingPolicy("personal");
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ version: VERSION, scope: "personal", ...policy }))
    .digest("hex");
  if (expectedFingerprint && fingerprint !== expectedFingerprint) return null;
  const disclosureKey = createHash("sha256")
    .update(JSON.stringify({ version: VERSION, userId: String(userId), scope: "personal", companyCode: "", ...policy }))
    .digest("hex");
  return { disclosureKey, acceptedAt: new Date() };
}
export async function updateAiSharingConsent(userId: string, scope: AiSharingScope, accepted: boolean, key?: string) {
  if (!accepted) {
    await UserModel.updateOne({ _id: userId, disabledAt: null }, { $unset: { [`aiSharingConsent.${scope}`]: "" } });
    return { accepted: false };
  }
  const [user, policy] = await Promise.all([userForConsent(userId), processingPolicy(scope)]);
  const disclosure = disclosureFor(user, scope, policy);
  if (key !== disclosure.disclosureKey)
    throw new AiSharingError("Thông tin xử lý AI đã thay đổi. Hãy đọc và xác nhận lại.", 409, "AI_DISCLOSURE_CHANGED");
  const result = await UserModel.updateOne(
    { _id: userId, disabledAt: null, companyCode: user.companyCode ?? null },
    { $set: { [`aiSharingConsent.${scope}`]: { disclosureKey: key, acceptedAt: new Date() } } },
  );
  if (!result.matchedCount)
    throw new AiSharingError("Tài khoản đã thay đổi. Hãy tải lại thông tin.", 409, "AI_DISCLOSURE_CHANGED");
  return aiSharingDisclosure(userId, scope);
}
export async function assertAiSharingConsent(userId: string, scope: AiSharingScope) {
  const [user, policy] = await Promise.all([userForConsent(userId), processingPolicy(scope)]);
  if (!disclosureFor(user, scope, policy).accepted)
    throw new AiSharingError(
      "Bạn cần đồng ý chia sẻ dữ liệu với bên xử lý AI trước khi sử dụng trợ lý.",
      403,
      "AI_CONSENT_REQUIRED",
    );
  return { ...policy, companyCode: user.companyCode || "SYSTEM" };
}
export async function withAiSharingPermission<T>(
  userId: string,
  scope: AiSharingScope,
  work: () => Promise<T>,
): Promise<T> {
  const policy = await assertAiSharingConsent(userId, scope);
  return aiSharingContext.run(policy, work);
}
