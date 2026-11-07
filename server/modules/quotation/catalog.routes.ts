import type { Router, Request, Response } from "express";
import { applyCatalogBulk, changeCatalogState, createCatalogProduct, listCatalog, previewCatalogBulk, updateCatalogProduct } from "./catalog.service";

export function registerCatalogRoutes(router: Router) {
  router.get("/catalog", async (req, res) => { res.json(await listCatalog(req.query)); });
  router.post("/catalog", async (req, res) => { res.status(201).json(await createCatalogProduct(req.body, req.header("Idempotency-Key"))); });
  router.post("/catalog/bulk/preview", async (req, res) => { res.json(await previewCatalogBulk(req.body)); });
  router.post("/catalog/bulk", async (req, res) => { res.json(await applyCatalogBulk(req.body, req.header("Idempotency-Key"))); });
  router.patch("/catalog/:id", async (req, res) => { res.json(await updateCatalogProduct(req.params.id, req.body, req.header("If-Unmodified-Since"))); });
  router.post("/catalog/:id/duplicate", async (req, res) => { res.status(201).json(await createCatalogProduct(req.body, req.header("Idempotency-Key"), req.params.id, req.body?.sourceUpdatedAt)); });
  for (const action of ["delete", "restore"] as const) {
    const handler = async (req: Request, res: Response) => {
      res.json(await changeCatalogState(req.params.id, action, req.header("If-Unmodified-Since"), req.header("Idempotency-Key")));
    };
    if (action === "delete") router.delete("/catalog/:id", handler);
    else router.post("/catalog/:id/restore", handler);
  }
}
