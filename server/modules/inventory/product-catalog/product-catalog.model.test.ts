import assert from "node:assert/strict";
import test from "node:test";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductTemplateModel } from "../../../model/product-template.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ProductCatalogLegacyMappingModel } from "../../../model/product-catalog-legacy-mapping.model";
import {
  ProductCatalogBrandModel,
  ProductCatalogCategoryModel,
  ProductAttributeDefinitionModel,
  UnitOfMeasureModel,
} from "../../../model/product-catalog-resource.model";

test("product catalog stores master data, not branch balances or prices", () => {
  assert.ok(ProductCatalogModel.schema.path("attributes"));
  assert.ok(ProductCatalogModel.schema.path("templateCode"));
  assert.equal(ProductCatalogModel.schema.path("stock"), undefined);
  assert.equal(ProductCatalogModel.schema.path("price"), undefined);
  assert.ok(ProductCatalogModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.productCode === 1 && options.unique === true));
});

test("variant identity is unique inside a company", () => {
  assert.ok(ProductVariantModel.schema.path("trackingMode"));
  assert.equal(ProductVariantModel.schema.path("branchId"), undefined);
  assert.ok(ProductVariantModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.sku === 1 && options.unique === true));
  assert.ok(ProductVariantModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.barcode === 1 && options.unique === true && options.partialFilterExpression));
});

test("template fields are reusable and typed", () => {
  assert.ok(ProductTemplateModel.schema.path("fields"));
  assert.ok(ProductTemplateModel.schema.path("productType"));
  assert.ok(ProductTemplateModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.code === 1 && options.unique === true));
});

test("company master resources are reusable and never branch-scoped", () => {
  for (const model of [ProductCatalogCategoryModel, ProductCatalogBrandModel, UnitOfMeasureModel, ProductAttributeDefinitionModel]) {
    assert.equal(model.schema.path("branchId"), undefined);
    assert.ok(model.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.code === 1 && options.unique === true));
  }
});

test("legacy mapping keeps the old product identity available for phase-three migration", () => {
  for (const path of ["legacyProductId", "legacyBranchId", "productId", "variantId", "migratedAt"]) assert.ok(ProductCatalogLegacyMappingModel.schema.path(path));
  assert.ok(ProductCatalogLegacyMappingModel.schema.indexes().some(([keys, options]) => keys.companyCode === 1 && keys.legacyProductId === 1 && options.unique === true));
});
