import { success } from '../middlewares/response.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import * as userService from '../services/userService.js';
import type { UserDocument } from '../models/User.js';

const publicUser = (user: UserDocument) => {
  const { password: _password, ...value } = user.toObject({ versionKey: false });
  return value;
};

const create = asyncHandler(async (req, res) =>
  success(res, {
    status: 201,
    message: 'Tạo tài khoản thành công.',
    data: publicUser(await userService.createManagedUser(req.user!, req.body)),
  })
);

const list = asyncHandler(async (req, res) => {
  const { users, meta } = await userService.listUsers(req.query, req.user!);
  return success(res, {
    message: 'Lấy danh sách tài khoản thành công.',
    data: users,
    meta,
  });
});

const update = asyncHandler(async (req, res) =>
  success(res, {
    message: 'Cập nhật tài khoản thành công.',
    data: publicUser(await userService.updateManagedUser(req.user!, String(req.params.id), req.body)),
  })
);

const remove = asyncHandler(async (req, res) => {
  await userService.deleteManagedUser(req.user!, String(req.params.id));
  return success(res, { message: 'Xóa tài khoản thành công.', data: null });
});

export { create, list, update, remove };
