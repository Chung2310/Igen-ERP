import { Router, type NextFunction, type Response } from "express";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../../middleware/auth";
import { requireModule } from "../../middleware/require-module";
import { TikTokShopService } from "./tiktok-shop.service";

export const tikTokShopInventoryRouter = Router();
const handle = (work: (req: AuthenticatedRequest) => Promise<unknown>) => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ data: await work(req) }); } catch (error) { next(error); }
};
const company = (req: AuthenticatedRequest) => req.user?.companyCode;
const branch = (req: AuthenticatedRequest) => String(req.user?.branchId || "");

tikTokShopInventoryRouter.get("/callback", async (req, res, next) => {
  try {
    if (req.query.error || req.query.error_description) throw new Error(String(req.query.error_description || req.query.error));
    await TikTokShopService.completeAuthorization(String(req.query.state || ""), String(req.query.code || req.query.auth_code || ""));
    res.type("html").send('<!doctype html><html lang="vi"><meta charset="utf-8"><title>TikTok Shop</title><p>Shop đã được liên kết. Bạn có thể đóng cửa sổ này.</p><script>if(window.opener)window.opener.postMessage({type:"TIKTOK_SHOP_CONNECTED"},window.location.origin);window.close()</script></html>');
  } catch (error) { next(error); }
});
tikTokShopInventoryRouter.use(requireAuth, requireModule("inventory"));
tikTokShopInventoryRouter.get("/status", requirePermission(["settings:manage", "inventory:read"]), handle((req) => TikTokShopService.status(company(req))));
tikTokShopInventoryRouter.use(requirePermission("settings:manage"));
tikTokShopInventoryRouter.get("/auth-url", handle(async (req) => ({ authUrl: await TikTokShopService.createAuthorizationUrl(company(req), String(req.user?.id || "")) })));
tikTokShopInventoryRouter.get("/catalog-products", handle((req) => TikTokShopService.listPublishableProducts(company(req))));
tikTokShopInventoryRouter.get("/listing/categories", handle((req) => TikTokShopService.listingCategories(company(req), req.query.connectionId, req.query.shopCipher)));
tikTokShopInventoryRouter.get("/listing/warehouses", handle((req) => TikTokShopService.listingWarehouses(company(req), req.query.connectionId, req.query.shopCipher)));
tikTokShopInventoryRouter.get("/listing/categories/:categoryId/attributes", handle((req) => TikTokShopService.listingAttributes(company(req), req.query.connectionId, req.query.shopCipher, req.params.categoryId)));
tikTokShopInventoryRouter.post("/listing/products", handle((req) => TikTokShopService.publishCatalogProduct(company(req), req.body)));
tikTokShopInventoryRouter.post("/sync-products", handle((req) => TikTokShopService.syncProducts(company(req))));
tikTokShopInventoryRouter.post("/import-products", handle((req) => TikTokShopService.importProductsToInventory(company(req), branch(req), String(req.user?.id || ""))));
tikTokShopInventoryRouter.post("/sync-inventory-prices", handle((req) => TikTokShopService.syncInventoryAndPrices(company(req), { branchId: branch(req) })));
