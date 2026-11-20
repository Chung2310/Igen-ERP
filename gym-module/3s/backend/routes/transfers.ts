import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as controller from '../controllers/transferController.js';
import { batchForceTransferSchema, createTransferSchema, directForceTransferSchema, forceTransferSchema, listTransfersSchema, transferIdSchema, updateTransferSchema } from '../validators/transferValidator.js';

const router = express.Router();

router.get('/', authenticate, authorize('ADMIN', 'PT'), validate(listTransfersSchema), controller.list);
router.post('/', authenticate, authorize('PT'), validate(createTransferSchema), controller.create);
router.post('/admin-force', authenticate, authorize('ADMIN'), validate(directForceTransferSchema), controller.directForce);
router.post('/admin-force-batch', authenticate, authorize('ADMIN'), validate(batchForceTransferSchema), controller.batchForce);
router.patch('/:id', authenticate, authorize('PT'), validate(updateTransferSchema), controller.update);
router.delete('/:id', authenticate, authorize('PT'), validate(transferIdSchema), controller.remove);
router.patch('/:id/accept', authenticate, authorize('PT'), validate(transferIdSchema), controller.accept);
router.patch('/:id/reject', authenticate, authorize('PT'), validate(transferIdSchema), controller.reject);
router.patch('/:id/admin-force', authenticate, authorize('ADMIN'), validate(forceTransferSchema), controller.force);

export default router;
