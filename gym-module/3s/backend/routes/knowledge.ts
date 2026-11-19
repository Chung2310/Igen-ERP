import express from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as controller from '../controllers/knowledgeController.js';

const router = express.Router();
const adminOnly = [authenticate, authorize('ADMIN')] as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // Tối đa 25MB mỗi file
    files: 10, // Tối đa 10 file một lần upload
  },
});

// Quản lý kho tri thức (Chỉ dành riêng cho ADMIN)
router.get('/', ...adminOnly, controller.listDocuments);
router.post('/upload', ...adminOnly, upload.array('files', 10), controller.uploadDocuments);
router.post('/', ...adminOnly, controller.createDocument);
router.post('/seed-standard', ...adminOnly, controller.seedStandard);
router.patch('/:id', ...adminOnly, controller.updateDocument);
router.delete('/:id', ...adminOnly, controller.deleteDocument);
router.patch('/:id/publish', ...adminOnly, controller.publishDocument);
router.patch('/:id/unpublish', ...adminOnly, controller.unpublishDocument);

export default router;
