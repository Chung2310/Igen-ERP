import type { RequestHandler } from "express";
import { NotFoundError } from "../errors/app-error";

export const apiNotFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(
    "API_ROUTE_NOT_FOUND",
    "Không tìm thấy API được yêu cầu.",
    { method: req.method, path: req.path },
  ));
};