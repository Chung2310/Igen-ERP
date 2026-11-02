/** Read-only evidence matching. Never substitute today's price/average or an arbitrary receipt. */
export function resolveSaleCost(order: any, item: any, index: number, ledger: any[], receipts: any[], otherSales: any[] = [], acquisitions: any[] = []) {
  const positive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
  if (item.stockLedgerId || item.stockWarehouseId) {
    const cost = linkedStockCost(order, String(order._id), item, index, ledger, false);
    return { cost, costBasis: cost === null ? "missing" : "stock_issue", costReference: cost === null ? undefined : item.stockLedgerId };
  }
  if (positive(item.unitCost) && positive(item.quantity)) return { cost: item.unitCost * item.quantity, costBasis: "order_snapshot" };
  const sameScope = (r: any) => r.companyCode === order.companyCode && r.branchId === order.branchId;
  const sameItem = (r: any) => r.sku === item.sku && String(r.variantId || r.productId) === String(item.variantId || item.productId);
  const out = ledger.filter(r => sameScope(r) && r.sourceType === "retail-order" && String(r.sourceId) === String(order._id) && r.sourceLine === index && r.direction === "out" && r.purpose === "sale" && sameItem(r));
  if (out.length === 1 && out[0].quantity === item.quantity && positive(out[0].unitCost)) return { cost: out[0].unitCost * item.quantity, costBasis: "stock_issue", costReference: out[0].sourceCode || String(out[0]._id) };
  const serials: string[] = item.serialNumbers || [];
  const codes: string[] = item.internalBarcodes || [];
  const ids = serials.length ? serials : codes;
  const soldAt = new Date(order.confirmedAt || order.completedAt || order.createdAt).getTime();
  const soldPreviously = otherSales.some(o => sameScope(o) && String(o._id) !== String(order._id) && new Date(o.confirmedAt || o.completedAt || o.createdAt).getTime() <= soldAt && (o.items || []).some((i: any) => sameItem(i) && (serials.length ? i.serialNumbers || [] : i.internalBarcodes || []).some((id: string) => ids.includes(id))));
  // A repeated identifier after returns/re-purchase is ambiguous; do not guess a receipt.
  if (!soldPreviously && ids.length === item.quantity && new Set(ids).size === ids.length && Number.isFinite(soldAt)) {
    const matches = ids.map(id => receipts.flatMap(r => {
      const receivedAt = new Date(r.confirmedAt || r.receivedAt || r.createdAt).getTime();
      if (!sameScope(r) || r.status !== "confirmed" || !Number.isFinite(receivedAt) || receivedAt > soldAt) return [];
      return (r.items || []).filter((line: any) => sameItem(line) && positive(line.unitCost) && (serials.length ? (line.serialNumbers || []).includes(id) || (line.unitDetails || []).some((u: any) => u.serialNumber === id) : (line.unitDetails || []).some((u: any) => u.internalBarcode === id || (u.barcodeAliases || []).includes(id)))).map((line: any) => ({ cost: line.unitCost, reference: r.receiptCode }));
    }));
    if (matches.every(m => m.length === 1)) return { cost: matches.reduce((s, m) => s + m[0].cost, 0), costBasis: "receipt_identifier", costReference: [...new Set(matches.map(m => m[0].reference))].join(", ") };
  }

  // Serialized resales require evidence of re-acquisition after the previous sale.
  if (ids.length === item.quantity && new Set(ids).size === ids.length && Number.isFinite(soldAt)) {
    const costs = ids.map(id => {
      const sales = otherSales.filter(o => sameScope(o) && String(o._id) !== String(order._id) &&
        new Date(o.confirmedAt || o.completedAt || o.createdAt).getTime() <= soldAt &&
        (o.items || []).some((i: any) => sameItem(i) && (serials.length ? i.serialNumbers || [] : i.internalBarcodes || []).includes(id)));
      if (!sales.length) return null;
      const lastSale = Math.max(...sales.map(o => new Date(o.confirmedAt || o.completedAt || o.createdAt).getTime()));
      const candidates = acquisitions.filter(a => sameScope(a) && +new Date(a.createdAt) > lastSale && +new Date(a.createdAt) < soldAt)
        .flatMap(a => (a.items || []).map((line: any, lineIndex: number) => ({ a, line, lineIndex })))
        .filter(({ line }: any) => sameItem(line) && (serials.length ? line.serialNumbers || [] : line.internalBarcodes || []).includes(id));
      if (candidates.length !== 1) return null;
      const { a, line, lineIndex } = candidates[0];
      const entries = ledger.filter(e => sameScope(e) && sameItem(e) && e.sourceType === "retail-after-sale" &&
        String(e.sourceId) === String(a._id) && e.sourceLine === lineIndex && e.direction === "in" &&
        e.purpose === "purchase" && +new Date(e.createdAt) < soldAt);
      if (a.type !== "buyback" || !positive(line.unitAmount) || entries.length !== 1 ||
        entries[0].quantity !== line.quantity || entries[0].unitCost !== line.unitAmount) return null;
      return { cost: line.unitAmount, reference: a.code };
    });
    if (costs.every(c => c !== null)) return { cost: costs.reduce((sum, c) => sum + c!.cost, 0),
      costBasis: "buyback_identifier", costReference: [...new Set(costs.map(c => c!.reference))].join(", ") };
  }
  // Quantity stock: replay this warehouse up to the exact issue, never today's average.
  if (!ids.length && item.trackingMode !== "serial" && out.length === 1 && out[0].quantity === item.quantity && out[0].warehouseId) {
    const target = out[0];
    const end = +new Date(target.createdAt);
    const history = ledger.filter(e => sameScope(e) && sameItem(e) && e.warehouseId === target.warehouseId && +new Date(e.createdAt) <= end)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    let quantity = 0, value = 0;
    const references = new Set<string>();
    for (let n = 0; n < history.length && Number.isFinite(end); n++) {
      const e = history[n];
      if (history[n + 1] && +new Date(history[n + 1].createdAt) === +new Date(e.createdAt)) break;
      if (!positive(e.quantity) || e.quantityDelta !== (e.direction === "in" ? e.quantity : -e.quantity)) break;
      if (e === target) {
        if (quantity >= item.quantity && value > 0) return { cost: value / quantity * item.quantity,
          costBasis: "historical_average", costReference: [...references].join(", ") };
        break;
      }
      if (e.direction === "in") {
        if (!positive(e.unitCost)) break;
        if (e.sourceType === "goods-receipt") {
          const source = receipts.filter(r => sameScope(r) && String(r._id) === String(e.sourceId) && r.status === "confirmed" && r.warehouseId === e.warehouseId);
          const line = source.length === 1 ? source[0].items?.[e.sourceLine] : undefined;
          if (!line || !sameItem(line) || line.quantity !== e.quantity || line.unitCost !== e.unitCost) break;
        } else if (e.purpose !== "opening") break;
        value += e.quantity * e.unitCost;
        quantity += e.quantity;
        references.add(e.sourceCode || String(e.sourceId));
      } else if (e.direction === "out" && quantity >= e.quantity) {
        value -= value / quantity * e.quantity;
        quantity -= e.quantity;
        if (quantity === 0) { value = 0; references.clear(); }
      } else break;
    }
  }
  return { cost: null, costBasis: "missing", costReference: undefined };
}

function linkedStockCost(scope: any, orderId: string, item: any, index: number, ledger: any[], partial: boolean): number | null {
  const matches = ledger.filter((entry) => String(entry._id) === item.stockLedgerId);
  if (matches.length !== 1) return null;
  const entry = matches[0];
  if (!item.stockWarehouseId || entry.companyCode !== scope.companyCode || entry.branchId !== scope.branchId
    || entry.warehouseId !== item.stockWarehouseId || entry.sourceType !== "retail-order" || String(entry.sourceId) !== orderId
    || entry.sourceLine !== index || entry.direction !== "out" || entry.purpose !== "sale"
    || entry.sku !== item.sku || String(entry.variantId || entry.productId) !== String(item.variantId || item.productId)
    || !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !Number.isSafeInteger(entry.quantity)
    || (partial ? entry.quantity < item.quantity : entry.quantity !== item.quantity) || entry.quantityDelta !== -entry.quantity
    || !Number.isFinite(item.unitCost) || item.unitCost < 0 || entry.unitCost !== item.unitCost) return null;
  return item.unitCost * item.quantity;
}

export function resolveReturnCost(doc: any, item: any, ledger: any[]): number | null {
  if (item.stockLedgerId || item.stockWarehouseId) return linkedStockCost(doc, String(doc.orderId), item, item.orderLineIndex, ledger, true);
  // Preserve the old evidence policy for historical snapshots without explicit posting links.
  return Number.isFinite(item.unitCost) && item.unitCost > 0 && Number.isFinite(item.quantity) && item.quantity > 0 ? item.unitCost * item.quantity : null;
}
