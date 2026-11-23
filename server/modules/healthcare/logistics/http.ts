import type { RequestHandler, Response } from "express";
import type { Db } from "mongodb";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { ConflictError } from "../../../errors/app-error";
import { healthcareDb } from "../store";
import { healthcareScope } from "../operations";
import { ensureIndexes, type Actor } from "./store";
type Handler = (req: AuthenticatedRequest, res: Response, db: Db, actor: Actor) => Promise<unknown>;
export const route =
  (handler: Handler): RequestHandler =>
  (request, res, next) => {
    const req = request as AuthenticatedRequest;
    void (async () => {
      const actor = await healthcareScope(req);
      const db = await healthcareDb();
      await ensureIndexes(db);
      await handler(req, res, db, actor);
    })().catch((error) =>
      next(
        error?.code === 11000
          ? new ConflictError("CONFLICT", "Mã đã tồn tại hoặc thao tác đã được xử lý. Vui lòng tải lại.")
          : error,
      ),
    );
  };
