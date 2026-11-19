import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as controller from '../controllers/packageTemplateController.js';

const router = express.Router();

router.get('/', authenticate, authorize('ADMIN', 'PT'), controller.list);
router.get('/:id', authenticate, authorize('ADMIN', 'PT'), controller.get);
router.post('/', authenticate, authorize('ADMIN'), controller.create);
router.patch('/:id', authenticate, authorize('ADMIN'), controller.update);
router.delete('/:id', authenticate, authorize('ADMIN'), controller.remove);

export default router;
