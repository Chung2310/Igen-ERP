import { Router } from "express";
import { StudentAttendanceAttemptController } from "../controllers/student-attendance-attempt.controller";

const router = Router();

router.get("/", StudentAttendanceAttemptController.list);

export default router;
