import type { AuthenticatedRequest } from "../middleware/auth";
import { AssistantError } from "./policy";
import { AssistantSessionModel } from "./models";
import { actorScope } from "./workflows";

const ANSWER_TIME_MATCH_WINDOW_MS = 5 * 60_000;

export async function saveAssistantAnswerFeedback(
  req: AuthenticatedRequest,
  input: { conversationId: string; answerAt: string; rating: number; comment: string },
) {
  const comment = input.comment.trim();
  if (!comment) throw new AssistantError("Vui lòng ghi lý do đánh giá.", 400);
  const scope = {
    ...actorScope(req),
    branchId: req.user?.branchId || "",
    conversationId: input.conversationId,
    mode: "work" as const,
  };
  const session = await AssistantSessionModel.findOne(scope).select("_id messages").lean();
  if (!session) throw new AssistantError("Không tìm thấy câu trả lời trong cuộc trò chuyện này.", 404);

  const requestedTime = Date.parse(input.answerAt);
  const messages = Array.isArray(session.messages) ? session.messages as Array<Record<string, any>> : [];
  let answerIndex = -1;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message?.role !== "assistant" || typeof message.createdAt !== "string") continue;
    const storedTime = Date.parse(message.createdAt);
    if (!Number.isFinite(storedTime)) continue;
    const distance = Math.abs(storedTime - requestedTime);
    if (distance < closestDistance) {
      closestDistance = distance;
      answerIndex = index;
    }
  }
  if (answerIndex < 0 || closestDistance > ANSWER_TIME_MATCH_WINDOW_MS) {
    throw new AssistantError("Không tìm thấy câu trả lời cần đánh giá. Hãy tải lại cuộc trò chuyện rồi thử lại.", 404);
  }

  let question = "";
  for (let index = answerIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      question = String(messages[index].content || "");
      break;
    }
  }

  const answer = messages[answerIndex];
  const feedback = {
    rating: input.rating,
    comment,
    question,
    displayName: req.user?.displayName || "",
    email: req.user?.email || "",
    submittedAt: new Date(),
  };
  const updatePath = `messages.${answerIndex}.feedback`;
  const updated = await AssistantSessionModel.updateOne(
    {
      _id: session._id,
      ...scope,
      [`messages.${answerIndex}.role`]: "assistant",
      [`messages.${answerIndex}.createdAt`]: answer.createdAt,
      [`messages.${answerIndex}.content`]: answer.content,
    },
    { $set: { [updatePath]: feedback } },
  );
  if (!updated.matchedCount) {
    throw new AssistantError("Cuộc trò chuyện vừa thay đổi. Hãy tải lại rồi lưu đánh giá lại.", 409);
  }

  return {
    rating: feedback.rating,
    comment: feedback.comment,
    submittedAt: feedback.submittedAt.toISOString(),
  };
}
