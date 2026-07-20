import { Router } from "express";
import multer from "multer";
import { faceManagementController } from "../controller/face-management.controller";
import {
  requireAuth,
  requireCompanyAccess,
  requireHierarchyAccess,
  requirePermission,
} from "../middleware/auth";
import { UserModel } from "../model/user.model";

export const faceManagementRouter = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

const access = [
  requireAuth as any,
  requirePermission("face:manage") as any,
  requireCompanyAccess(UserModel, "id") as any,
  requireHierarchyAccess("id") as any,
];

faceManagementRouter.get("/users/:id", ...access, faceManagementController.status as any);
faceManagementRouter.post(
  "/users/:id",
  ...access,
  imageUpload.single("file"),
  faceManagementController.register as any,
);
faceManagementRouter.delete("/users/:id", ...access, faceManagementController.remove as any);