import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { roomController } from "../controller/room.controller";

export const roomRouter = Router();

roomRouter.use(requireAuth as any);

roomRouter.get("/unmapped", roomController.unmapped as any);
roomRouter.post("/merge", roomController.merge as any);
roomRouter.get("/:id", roomController.get as any);
roomRouter.patch("/:id", roomController.update as any);
roomRouter.delete("/:id", roomController.delete as any);
roomRouter.get("/", roomController.list as any);
roomRouter.post("/", roomController.create as any);
