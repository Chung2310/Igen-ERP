import { Router } from "express";
import multer from "multer";
import { StudentFaceController } from "../controllers/student-face.controller";
import { requirePermission } from "../../../middleware/auth";

const router = Router();
const requireManage = requirePermission("student:manage") as any;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

router.get("/:studentId/face", StudentFaceController.status);
router.post("/:studentId/face", requireManage, imageUpload.single("file"), StudentFaceController.register);
router.delete("/:studentId/face", requireManage, StudentFaceController.remove);

export default router;
