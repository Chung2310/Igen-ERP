import React, { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import {
  type CatalogProductDetail,
  productCatalogService,
} from "../../../services/productCatalogService";
import {
  type Resources,
  getCategoryDisplayName,
  statusLabels,
  trackingLabels,
  typeLabels,
} from "./catalogConstants";
import { Modal } from "./catalogUi";
import { sanitizeProductDescriptionHtml } from "./productDescription";

interface ProductViewerModalProps {
  product: CatalogProductDetail;
  resources: Resources;
  onClose: () => void;
}

export function ProductViewerModal({ product, resources, onClose }: ProductViewerModalProps) {
  const categoryName = getCategoryDisplayName(product.categoryCode, resources.categories);
  const brandName = resources.brands.find((b) => b.code === product.brandCode)?.name || product.brandCode || "Không có";
  const description = product.description || product.shortDescription || "";
  const [pricesByVariant, setPricesByVariant] = useState<Record<string, number>>({});

  useEffect(() => {
    void productCatalogService
      .listPrices()
      .then((prices) => {
        setPricesByVariant(Object.fromEntries(prices.map((p) => [p.variantId, p.sellingPrice])));
      })
      .catch(() => {});
  }, [product._id]);

  return (
    <Modal title={`Chi tiết: ${product.name}`} onClose={onClose} wide>
      <div className="bg-slate-50/50 -m-5 p-5 space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-40 flex-shrink-0">
            <div className="aspect-square w-full rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
              {product.mediaIds?.[0] ? (
                <img src={product.mediaIds[0]} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-slate-300" />
              )}
            </div>
            <div className="mt-4 text-center">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  product.status === "active"
                    ? "bg-emerald-100 text-emerald-800"
                    : product.status === "draft"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {statusLabels[product.status]}
              </span>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Mã sản phẩm</p>
              <p className="text-sm font-semibold text-slate-900 font-mono">{product.productCode}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Tên sản phẩm / Đời máy</p>
              <p className="text-sm font-medium text-slate-900">{product.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Loại</p>
              <p className="text-sm font-medium text-slate-900">{typeLabels[product.productType]}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Danh mục</p>
              <p className="text-sm font-medium text-slate-900">{categoryName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Thương hiệu</p>
              <p className="text-sm font-medium text-slate-900">{brandName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Nhà sản xuất</p>
              <p className="text-sm font-medium text-slate-900">{product.manufacturer || "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Xuất xứ</p>
              <p className="text-sm font-medium text-slate-900">{product.countryOfOrigin || "-"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Mô tả</p>
              {description ? (
                <div
                  className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-100 min-h-[60px] break-words leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:font-semibold [&_a]:text-cyan-700 [&_a]:underline [&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:bg-slate-100 [&_th]:p-2 [&_td]:border [&_td]:p-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeProductDescriptionHtml(description) }}
                />
              ) : (
                <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-md border border-slate-100 min-h-[60px]">Chưa có mô tả chi tiết.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Mã SKU / Biến thể ({product.variants.length})
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-[60px]">Ảnh</th>
                  <th className="px-4 py-3">Mã SKU</th>
                  <th className="px-4 py-3">Tên biến thể</th>
                  <th className="px-4 py-3">Giá bán</th>
                  <th className="px-4 py-3">Theo dõi kho</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {product.variants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      Chưa có mã SKU nào.
                    </td>
                  </tr>
                ) : (
                  product.variants.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="h-10 w-10 overflow-hidden rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center">
                          {item.mediaIds?.[0] ? (
                            <img src={item.mediaIds[0]} alt={item.sku} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-slate-300" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-bold text-slate-700">{item.sku}</div>
                        {item.barcode && <div className="mt-0.5 text-[11px] text-slate-500">{item.barcode}</div>}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.displayName || <span className="text-slate-400 italic font-normal">Mặc định</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-cyan-700">
                        {pricesByVariant[item._id] ? (
                          `${pricesByVariant[item._id].toLocaleString("vi-VN")} ₫`
                        ) : (
                          <span className="font-normal text-rose-500 text-xs">Chưa có giá</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <span className="bg-slate-100 px-2 py-0.5 rounded">{trackingLabels[item.trackingMode]}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            item.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.status === "active" ? "Đang dùng" : "Ngừng dùng"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm transition-colors focus:outline-none"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
}
