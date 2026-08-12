import { NextFunction, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds, resolveCreateOwnerId } from "../utils/auth.util";
import { LearningRoadmapService } from "../services/learning-roadmap.service";

export class LearningRoadmapController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) { try { res.json({ success: true, data: await LearningRoadmapService.listRoadmaps(await getAllowedOwnerIds(req.user!), req.user!.branchId) }); } catch (error) { next(error); } }
  static async create(req: AuthRequest, res: Response, next: NextFunction) { try { const ownerId = await resolveCreateOwnerId(req.user!, req.body.companyCode); const courseOwnerScope = await getAllowedOwnerIds(req.user!); const data = await LearningRoadmapService.createRoadmap(ownerId, req.user!.branchId, req.body, courseOwnerScope); res.status(201).json({ success: true, data }); } catch (error) { next(error); } }
  static async update(req: AuthRequest, res: Response, next: NextFunction) { try { const data = await LearningRoadmapService.updateRoadmap(await getAllowedOwnerIds(req.user!), req.params.id, req.user!.branchId, req.body); res.json({ success: true, data }); } catch (error) { next(error); } }
  static async batchProgression(req: AuthRequest, res: Response, next: NextFunction) { try { const data = await LearningRoadmapService.getBatchProgression(await getAllowedOwnerIds(req.user!), req.params.batchId, typeof req.query.roadmapId === "string" ? req.query.roadmapId : undefined, req.user!.branchId); res.json({ success: true, data }); } catch (error) { next(error); } }
  static async saveDecision(req: AuthRequest, res: Response, next: NextFunction) { try { const data = await LearningRoadmapService.saveDecision(await getAllowedOwnerIds(req.user!), req.user!, { ...req.body, batchId: req.params.batchId, studentId: req.params.studentId }); res.json({ success: true, data }); } catch (error) { next(error); } }
  static async waitlist(req: AuthRequest, res: Response, next: NextFunction) { try { const data = await LearningRoadmapService.listWaitlist(await getAllowedOwnerIds(req.user!), req.query, req.user!.branchId); res.json({ success: true, ...data }); } catch (error) { next(error); } }
  static async place(req: AuthRequest, res: Response, next: NextFunction) { try { const data = await LearningRoadmapService.placeWaitlist(await getAllowedOwnerIds(req.user!), req.user!, req.body.batchId, req.body.entryIds); res.json({ success: true, data }); } catch (error) { next(error); } }
}
