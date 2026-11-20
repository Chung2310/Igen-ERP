import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate, type RequestValidationSchema } from '../middlewares/validate.js';
import { contentIdSchema, contentListSchema } from '../validators/contentValidator.js';
import { createController } from '../controllers/publicationController.js';

export type ContentResource = 'inbody' | 'goals' | 'workoutPlans' | 'nutritionPlans';

function createContentRouter(resource: ContentResource, schemas: { create: RequestValidationSchema; update: RequestValidationSchema }) {
  const router = express.Router();
  const controller = createController(resource);
  /* legacy manual validators
  const bodyValidator = (_req: Request): ValidationIssue[] => [];
  const idValidator = (req: Request): ValidationIssue[] => mongoose.isValidObjectId(req.params.id)
    ? []
    : [{ field: 'id', message: 'Mã nội dung không hợp lệ.' }];
  const updateValidator = (req: Request): ValidationIssue[] => {
    const errors = [...idValidator(req), ...bodyValidator(req)];
    for (const field of ['ptId', 'status', 'publishedAt', 'version']) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) errors.push({ field, message: `Trường ${field} không được phép cập nhật.` });
    }
    return errors;
  };
  const contentListValidator = (req: Request): ValidationIssue[] => {
    const errors = listValidator(req);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    if (status && !['DRAFT', 'PUBLISHED'].includes(status)) errors.push({ field: 'status', message: 'Trạng thái nội dung không hợp lệ.' });
    if (customerId && !mongoose.isValidObjectId(customerId)) errors.push({ field: 'customerId', message: 'Mã khách hàng không hợp lệ.' });
    return errors;
  };
  */
  router.get('/', authenticate, authorize('ADMIN', 'PT'), validate(contentListSchema), controller.list);
  router.get('/:id', authenticate, authorize('ADMIN', 'PT'), validate(contentIdSchema), controller.get);
  router.post('/', authenticate, authorize('ADMIN', 'PT'), validate(schemas.create), controller.create);
  router.patch('/:id', authenticate, authorize('ADMIN', 'PT'), validate({ ...schemas.update, params: contentIdSchema.params }), controller.update);
  router.delete('/:id', authenticate, authorize('ADMIN', 'PT'), validate(contentIdSchema), controller.remove);
  router.patch('/:id/publish', authenticate, authorize('ADMIN', 'PT'), validate(contentIdSchema), controller.publish);
  router.patch('/:id/unpublish', authenticate, authorize('ADMIN', 'PT'), validate(contentIdSchema), controller.unpublish);
  return router;
}

export default createContentRouter;
