import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware, requireRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { loginSchema, registerSchema, bankSettingsSchema, smtpSettingsSchema, smsSettingsSchema, createManagedUserSchema } from "../validations/auth.validation";


const router = Router();

router.post("/register", validate(registerSchema), AuthController.register);
router.post("/login", validate(loginSchema), AuthController.login);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/logout", AuthController.logout);
router.get("/teacher/:id", AuthController.getTeacherPublicInfo);
router.get("/me", authMiddleware, AuthController.getMe);
router.get("/users/:id/bank-settings", authMiddleware, AuthController.getUserBankSettings);
router.patch("/bank-settings", authMiddleware, validate(bankSettingsSchema), AuthController.updateBankSettings);
router.patch("/business-settings", authMiddleware, AuthController.updateBusinessSettings);
router.patch("/smtp-settings", authMiddleware, validate(smtpSettingsSchema), AuthController.updateSmtpSettings);
router.patch("/sms-settings", authMiddleware, validate(smsSettingsSchema), AuthController.updateSmsSettings);
router.get("/users", authMiddleware, requireRoles("superadmin", "admin"), AuthController.listUsers);
router.post("/users", authMiddleware, requireRoles("superadmin", "admin"), validate(createManagedUserSchema), AuthController.createUser);
router.patch("/users/:id", authMiddleware, requireRoles("superadmin", "admin"), AuthController.updateUser);
router.delete("/users/:id", authMiddleware, requireRoles("superadmin", "admin"), AuthController.deleteUser);

export default router;
