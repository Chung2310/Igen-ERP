import { Router } from "express";
import { CourseController } from "../controllers/course.controller";
import { CourseCategoryController } from "../controllers/course-category.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createCourseSchema, updateCourseSchema } from "../validations/course.validation";
import { createCourseCategorySchema } from "../validations/course-category.validation";
import { idParamSchema } from "../validations/student.validation";
import { requireAnyPermission } from "../../../middleware/auth";
import { STUDENT_AREA_PERMISSIONS } from "../permissions";

const router = Router();
const requireManage = requireAnyPermission([...STUDENT_AREA_PERMISSIONS.course.manage]) as any;

router.use(authMiddleware);

router.get("/categories", CourseCategoryController.getList);
router.post("/categories", requireManage, validate(createCourseCategorySchema), CourseCategoryController.create);
router.delete("/categories/:id", requireManage, validate(idParamSchema, "params"), CourseCategoryController.delete);

router.post("/", requireManage, validate(createCourseSchema), CourseController.create);
router.get("/", CourseController.getList);
router.get("/:id", validate(idParamSchema, "params"), CourseController.getDetail);
router.patch("/:id", requireManage, validate(idParamSchema, "params"), validate(updateCourseSchema), CourseController.update);
router.delete("/:id", requireManage, validate(idParamSchema, "params"), CourseController.delete);

export default router;
