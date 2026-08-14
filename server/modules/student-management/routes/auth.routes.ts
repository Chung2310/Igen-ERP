import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware, requireRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { loginSchema, registerSchema, bankSettingsSchema, smsSettingsSchema, createManagedUserSchema } from "../validations/auth.validation";
import { requirePermission } from "../../../middleware/auth";


const router = Router();

router.post("/register", validate(registerSchema), AuthController.register);
router.post("/login", validate(loginSchema), AuthController.login);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/logout", authMiddleware, requirePermission("people:read"), AuthController.logout);
router.get("/teacher/:id", AuthController.getTeacherPublicInfo);
router.get("/me", authMiddleware, AuthController.getMe);
router.get("/users/:id/bank-settings", authMiddleware, AuthController.getUserBankSettings);
router.patch("/bank-settings", authMiddleware, requirePermission("people:manage"), validate(bankSettingsSchema), AuthController.updateBankSettings);
router.patch("/business-settings", authMiddleware, requirePermission("people:manage"), AuthController.updateBusinessSettings);
router.patch("/sms-settings", authMiddleware, requirePermission("people:manage"), validate(smsSettingsSchema), AuthController.updateSmsSettings);
router.get("/users", authMiddleware, requireRoles("superadmin", "admin"), AuthController.listUsers);
router.post("/users", authMiddleware, requireRoles("superadmin", "admin"), requirePermission("access:manage"), validate(createManagedUserSchema), AuthController.createUser);
router.patch("/users/:id", authMiddleware, requireRoles("superadmin", "admin"), requirePermission("access:manage"), AuthController.updateUser);
router.delete("/users/:id", authMiddleware, requireRoles("superadmin", "admin"), requirePermission("access:manage"), AuthController.deleteUser);

export default router;
