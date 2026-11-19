import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as userController from '../controllers/userController.js';
import { createUserSchema, deleteUserSchema, listUsersSchema, updateUserSchema } from '../validators/userValidator.js';

const router = express.Router();
/* legacy manual validators
const idValidator = (req: Request): ValidationIssue[] => mongoose.isValidObjectId(req.params.id) ? [] : [{ field: 'id', message: 'Mã PT không hợp lệ.' }];
const userListValidator = (req: Request): ValidationIssue[] => {
  const errors = listValidator(req);
  if (req.query.role && !['ADMIN', 'PT', 'CUSTOMER'].includes(String(req.query.role))) errors.push({ field: 'role', message: 'Vai trò không hợp lệ.' });
  if (req.query.status && !['ACTIVE', 'LOCKED'].includes(String(req.query.status))) errors.push({ field: 'status', message: 'Trạng thái tài khoản không hợp lệ.' });
  return errors;
};

*/
router.get('/', authenticate, authorize('ADMIN'), validate(listUsersSchema), userController.list);
router.post('/', authenticate, authorize('ADMIN'), validate(createUserSchema), userController.create);
router.patch('/:id', authenticate, authorize('ADMIN'), validate(updateUserSchema), userController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), validate(deleteUserSchema), userController.remove);

export default router;
