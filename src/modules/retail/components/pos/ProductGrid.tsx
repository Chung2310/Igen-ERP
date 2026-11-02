import React from "react";
import { ChevronDown, Folder, FolderOpen, Store, Tag } from "lucide-react";
import { ProductCard, type ProductGroup, groupProductsBySku } from "./ProductCard";
import type { RetailProduct } from "../../types";

export type ProductFolder = {
  code: string;
  name: string;
  children: ProductFolder[];
  groups: ProductGroup[];
  count: number;
};

export interface ProductFolderBranchProps {
  folder: ProductFolder;
  onAdd: (product: RetailProduct) => void;
  onOpenVariantSelector?: (group: ProductGroup) => void;
  depth?: number;
  expandAll?: boolean | null;
}

export function ProductFolderBranch({
  folder,
  onAdd,
  onOpenVariantSelector,
  depth = 1,
  expandAll,
}: ProductFolderBranchProps) {
  const [localExpanded, setLocalExpanded] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (expandAll !== null && expandAll !== undefined) {
      setLocalExpanded(expandAll);
    }
  }, [expandAll]);

  const expanded = localExpanded;
  const contentId = React.useId();

  const handleToggle = () => {
    setLocalExpanded(!expanded);
  };

  if (depth === 1) {
    return (
      <section className="min-w-0 rounded-2xl border border-slate-200/90 bg-white shadow-xs transition hover:border-slate-300">
        <button
          type="button"
          aria-label={folder.name}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={handleToggle}
          className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50/80 cursor-pointer select-none ${
            expanded ? "rounded-t-2xl border-b border-slate-100" : "rounded-2xl"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                expanded ? "bg-[#0866f5] text-white shadow-xs shadow-[#0866f5]/25" : "bg-[#edf3ff] text-[#0758d5]"
              }`}
            >
              <Folder aria-hidden="true" className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-bold text-slate-800 truncate">{folder.name}</span>
              <span className="block text-[11px] text-slate-500 font-medium">
                Danh mục chính · {folder.count} sản phẩm
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {folder.count} sản phẩm
            </span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-transform duration-200 ${
                expanded ? "rotate-180 text-[#0866f5] bg-[#edf3ff]" : "bg-slate-100/70"
              }`}
            >
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </div>
          </div>
        </button>

        <div id={contentId} hidden={!expanded} className="rounded-b-2xl bg-slate-50/30 p-3 sm:p-4 space-y-3">
          {folder.groups.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {folder.groups.map((group) => (
                <ProductCard
                  key={group.key}
                  group={group}
                  onAdd={onAdd}
                  onOpenVariantSelector={onOpenVariantSelector}
                />
              ))}
            </div>
          )}

          {folder.children.map((child) => (
            <ProductFolderBranch
              key={child.code}
              folder={child}
              onAdd={onAdd}
              onOpenVariantSelector={onOpenVariantSelector}
              depth={depth + 1}
              expandAll={expandAll}
            />
          ))}
        </div>
      </section>
    );
  }

  if (depth === 2) {
    return (
      <section className="min-w-0 rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-2xs transition hover:border-[#9ec1ff]">
        <button
          type="button"
          aria-label={folder.name}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={handleToggle}
          className="flex w-full items-center justify-between gap-2.5 text-left cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <FolderOpen aria-hidden="true" className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">{folder.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400 font-medium">{folder.count} sản phẩm</span>
            <ChevronDown
              aria-hidden="true"
              className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                expanded ? "rotate-180 text-amber-600" : ""
              }`}
            />
          </div>
        </button>

        <div id={contentId} hidden={!expanded} className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2.5">
          {folder.groups.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {folder.groups.map((group) => (
                <ProductCard
                  key={group.key}
                  group={group}
                  onAdd={onAdd}
                  onOpenVariantSelector={onOpenVariantSelector}
                />
              ))}
            </div>
          )}

          {folder.children.map((child) => (
            <ProductFolderBranch
              key={child.code}
              folder={child}
              onAdd={onAdd}
              onOpenVariantSelector={onOpenVariantSelector}
              depth={depth + 1}
              expandAll={expandAll}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0 border-l-2 border-amber-300 pl-3 py-1 space-y-2">
      <button
        type="button"
        aria-label={folder.name}
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-2 text-left cursor-pointer select-none py-1 hover:text-[#0758d5]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Tag aria-hidden="true" className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-700 truncate">{folder.name}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-slate-400 font-medium">{folder.count} sản phẩm</span>
          <ChevronDown
            aria-hidden="true"
            className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${
              expanded ? "rotate-180 text-[#0866f5]" : ""
            }`}
          />
        </div>
      </button>

      <div id={contentId} hidden={!expanded} className="pt-2 space-y-2">
        {folder.groups.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {folder.groups.map((group) => (
              <ProductCard
                key={group.key}
                group={group}
                onAdd={onAdd}
                onOpenVariantSelector={onOpenVariantSelector}
              />
            ))}
          </div>
        )}

        {folder.children.map((child) => (
          <ProductFolderBranch
            key={child.code}
            folder={child}
            onAdd={onAdd}
            onOpenVariantSelector={onOpenVariantSelector}
            depth={depth + 1}
            expandAll={expandAll}
          />
        ))}
      </div>
    </section>
  );
}

export interface ProductGridProps {
  products: RetailProduct[];
  onAdd: (product: RetailProduct) => void;
  onOpenVariantSelector?: (group: ProductGroup) => void;
  searchQuery?: string;
}

export function ProductGrid({
  products,
  onAdd,
  onOpenVariantSelector,
  searchQuery,
}: ProductGridProps) {
  const groups = React.useMemo(() => groupProductsBySku(products), [products]);
  const tree = React.useMemo(() => {
    const root: ProductFolder = { code: "", name: "", children: [], groups: [], count: 0 };
    for (const group of groups) {
      const product = group.variants[0];
      const path = product.categoryPath?.length
        ? product.categoryPath
        : [{ code: product.category || "", name: product.category || "Chưa phân loại" }];
      let parent = root;
      for (const category of path) {
        let child = parent.children.find((item) => item.code === category.code);
        if (!child) {
          child = { ...category, children: [], groups: [], count: 0 };
          parent.children.push(child);
        }
        child.count += 1;
        parent = child;
      }
      parent.groups.push(group);
    }
    return root.children;
  }, [groups]);

  const isSearching = Boolean(searchQuery && searchQuery.trim().length > 0);
  const effectiveExpandAll = isSearching ? true : null;

  if (groups.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 shadow-2xs">
        <Store className="mb-2 h-10 w-10 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">Không tìm thấy sản phẩm nào.</p>
        <p className="text-xs text-slate-400">Hãy thử từ khóa khác hoặc quét mã vạch.</p>
      </div>
    );
  }

  return (
    <div aria-label="Thư mục sản phẩm" className="space-y-3">
      {tree.map((folder) => (
        <ProductFolderBranch
          key={folder.code}
          folder={folder}
          onAdd={onAdd}
          onOpenVariantSelector={onOpenVariantSelector}
          depth={1}
          expandAll={effectiveExpandAll}
        />
      ))}
    </div>
  );
}

export default ProductGrid;
