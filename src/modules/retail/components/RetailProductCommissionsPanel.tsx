import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Folder, Package, Percent, Search, Settings2, Smartphone, X } from "lucide-react";
import { apiFetch } from "../../shared/lib/apiFetch";
import { ErpCard, ErpLoadingState, ErpPrimaryButton, erpInputClass } from "../../student-management/components/Erp/ErpUI";
import { cn } from "../../student-management/lib/utils";

type Rule = { kind: "phone"; amount: number } | { kind: "accessory"; rateBps: number };
type Product = { _id: string; name: string; categoryCode: string };
type Variant = { _id: string; productId: string; sku: string; displayName?: string; trackingMode: string };
type Category = { code: string; name: string; parentCode?: string };
type Data = { products: Product[]; variants: Variant[]; categories: Category[]; configurations: Array<{ sku: string; rule: Rule | null }>; legacyRules: Array<{ sku: string; partnerId: string; ratePercent: number; effectiveFrom?: string }> };
type Node = { key: string; name: string; children: Node[]; sku?: string; trackingMode?: string; type: "category" | "product" | "variant" };

const fieldClass = erpInputClass(false);
const rate = (rule: Rule) => rule.kind === "phone" ? `${Number(rule.amount).toLocaleString("vi-VN")} đ/máy` : `${rule.rateBps / 100}%`;
const skuList = (node: Node): string[] => node.sku ? [node.sku] : node.children.flatMap(skuList);

function buildTree(data: Data) {
  const categories = new Map(data.categories.map((category) => [category.code.trim().toUpperCase(), {
    key: `category-${category.code}`, name: category.name, children: [] as Node[], type: "category" as const,
  }]));
  const roots: Node[] = [];
  for (const category of data.categories) {
    const key = category.code.trim().toUpperCase();
    const node = categories.get(key)!;
    const parent = category.parentCode?.trim().toUpperCase();
    const visited = new Set([key]);
    let cursor = parent;
    while (cursor && categories.has(cursor) && !visited.has(cursor)) {
      visited.add(cursor);
      cursor = data.categories.find((item) => item.code.trim().toUpperCase() === cursor)?.parentCode?.trim().toUpperCase();
    }
    if (cursor && visited.has(cursor) || !parent || !categories.has(parent)) roots.push(node);
    else categories.get(parent)!.children.push(node);
  }
  for (const product of data.products) {
    const variants = data.variants.filter((variant) => String(variant.productId) === String(product._id));
    if (!variants.length) continue;
    const node: Node = {
      key: `product-${product._id}`, name: product.name, type: "product",
      children: variants.map((variant) => ({ key: `variant-${variant._id}`, name: variant.displayName || product.name, sku: variant.sku, trackingMode: variant.trackingMode, children: [], type: "variant" })),
    };
    const category = categories.get(product.categoryCode?.trim().toUpperCase());
    if (category) category.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export default function RetailProductCommissionsPanel({ companyCode }: { companyCode?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "configured" | "default">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<Rule["kind"]>("phone");
  const [value, setValue] = useState("200000");
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  async function load() {
    if (!companyCode) return;
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch<{ data: Data }>("/retail/partners/product-commissions", { params: { companyCode } });
      setData(response.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được hoa hồng sản phẩm.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [companyCode]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (editing.length && dialog && !dialog.open) dialog.showModal();
  }, [editing]);

  const configured = useMemo(() => new Map(data?.configurations.map((item) => [item.sku, item.rule]) || []), [data]);
  const tree = useMemo(() => data ? buildTree(data) : [], [data]);
  const visibleTree = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("vi");
    function visit(node: Node, inherited = false): Node | null {
      const matches = inherited || !search || `${node.name} ${node.sku || ""}`.toLocaleLowerCase("vi").includes(search);
      if (node.sku) {
        if (!matches || filter === "configured" && !configured.get(node.sku) || filter === "default" && configured.get(node.sku)) return null;
        return node;
      }
      const children = node.children.map((child) => visit(child, matches)).filter((child): child is Node => !!child);
      return children.length ? { ...node, children } : null;
    }
    return tree.map((node) => visit(node)).filter((node): node is Node => !!node);
  }, [tree, query, filter, configured]);
  const visibleSkus = useMemo(() => visibleTree.flatMap(skuList), [visibleTree]);

  function select(skus: string[], checked: boolean) {
    setSelected((current) => checked ? current.filter((sku) => !skus.includes(sku)) : [...new Set([...current, ...skus])]);
  }

  function configure(skus: string[]) {
    if (!skus.length) return;
    const rule = configured.get(skus[0]);
    const variant = data?.variants.find((item) => item.sku === skus[0]);
    const nextKind = rule?.kind || (variant?.trackingMode === "serial" ? "phone" : "accessory");
    setKind(nextKind);
    setValue(rule ? rule.kind === "phone" ? String(rule.amount) : String(rule.rateBps / 100) : nextKind === "phone" ? "200000" : "10");
    setFormError("");
    setEditing(skus);
  }

  function close() {
    if (busy) return;
    dialogRef.current?.close();
    setEditing([]);
  }

  async function save(event?: FormEvent<HTMLFormElement>, reset = false) {
    event?.preventDefault();
    if (busy || !companyCode || !editing.length || editing.length > 500) return;
    const number = Number(value);
    if (!reset && (!Number.isFinite(number) || number <= 0 || kind === "accessory" && number > 100)) {
      setFormError("Mức riêng phải lớn hơn 0 và tỷ lệ không quá 100%.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await apiFetch("/retail/partners/product-commissions", {
        method: "PUT", params: { companyCode },
        body: JSON.stringify({ skus: editing, rule: reset ? null : kind === "phone" ? { kind, amount: number } : { kind, rateBps: Math.round(number * 100) } }),
      });
      dialogRef.current?.close();
      setEditing([]);
      setSelected([]);
      setMessage(reset ? "Đã khôi phục về chính sách chung hoặc chính sách CTV bán lẻ." : "Đã lưu mức hoa hồng sản phẩm.");
      await load();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Không lưu được hoa hồng sản phẩm.");
    } finally {
      setBusy(false);
    }
  }

  function renderNode(node: Node): React.ReactNode {
    const skus = skuList(node);
    const checked = skus.length > 0 && skus.every((sku) => selected.includes(sku));
    const partial = !checked && skus.some((sku) => selected.includes(sku));
    const isCollapsed = collapsed.has(node.key);
    const childId = `retail-commission-${node.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    if (node.sku) {
      const rule = configured.get(node.sku);
      const legacy = data?.legacyRules.filter((item) => item.sku === node.sku) || [];
      return <li key={node.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
        <div className="flex min-w-0 items-center gap-2"><input type="checkbox" aria-label={`Chọn ${node.name} (${node.sku})`} checked={checked} onChange={() => select(skus, checked)} className="size-4 accent-primary" /><span className="min-w-0"><span className="block truncate text-sm font-medium text-on-surface">{node.name}</span><span className="block text-xs text-on-surface-variant">{node.sku} · {rule ? `Mức riêng: ${rate(rule)}` : legacy.length ? `Cấu hình cũ: ${legacy.map((item) => `${item.ratePercent}% (${item.partnerId ? "CTV riêng" : "chung"})`).join(", ")} · dùng khi chưa có chính sách mới` : "Áp dụng chính sách chung / CTV"}</span></span></div>
        <button type="button" onClick={() => configure(skus)} className="min-h-9 rounded-lg border border-outline-variant px-3 text-xs font-semibold text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">Cấu hình</button>
      </li>;
    }
    return <li key={node.key} className="rounded-xl border border-outline-variant bg-surface-container-lowest">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <button type="button" aria-label={`${isCollapsed ? "Mở rộng" : "Thu gọn"} ${node.name}`} aria-expanded={!isCollapsed} aria-controls={childId} onClick={() => setCollapsed((current) => { const next = new Set(current); if (next.has(node.key)) next.delete(node.key); else next.add(node.key); return next; })} className="flex size-8 items-center justify-center rounded-lg hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">{isCollapsed ? <ChevronRight aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}</button>
        <input type="checkbox" aria-label={`Chọn toàn bộ ${node.name}`} checked={checked} ref={(element) => { if (element) element.indeterminate = partial; }} onChange={() => select(skus, checked)} className="size-4 accent-primary" />
        {node.type === "category" ? <Folder aria-hidden="true" className="size-4 text-primary" /> : <Smartphone aria-hidden="true" className="size-4 text-primary" />}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-on-surface">{node.name} <span className="text-xs font-normal text-on-surface-variant">({skus.length} SKU)</span></span>
        <button type="button" onClick={() => configure(skus)} className="min-h-9 rounded-lg border border-outline-variant px-3 text-xs font-semibold text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">Cấu hình {node.type === "category" ? "nhóm" : "sản phẩm"}</button>
      </div>
      <ul id={childId} hidden={isCollapsed} className="space-y-2 border-t border-outline-variant p-3">{node.children.map(renderNode)}</ul>
    </li>;
  }

  const configuredCount = data?.variants.filter((variant) => configured.get(variant.sku)).length || 0;
  return <section aria-labelledby="retail-product-commission-heading" className="space-y-4">
    <ErpCard className="border-outline-variant p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Package aria-hidden="true" className="size-5 text-primary" /><h2 id="retail-product-commission-heading" className="text-balance text-lg font-semibold text-on-surface">Hoa hồng sản phẩm</h2></div><p className="mt-1 text-pretty text-sm text-on-surface-variant">Mức riêng theo SKU áp dụng cho mọi cộng tác viên bán lẻ và được ưu tiên hơn chính sách chung hoặc chính sách CTV.</p></div><button type="button" onClick={() => void load()} className="min-h-10 rounded-lg border border-outline-variant px-3 text-sm font-semibold text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">Tải lại</button></div>
      {data && <div className="mt-4 grid grid-cols-2 gap-2 border-t border-outline-variant pt-4 sm:grid-cols-4">{[["Nhóm ngành hàng", data.categories.length], ["Sản phẩm", data.products.length], ["Tổng SKU", data.variants.length], ["Đã đặt mức riêng", configuredCount]].map(([label, count]) => <div key={label} className="rounded-lg border border-outline-variant bg-surface p-3"><p className="text-pretty text-xs text-on-surface-variant">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-on-surface">{count}</p></div>)}</div>}
      {message && <p role="status" className="mt-3 text-sm text-on-surface-variant">{message}</p>}
    </ErpCard>

    <ErpCard className="border-outline-variant p-4 sm:p-5"><div className="flex flex-wrap items-center gap-3"><label className="relative min-w-48 flex-1"><span className="sr-only">Tìm nhóm, sản phẩm hoặc SKU</span><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm nhóm, sản phẩm, SKU..." className={cn(fieldClass, "pl-9")} /></label><div role="group" aria-label="Lọc cấu hình SKU" className="flex flex-wrap gap-1">{([["all", "Tất cả"], ["configured", "Có mức riêng"], ["default", "Chính sách chung"]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={cn("min-h-10 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary", filter === key ? "bg-primary text-on-primary" : "border border-outline-variant text-on-surface hover:bg-surface")}>{label}</button>)}</div></div>
      {error ? <p role="alert" className="mt-4 text-sm text-error">{error} <button type="button" onClick={() => void load()} className="font-semibold underline">Thử lại</button></p> : loading ? <div role="status" aria-live="polite"><ErpLoadingState message="Đang tải sản phẩm..." /></div> : <>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant pb-3"><span className="text-xs text-on-surface-variant">{visibleSkus.length} SKU phù hợp · {selected.length} SKU đã chọn</span><button type="button" disabled={!visibleSkus.length} onClick={() => select(visibleSkus, visibleSkus.every((sku) => selected.includes(sku)))} className="min-h-9 rounded-lg border border-outline-variant px-3 text-xs font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{visibleSkus.every((sku) => selected.includes(sku)) && visibleSkus.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}</button></div>
        {selected.length > 0 && <div className="my-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary bg-primary-container p-3"><span className="text-sm font-semibold text-on-surface">Đang chọn {selected.length} SKU</span><div className="flex flex-wrap gap-2"><ErpPrimaryButton type="button" icon={Settings2} onClick={() => configure(selected)} className="min-h-10 focus-visible:outline-2 focus-visible:outline-primary">Cấu hình đã chọn</ErpPrimaryButton><button type="button" onClick={() => setSelected([])} className="min-h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary">Bỏ chọn</button></div></div>}
        {visibleTree.length ? <ul className="mt-3 space-y-3">{visibleTree.map(renderNode)}</ul> : <p className="mt-3 rounded-xl border border-outline-variant p-5 text-pretty text-sm text-on-surface-variant">{data?.variants.length ? "Không có SKU phù hợp. Thử đổi từ khóa hoặc bộ lọc." : "Chưa có sản phẩm bán lẻ. Khai báo sản phẩm trong danh mục để cấu hình hoa hồng."}</p>}
      </>}
    </ErpCard>

    {editing.length > 0 && <dialog ref={dialogRef} aria-labelledby="retail-product-commission-dialog-heading" onClose={() => setEditing([])} onCancel={(event) => { if (busy) event.preventDefault(); }} className="m-auto max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-on-surface shadow-2xl backdrop:bg-slate-950/60 sm:p-6">
      <form onSubmit={(event) => void save(event)} aria-busy={busy} className="space-y-4"><div className="flex items-start justify-between gap-3 border-b border-outline-variant pb-3"><div><h3 id="retail-product-commission-dialog-heading" className="text-balance text-lg font-semibold">Cấu hình hoa hồng {editing.length} SKU</h3><p className="mt-1 text-pretty text-sm text-on-surface-variant">Mức riêng áp dụng cho mọi cộng tác viên bán lẻ.</p></div><button type="button" aria-label="Đóng cấu hình hoa hồng sản phẩm" onClick={close} disabled={busy} className="rounded-lg p-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><X aria-hidden="true" className="size-4" /></button></div>
        {editing.length > 500 && <p role="alert" className="text-sm text-error">Chỉ cấu hình tối đa 500 SKU mỗi lần.</p>}
        {formError && <p role="alert" className="text-sm text-error">{formError}</p>}
        <fieldset disabled={busy} className="space-y-3"><legend className="text-sm font-semibold">Loại hoa hồng</legend><div className="grid gap-2 sm:grid-cols-2"><label className="flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant p-3 text-sm"><input type="radio" name="retail-commission-kind" value="phone" checked={kind === "phone"} onChange={() => { setKind("phone"); setValue("200000"); }} className="size-4 accent-primary" /><Smartphone aria-hidden="true" className="size-4" />Điện thoại / thiết bị (đ/máy)</label><label className="flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant p-3 text-sm"><input type="radio" name="retail-commission-kind" value="accessory" checked={kind === "accessory"} onChange={() => { setKind("accessory"); setValue("10"); }} className="size-4 accent-primary" /><Percent aria-hidden="true" className="size-4" />Phụ kiện (% doanh thu)</label></div></fieldset>
        <label className="grid gap-1 text-sm font-medium">Mức riêng ({kind === "phone" ? "VNĐ/máy" : "% doanh thu"})<input className={fieldClass} type="number" min={kind === "phone" ? "1" : "0.01"} max={kind === "accessory" ? "100" : undefined} step={kind === "phone" ? "1" : "0.01"} required value={value} onChange={(event) => setValue(event.target.value)} disabled={busy} /></label>
        <div className="flex flex-wrap gap-2"><span className="self-center text-xs text-on-surface-variant">Mức nhanh:</span>{(kind === "phone" ? [150000, 200000, 250000, 300000] : [10, 12, 15]).map((preset) => <button key={preset} type="button" onClick={() => setValue(String(preset))} disabled={busy} className="min-h-9 rounded-lg border border-outline-variant px-2 text-xs font-semibold text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{kind === "phone" ? `${preset / 1000}k` : `${preset}%`}</button>)}</div>
        <p className="text-pretty text-xs text-on-surface-variant">“Dùng chính sách” gỡ mức riêng, sau đó SKU áp dụng chính sách CTV hoặc chính sách chung.</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant pt-4"><button type="button" onClick={close} disabled={busy} className="min-h-11 rounded-lg border border-outline-variant px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Hủy</button><button type="button" onClick={() => void save(undefined, true)} disabled={busy || editing.length > 500} className="min-h-11 rounded-lg border border-outline-variant px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Dùng chính sách</button><ErpPrimaryButton type="submit" icon={Settings2} disabled={busy || editing.length > 500} className="min-h-11 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{busy ? "Đang lưu..." : "Lưu cấu hình"}</ErpPrimaryButton></div>
      </form>
    </dialog>}
  </section>;
}
