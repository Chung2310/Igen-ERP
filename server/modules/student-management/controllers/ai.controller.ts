import { Response, NextFunction } from "express";
import { AIService } from "../services/ai.service";
import { AuthRequest } from "../middlewares/auth.middleware";

export class AIController {
  static async analyze(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const student = req.body;
      const analysis = await AIService.analyzeStudent(student);
      res.json({ success: true, analysis });
    } catch (error: unknown) {
      next(error);
    }
  }
}
