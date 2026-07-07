import { Router } from "express";
import { CourseController } from "../controllers/course.controller";
import { CourseCategoryController } from "../controllers/course-category.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createCourseSchema, updateCourseSchema } from "../validations/course.validation";
import { createCourseCategorySchema } from "../validations/course-category.validation";
import { idParamSchema } from "../validations/student.validation";

const router = Router();

router.use(authMiddleware);

router.get("/categories", CourseCategoryController.getList);
router.post("/categories", validate(createCourseCategorySchema), CourseCategoryController.create);
router.delete("/categories/:id", validate(idParamSchema, "params"), CourseCategoryController.delete);

router.post("/", validate(createCourseSchema), CourseController.create);
router.get("/", CourseController.getList);
router.get("/:id", validate(idParamSchema, "params"), CourseController.getDetail);
router.patch("/:id", validate(idParamSchema, "params"), validate(updateCourseSchema), CourseController.update);
router.delete("/:id", validate(idParamSchema, "params"), CourseController.delete);

export default router;
