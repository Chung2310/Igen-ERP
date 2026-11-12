import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { ddosConfig } from "../config/ddos";

const LARGE_BODY_ROUTES = [
  "/api/v1/company-knowledge/documents/upload",
  "/api/v1/marketing-media/upload",
  "/api/v1/gemini/upload-document",
  "/api/v1/gemini/extract-scenario",
  "/api/v1/media/upload",
  "/api/v1/resources/drive/upload",
  "/api/v1/integrations/google-drive/upload",
  "/api/v1/assignments/public/upload",
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
const studioImageParser = parserPair("8mb");
const studioImageEditParser = parserPair("22mb");
const studioSlideEditParser = parserPair("10mb");

export const selectiveBodyParser: RequestHandler = (req, res, next) => {
  const parser = /^\/api\/v1\/chatbot\/assistant\/studio\/slides\/[a-f0-9]{24}$/i.test(req.path)
    ? studioSlideEditParser
    : req.path === "/api/v1/chatbot/assistant/studio/images/edit"
    ? studioImageEditParser
    : req.path === "/api/v1/chatbot/assistant/studio/images"
    ? studioImageParser
    : isLargeBodyRoute(req.path) ? largeParser : generalParser;
  parser(req, res, next);
};
