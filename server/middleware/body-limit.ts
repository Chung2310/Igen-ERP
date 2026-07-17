import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { ddosConfig } from "../config/ddos";

const LARGE_BODY_ROUTES = [
  "/api/v1/media/upload",
  "/api/v1/resources/drive/upload",
  "/api/v1/integrations/google-drive/upload",
];

export function isLargeBodyRoute(pathname: string): boolean {
  return LARGE_BODY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function parserPair(limit: string): RequestHandler {
  const json = express.json({
    limit,
    verify: (req: Request, _res: Response, buffer) => {
      (req as Request & { rawBody?: string }).rawBody = buffer.toString();
    },
  });
  const urlencoded = express.urlencoded({ limit, extended: true });

  return (req: Request, res: Response, next: NextFunction) => {
    json(req, res, (jsonError?: unknown) => {
      if (jsonError) return next(jsonError);
      urlencoded(req, res, next);
    });
  };
}

const generalParser = parserPair(ddosConfig.generalBodyLimit);
const largeParser = parserPair(ddosConfig.largeBodyLimit);

export const selectiveBodyParser: RequestHandler = (req, res, next) => {
  const parser = isLargeBodyRoute(req.path) ? largeParser : generalParser;
  parser(req, res, next);
};
