import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as controller from '../controllers/knowledgeAssistantController.js';
import {
  addConversationMessageSchema,
  createConversationSchema,
  createSuggestionSchema,
  knowledgeIdSchema,
  listConversationsSchema,
  listSuggestionsSchema,
} from '../validators/knowledgeValidator.js';

const router = express.Router();
const assistantBase = [authenticate, authorize('PT', 'CUSTOMER', 'ADMIN')] as const;

router.get('/assistant/conversations', ...assistantBase, validate(listConversationsSchema), controller.listConversations);
router.post('/assistant/conversations', ...assistantBase, validate(createConversationSchema), controller.createConversation);
router.post('/assistant/conversations/:id/messages', ...assistantBase, validate(addConversationMessageSchema), controller.addConversationMessage);
router.post('/assistant/suggestions', ...assistantBase, validate(createSuggestionSchema), controller.createSuggestion);
router.patch('/assistant/suggestions/:id/approve', ...assistantBase, validate(knowledgeIdSchema), controller.approveSuggestion);
router.patch('/assistant/suggestions/:id/reject', ...assistantBase, validate(knowledgeIdSchema), controller.rejectSuggestion);

router.get('/assistant/conversations/:id', ...assistantBase, validate(knowledgeIdSchema), controller.getConversation);
router.get('/assistant/suggestions', ...assistantBase, validate(listSuggestionsSchema), controller.listSuggestions);
router.get('/assistant/suggestions/:id', ...assistantBase, validate(knowledgeIdSchema), controller.getSuggestion);
router.patch('/assistant/suggestions/:id/apply', ...assistantBase, validate(knowledgeIdSchema), controller.applySuggestion);

export default router;
