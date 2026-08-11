import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { ProductCatalogService } from "./product-catalog.service";
import { ProductCatalogResourceService } from "./product-catalog-resource.service";

function companyCode(req: AuthenticatedRequest): string {
  if (!req.user?.companyCode) {
    throw Object.assign(new Error("Tài khoản chưa được gắn với công ty."), { statusCode: 400 });
  }
  return req.user.companyCode;
}

function actor(req: AuthenticatedRequest): string {
  if (!req.user?.id) {
    throw Object.assign(new Error("Người dùng chưa được xác thực."), { statusCode: 401 });
  }
  return req.user.id;
}

function query(req: AuthenticatedRequest): Record<string, unknown> {
  return req.query as Record<string, unknown>;
}

export const productCatalogController = {
  listTemplates: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await ProductCatalogService.listTemplates(companyCode(req), query(req)) });
    } catch (error) {
      next(error);
    }
  },

  createTemplate: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({ success: true, data: await ProductCatalogService.createTemplate(companyCode(req), req.body, actor(req)) });
    } catch (error) {
      next(error);
    }
  },

  updateTemplate: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await ProductCatalogService.updateTemplate(companyCode(req), req.params.id, req.body, actor(req)) });
    } catch (error) {
      next(error);
    }
  },

  listResources: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await ProductCatalogResourceService.list(companyCode(req), req.params.kind, query(req)) });
    } catch (error) {
      next(error);
    }
  },

  createResource: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({ success: true, data: await ProductCatalogResourceService.create(companyCode(req), req.params.kind, req.body, actor(req)) });
    } catch (error) {
      next(error);
    }
  },

  updateResource: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await ProductCatalogResourceService.update(companyCode(req), req.params.kind, req.params.id, req.body, actor(req)) });
    } catch (error) {
      next(error);
    }
  },

  list: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await ProductCatalogService.list(companyCode(req), query(req)) });
    } catch (error) {
      next(error);
    }
  },

  get: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await ProductCatalogService.get(companyCode(req), req.params.id) });
    } catch (error) {
      next(error);
    }
  },

  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({ success: true, data: await ProductCatalogService.create(companyCode(req), req.body, actor(req)) });
    } catch (error) {
      next(error);
    }
  },

  bulkCreateWithVariants: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({ success: true, data: await ProductCatalogService.bulkCreateWithVariants(companyCode(req), req.body, actor(req)) });
    } catch (error) {
      next(error);
    }
  },

  update: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await ProductCatalogService.update(companyCode(req), req.params.id, req.body, actor(req)) });
    } catch (error) {
      next(error);
    }
  },

  delete: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await ProductCatalogService.deleteProduct(companyCode(req), req.params.id, actor(req));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  createVariant: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({ success: true, data: await ProductCatalogService.createVariant(companyCode(req), req.params.id, req.body, actor(req)) });
    } catch (error) {
      next(error);
    }
  },

  createVariants: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({ success: true, data: await ProductCatalogService.createVariants(companyCode(req), req.params.id, req.body?.variants, actor(req)) });
    } catch (error) {
      next(error);
    }
  },

  updateVariant: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await ProductCatalogService.updateVariant(companyCode(req), req.params.id, req.body, actor(req)) });
    } catch (error) {
      next(error);
    }
  },

  updateVariants: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await ProductCatalogService.updateVariants(companyCode(req), req.body?.ids, req.body?.changes, actor(req)) });
    } catch (error) {
      next(error);
    }
  },

  deleteVariants: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await ProductCatalogService.deleteVariants(companyCode(req), req.body?.ids) });
    } catch (error) {
      next(error);
    }
  },
};
