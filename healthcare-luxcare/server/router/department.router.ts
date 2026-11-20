import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { departmentController } from "../controller/department.controller";

export const departmentRouter = Router();

departmentRouter.use(requireAuth as any);

departmentRouter.get("/unmapped", departmentController.unmapped as any);
departmentRouter.post("/merge", departmentController.merge as any);
departmentRouter.get("/:id", departmentController.get as any);
departmentRouter.patch("/:id", departmentController.update as any);
departmentRouter.delete("/:id", departmentController.delete as any);
departmentRouter.get("/", departmentController.list as any);
departmentRouter.post("/", departmentController.create as any);
