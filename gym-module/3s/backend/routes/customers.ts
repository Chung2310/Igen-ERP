import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as controller from '../controllers/customerController.js';
import { createCustomerAccountSchema, createCustomerSchema, createPackageSchema, customerIdSchema, deletePackageSchema, listCustomersSchema, listPackagesSchema, updateCustomerSchema, updatePackageSchema } from '../validators/customerValidator.js';
import * as workoutPlanController from '../controllers/customerWorkoutPlanController.js';
import { assignCustomerPlanSchema, getCustomerPlanSchema, listCustomerPlansSchema, updateCustomerPlanSchema } from '../validators/customerWorkoutPlanValidator.js';
const router = express.Router();
const allowStaff = [authenticate, authorize('ADMIN', 'PT')];
/* legacy manual validators
const CUSTOMER_MUTABLE_FIELDS = [
  'fullName', 'phone', 'email', 'dateOfBirth', 'gender', 'height',
  'initialWeight', 'medicalNotes', 'initialGoal', 'internalNotes', 'status',
];

function idValidator(req: Request): ValidationIssue[] {
  return mongoose.isValidObjectId(req.params.id) ? [] : [{ field: 'id', message: 'Mã khách hàng không hợp lệ.' }];
}

function validateCustomerFields(body: Record<string, unknown>, { partial = false, allowAssignedPt = false }: { partial?: boolean; allowAssignedPt?: boolean } = {}): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const has = (field: string) => Object.prototype.hasOwnProperty.call(body, field);
  const required = (field: string) => !partial || has(field);

  if (required('fullName') && (typeof body.fullName !== 'string' || body.fullName.trim().length < 2)) errors.push({ field: 'fullName', message: 'Họ tên phải có ít nhất 2 ký tự.' });
  if (required('phone') && (typeof body.phone !== 'string' || !/^[0-9+]{9,15}$/.test(body.phone.trim()))) errors.push({ field: 'phone', message: 'Số điện thoại không hợp lệ.' });
  if (has('email') && body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email))) errors.push({ field: 'email', message: 'Email không đúng định dạng.' });
  if (has('dateOfBirth') && body.dateOfBirth && (Number.isNaN(Date.parse(String(body.dateOfBirth))) || new Date(String(body.dateOfBirth)) > new Date())) errors.push({ field: 'dateOfBirth', message: 'Ngày sinh không hợp lệ hoặc ở tương lai.' });
  if (has('gender') && !['MALE', 'FEMALE', 'OTHER'].includes(String(body.gender))) errors.push({ field: 'gender', message: 'Giới tính không hợp lệ.' });
  for (const field of ['height', 'initialWeight']) {
    if (has(field) && body[field] !== null && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) {
      errors.push({ field, message: field === 'height' ? 'Chiều cao phải là số không âm.' : 'Cân nặng ban đầu phải là số không âm.' });
    }
  }
  if (has('status') && !['ACTIVE', 'INACTIVE', 'LEAD'].includes(String(body.status))) errors.push({ field: 'status', message: 'Trạng thái khách hàng không hợp lệ.' });
  if (allowAssignedPt && !mongoose.isValidObjectId(String(body.assignedPtId))) errors.push({ field: 'assignedPtId', message: 'Vui lòng chọn PT phụ trách.' });
  for (const [field, max, label] of [['medicalNotes', 2000, 'Lưu ý sức khỏe'], ['initialGoal', 1000, 'Mục tiêu ban đầu'], ['internalNotes', 2000, 'Ghi chú nội bộ']] as const) {
    if (has(field) && (typeof body[field] !== 'string' || body[field].length > max)) errors.push({ field, message: `${label} không hợp lệ hoặc vượt quá ${max.toLocaleString('vi-VN')} ký tự.` });
  }
  for (const field of Object.keys(body)) {
    if (!CUSTOMER_MUTABLE_FIELDS.includes(field) && !(allowAssignedPt && field === 'assignedPtId')) errors.push({ field, message: `Trường ${field} không được phép cập nhật.` });
  }
  if (partial && Object.keys(body).length === 0) errors.push({ field: 'body', message: 'Vui lòng cung cấp thông tin cần cập nhật.' });
  return errors;
}

const createCustomerValidator = (req: Request): ValidationIssue[] => validateCustomerFields(req.body, { allowAssignedPt: req.user?.role === 'ADMIN' });
const updateCustomerValidator = (req: Request): ValidationIssue[] => [...idValidator(req), ...validateCustomerFields(req.body, { partial: true })];

function packageValidator(req: Request): ValidationIssue[] {
  const errors = idValidator(req);
  if (typeof req.body.name !== 'string' || !req.body.name.trim()) errors.push({ field: 'name', message: 'Vui lòng nhập tên gói PT.' });
  if (!Number.isInteger(req.body.totalSessions) || req.body.totalSessions < 1) errors.push({ field: 'totalSessions', message: 'Tổng số buổi phải là số nguyên lớn hơn 0.' });
  if (!req.body.startDate || Number.isNaN(Date.parse(req.body.startDate))) errors.push({ field: 'startDate', message: 'Ngày bắt đầu không hợp lệ.' });
  if (!req.body.endDate || Number.isNaN(Date.parse(req.body.endDate))) errors.push({ field: 'endDate', message: 'Ngày kết thúc không hợp lệ.' });
  return errors;
}
function packageUpdateValidator(req: Request): ValidationIssue[] {
  const errors = packageValidator(req);
  if (!mongoose.isValidObjectId(req.params.packageId)) errors.push({ field: 'packageId', message: 'Mã gói PT không hợp lệ.' });
  if (req.body.status && !['ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED'].includes(req.body.status)) errors.push({ field: 'status', message: 'Trạng thái gói PT không hợp lệ.' });
  return errors;
}
const packageIdValidator = (req: Request): ValidationIssue[] => [...idValidator(req), ...(mongoose.isValidObjectId(req.params.packageId) ? [] : [{ field: 'packageId', message: 'Mã gói PT không hợp lệ.' }])];
const customerListValidator = (req: Request): ValidationIssue[] => {
  const errors = listValidator(req);
  if (req.query.status && !['ACTIVE', 'INACTIVE', 'LEAD'].includes(String(req.query.status))) errors.push({ field: 'status', message: 'Trạng thái khách hàng không hợp lệ.' });
  if (req.query.ptId && !mongoose.isValidObjectId(req.query.ptId)) errors.push({ field: 'ptId', message: 'Mã PT không hợp lệ.' });
  return errors;
};
const packageListValidator = (req: Request): ValidationIssue[] => {
  const errors = [...idValidator(req), ...listValidator(req)];
  if (req.query.status && !['ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED'].includes(String(req.query.status))) errors.push({ field: 'status', message: 'Trạng thái gói PT không hợp lệ.' });
  return errors;
};

function accountValidator(req: Request): ValidationIssue[] {
  const errors = idValidator(req);
  if (typeof req.body.username !== 'string' || req.body.username.trim().length < 3) errors.push({ field: 'username', message: 'Tên đăng nhập phải có ít nhất 3 ký tự.' });
  if (!isValidPassword(req.body.password)) errors.push({ field: 'password', message: PASSWORD_ERROR });
  if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) errors.push({ field: 'email', message: 'Email không đúng định dạng.' });
  return errors;
}

*/
router.get('/', ...allowStaff, validate(listCustomersSchema), controller.list);
router.post('/', ...allowStaff, validate(createCustomerSchema), controller.create);
router.get('/:id/workout-plans', ...allowStaff, validate(listCustomerPlansSchema), workoutPlanController.list);
router.post('/:id/workout-plans/assign', ...allowStaff, validate(assignCustomerPlanSchema), workoutPlanController.assign);
router.get('/:id/workout-plans/:planId', ...allowStaff, validate(getCustomerPlanSchema), workoutPlanController.get);
router.patch('/:id/workout-plans/:planId', ...allowStaff, validate(updateCustomerPlanSchema), workoutPlanController.update);
router.get('/:id', ...allowStaff, validate(customerIdSchema), controller.get);
router.patch('/:id', ...allowStaff, validate(updateCustomerSchema), controller.update);
router.delete('/:id', ...allowStaff, validate(customerIdSchema), controller.remove);
router.post('/:id/account', ...allowStaff, validate(createCustomerAccountSchema), controller.createAccount);
router.get('/:id/packages', ...allowStaff, validate(listPackagesSchema), controller.listPackages);
router.post('/:id/packages', ...allowStaff, validate(createPackageSchema), controller.createPackage);
router.patch('/:id/packages/:packageId', ...allowStaff, validate(updatePackageSchema), controller.updatePackage);
router.delete('/:id/packages/:packageId', ...allowStaff, validate(deletePackageSchema), controller.deletePackage);

router.get('/:id/consultations', ...allowStaff, controller.listConsultations);
router.post('/:id/consultations', ...allowStaff, controller.createConsultation);
router.patch('/:id/consultations/:consultationId', ...allowStaff, controller.updateConsultation);
router.delete('/:id/consultations/:consultationId', ...allowStaff, controller.deleteConsultation);

router.get('/:id/photos', ...allowStaff, controller.listPhotos);
router.post('/:id/photos', ...allowStaff, controller.createPhoto);
router.patch('/:id/photos/:photoId', ...allowStaff, controller.updatePhoto);
router.delete('/:id/photos/:photoId', ...allowStaff, controller.deletePhoto);

export default router;
