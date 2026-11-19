import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { getMyContent } from '../controllers/publicationController.js';
import { deleteMe } from '../controllers/authController.js';
const router = express.Router();
router.get('/content', authenticate, authorize('CUSTOMER'), getMyContent);
router.delete('/', authenticate, deleteMe);
export default router;
