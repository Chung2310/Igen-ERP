import "dotenv/config";
import "./server/config/timezone";
import express from "express";
import mongoose from "mongoose";
import { supplyRouter } from "./server/router/supply.router";
import { supplyInventoryRouter } from "./server/router/supply-inventory.router";
import { equipmentRouter } from "./server/router/equipment.router";
import { supplierRouter } from "./server/router/supplier.router";
import { warehouseRouter } from "./server/router/warehouse.router";
import { categoryRouter } from "./server/router/category.router";
import { departmentRouter } from "./server/router/department.router";
import { roomRouter } from "./server/router/room.router";
import { mediaRouter } from "./server/router/media.router";
import { apiErrorHandler } from "./server/middleware/api-error-handler";
import { startInventoryOutboxWorker } from "./server/service/supply/inventory-outbox.service";

function connectionUri() {
  const uri = process.env.MONGODB_URI || "mongodb://mongodb/igen-erp";
  const user = process.env.MONGODB_USER;
  const pass = process.env.MONGODB_PASSWORD;
  if (!user || !pass || uri.includes("@")) return uri;
  const protocol = uri.startsWith("mongodb+srv://") ? "mongodb+srv://" : "mongodb://";
  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`;
  const withCredentials = uri.replace(protocol, protocol + credentials);
  return withCredentials + (withCredentials.includes("?") ? "&" : "?") + `authSource=${process.env.MONGODB_AUTH_SOURCE || "admin"}`;
}

async function start() {
  await mongoose.connect(connectionUri(), { retryWrites: false });
  startInventoryOutboxWorker();
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.get("/internal/ready", (_req, res) => res.json({ ready: true }));
  app.use("/api/v1/supplies", supplyRouter);
  app.use("/api/v1/supply-inventory", supplyInventoryRouter);
  app.use("/api/v1/equipment", equipmentRouter);
  app.use("/api/v1/suppliers", supplierRouter);
  app.use("/api/v1/warehouses", warehouseRouter);
  app.use("/api/v1/categories", categoryRouter);
  app.use("/api/v1/departments", departmentRouter);
  app.use("/api/v1/rooms", roomRouter);
  app.use("/api/v1/equipment-media", mediaRouter);
  app.use(apiErrorHandler);
  const port = Number(process.env.LUXCARE_INTERNAL_PORT || 0);
  const server = app.listen(port, "127.0.0.1", () => {
    const address = server.address();
    if (address && typeof address !== "string") process.send?.({ type: "ready", port: address.port });
  });
  process.on("disconnect", () => server.close(() => process.exit(0)));
}

void start().catch(error => {
  console.error("LuxCare logistics failed to start", error);
  process.exitCode = 1;
});
