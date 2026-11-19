import express from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { commonMessages, objectId } from '../validators/commonValidator.js';
import { getCustomerProgressOverview, getMyJourney, getStaffJourney } from '../controllers/customerJourneyController.js';

const router = express.Router();
const range = { from: Joi.date().iso(), to: Joi.date().iso().min(Joi.ref('from')) };
router.get('/customers/progress-overview', authenticate, authorize('ADMIN', 'PT'), getCustomerProgressOverview);
router.get('/customers/:customerId/journey', authenticate, authorize('ADMIN', 'PT'), validate({ params: Joi.object({ customerId: objectId.required() }).messages(commonMessages), query: Joi.object(range).messages(commonMessages) }), getStaffJourney);
router.get('/me/journey', authenticate, authorize('CUSTOMER'), validate({ query: Joi.object(range).messages(commonMessages) }), getMyJourney);
export default router;
