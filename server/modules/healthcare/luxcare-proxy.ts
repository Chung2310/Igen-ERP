import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import path from "node:path";
import type { RequestHandler } from "express";
import mongoose from "mongoose";
import { requirePermission } from "../../middleware/auth";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { NotFoundError, ValidationError } from "../../errors/app-error";
import { healthcareScope } from "./operations";

let child: ChildProcess | undefined;
let ready: Promise<number> | undefined;

function ensureFeatureServer(): Promise<number> {
  if (ready) return ready;
  ready = new Promise<number>((resolve, reject) => {
    const root = process.cwd();
    const built = path.join(root, "healthcare-luxcare", "dist-feature", "server.cjs");
    const development = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
    const source = path.join(root, "healthcare-luxcare", "feature-server.ts");
    const isProduction = process.env.NODE_ENV === "production";
    const worker = spawn(process.execPath, isProduction ? [built] : [development, source], {
      cwd: root,
      env: process.env,
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      windowsHide: true,
    });
    child = worker;
    const timer = setTimeout(() => {
      if (child === worker) child = undefined;
      ready = undefined;
      worker.kill();
      reject(new Error("Khởi động phân hệ vật tư và thiết bị quá lâu."));
    }, 60_000);
    worker.on("message", message => {
      if (message && typeof message === "object" && "type" in message && message.type === "ready" &&
        "port" in message && typeof message.port === "number") {
        clearTimeout(timer);
        resolve(message.port);
      }
    });
    worker.once("error", error => {
      clearTimeout(timer);
      if (child === worker) { child = undefined; ready = undefined; }
      reject(error);
    });
    worker.once("exit", code => {
      clearTimeout(timer);
      if (child === worker) { child = undefined; ready = undefined; }
      reject(new Error(`Phân hệ LuxCare đã dừng (${code ?? "không rõ"}).`));
    });
  });
  return ready;
}

const forward: RequestHandler = (req, res, next) => {
  void ensureFeatureServer().then(port => {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers["content-length"];
    delete headers["transfer-encoding"];
    const contentType = req.headers["content-type"] || "";
    const hasParsedBody = !contentType.startsWith("multipart/") && req.body !== undefined;
    const payload = hasParsedBody ? Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body)) : undefined;
    if (payload) headers["content-length"] = String(payload.length);
    const upstream = http.request({
      hostname: "127.0.0.1", port, method: req.method, path: req.originalUrl, headers,
    }, response => {
      res.status(response.statusCode || 502);
      for (const [key, value] of Object.entries(response.headers)) {
        if (value !== undefined && key !== "transfer-encoding" && key !== "connection") res.setHeader(key, value);
      }
      response.pipe(res);
    });
    upstream.on("error", next);
    req.on("aborted", () => upstream.destroy());
    if (payload) upstream.end(payload);
    else req.pipe(upstream);
  }).catch(next);
};

export const luxcareProxy: RequestHandler = (req, res, next) => {
  if (req.originalUrl.startsWith("/api/v1/equipment-media/")) {
    return requirePermission(["healthcare:manage", "healthcare-equipment:manage"])(req, res, () => forward(req, res, next));
  }
  if (req.method !== "GET" && /^\/api\/v1\/(departments|rooms)(?:\/|\?|$)/.test(req.originalUrl)) {
    return requirePermission(["healthcare:manage", "healthcare-supplies:manage", "healthcare-equipment:manage"])(req, res, () => forward(req, res, next));
  }
  if (req.originalUrl.startsWith("/api/v1/equipment")) {
    void (async () => {
      const scope = await healthcareScope(req as AuthenticatedRequest);
      const url = new URL(req.originalUrl, "http://localhost");
      const requestedBranch = url.searchParams.get("branchId");
      if (requestedBranch && requestedBranch !== scope.branchId) {
        throw new ValidationError("BRANCH_REQUIRED", "Chi nhánh trong yêu cầu không khớp chi nhánh đang chọn.");
      }
      const id = /^\/api\/v1\/equipment\/([a-f\d]{24})(?:\/|$)/i.exec(url.pathname)?.[1];
      if (id && !await mongoose.connection.db?.collection("equipment").findOne({
        _id: new mongoose.Types.ObjectId(id), companyCode: scope.companyCode, branchId: scope.branchId,
      }, { projection: { _id: 1 } })) {
        throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy thiết bị trong chi nhánh hiện tại.");
      }
      forward(req, res, next);
    })().catch(next);
    return;
  }
  forward(req, res, next);
};
