import { Router } from "express";
import multer from "multer";
import { StudentFaceController } from "../controllers/student-face.controller";

const router = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

router.get("/:studentId/face", StudentFaceController.status);
router.post("/:studentId/face", imageUpload.single("file"), StudentFaceController.register);
router.delete("/:studentId/face", StudentFaceController.remove);

export default router;
