import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import * as assistant from '../services/assistantService.js';

const getConversation = asyncHandler(async (req, res) =>
  success(res, {
    message: 'Lấy hội thoại thành công.',
    data: await assistant.getConversation(req.user!, String(req.params.id)),
  }),
);

const listSuggestions = asyncHandler(async (req, res) => {
  const result = await assistant.listSuggestions(req.user!, req.query);
  return success(res, {
    message: 'Lấy danh sách đề xuất thành công.',
    data: result.items,
    meta: result.meta,
  });
});

const getSuggestion = asyncHandler(async (req, res) =>
  success(res, {
    message: 'Lấy đề xuất thành công.',
    data: await assistant.getSuggestion(req.user!, String(req.params.id)),
  }),
);

const applySuggestion = asyncHandler(async (req, res) =>
  success(res, {
    message: 'Ghi nhận sử dụng đề xuất thành công.',
    data: await assistant.applySuggestion(req.user!, String(req.params.id)),
  }),
);

const createSuggestion = asyncHandler(async (req, res) =>
  success(res, {
    status: 201,
    message: 'Tạo đề xuất thành công. PT cần kiểm tra trước khi sử dụng.',
    data: await assistant.createSuggestion(req.user!, req.body, req.requestId!),
  }),
);

const approveSuggestion = asyncHandler(async (req, res) =>
  success(res, {
    message: 'Phê duyệt đề xuất thành công.',
    data: await assistant.reviewSuggestion(
      req.user!,
      String(req.params.id),
      true,
      req.body.editedContent,
    ),
  }),
);

const rejectSuggestion = asyncHandler(async (req, res) =>
  success(res, {
    message: 'Từ chối đề xuất thành công.',
    data: await assistant.reviewSuggestion(req.user!, String(req.params.id), false),
  }),
);

const createConversation = asyncHandler(async (req, res) =>
  success(res, {
    status: 201,
    message: 'Tạo hội thoại thành công.',
    data: await assistant.createConversation(req.user!, req.body),
  }),
);

const listConversations = asyncHandler(async (req, res) => {
  const result = await assistant.listConversations(req.user!, req.query);
  return success(res, {
    message: 'Lấy lịch sử hội thoại thành công.',
    data: result.items,
    meta: result.meta,
  });
});

const addConversationMessage = asyncHandler(async (req, res) =>
  success(res, {
    message: 'Gửi tin nhắn thành công.',
    data: await assistant.addConversationMessage(
      req.user!,
      String(req.params.id),
      req.body,
      req.requestId!,
    ),
  }),
);

export {
  createSuggestion,
  listSuggestions,
  getSuggestion,
  approveSuggestion,
  rejectSuggestion,
  applySuggestion,
  createConversation,
  listConversations,
  getConversation,
  addConversationMessage,
};
