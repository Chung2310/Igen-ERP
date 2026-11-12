/** Code-owned disambiguation; the model still extracts user-supplied field values. */
export function quotationIntent(text: string): { domain: boolean; actionId?: string } {
  const t = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
  if (/\b(?:sua chua|bao hanh|phieu sua|pos|ca ban hang|don ban le|lao dong|nhan su)\b/.test(t)) return { domain: false };
  const domain = /\b(?:bao gia|du toan|bang gia|nghiem thu|quyet toan)\b/.test(t) || /\b(?:bg|nt)-[\w-]+/i.test(t);
  if (!domain || /\b(?:la gi|huong dan|cach (?:tao|lap|su dung))\b/.test(t)) return { domain: false };
  const create = /\b(?:tao|lap|them|nhap moi)\b/.test(t);
  const update = /\b(?:cap nhat|sua|chinh sua|bo sung|thay doi)\b/.test(t);
  const remove = /\b(?:xoa|go bo)\b/.test(t);
  const exportFile = /\b(?:xuat|tai|download)\b/.test(t) && /\b(?:file|tep|excel|xlsx|word|docx|pdf|tai lieu|quyet toan|bao gia|du toan|hop dong|nghiem thu|phuong an)\b/.test(t);
  let id: string | undefined;
  if (/\b(?:mau|template)\b/.test(t) && !create && !/\b(?:duyet|lap|tinh lai|theo mau|dung mau)\b/.test(t)) {
    id = remove ? "template.delete" : update && /\b(?:loai|chuyen)\b/.test(t) ? "template.update" : exportFile ? "template.download" : !update ? "template.list" : undefined;
  } else if (/\bbang gia\b/.test(t) && !/\b(?:lap|tao) (?:bao gia|du toan)\b/.test(t)) {
    id = /\b(?:nhap|import)\b/.test(t) && /\b(?:excel|csv|tep|file)\b/.test(t) ? "catalog.import"
      : /\b(?:hang loat|tang gia|giam gia)\b/.test(t) ? "catalog.bulk"
      : /\bkhoi phuc\b/.test(t) ? "catalog.restore" : /\b(?:nhan ban|sao chep)\b/.test(t) ? "catalog.duplicate" : remove ? "catalog.delete" : update ? "catalog.update" : create ? "catalog.create" : "catalog.list";
  } else if (/\b(?:ben ban|thong tin doanh nghiep)\b/.test(t)) id = update ? "settings.update" : "settings.list";
  else if (/\b(?:han muc|luot ai)\b/.test(t)) id = "usage";
  else if (/\b(?:tong quan|thong ke)\b/.test(t)) id = "overview";
  else if (/\b(?:tien do|file moi nhat)\b/.test(t)) id = "export.latest";
  else if (/\b(?:file|tep)\b/.test(t) && /\b(?:danh sach|liet ke|tra cuu|tim|xem)\b/.test(t) && !/\bchi tiet\b/.test(t)) id = "file.list";
  else if (/\b(?:tai|download)\b/.test(t) && /\b(?:file|tep)\b/.test(t)) id = "file.download";
  else if (/\b(?:nghiem thu|quyet toan)\b/.test(t)) id = exportFile ? /\bquyet toan\b/.test(t) ? "acceptance.settlement" : "acceptance.export" : /\b(?:hoan tat|hoan thanh)\b/.test(t) ? "acceptance.complete" : update ? "acceptance.update" : create ? "acceptance.create" : /\bchi tiet\b/.test(t) ? "acceptance.detail" : "acceptance.list";
  else if (/\bhop dong\b/.test(t)) id = /\b(?:da ky|xac nhan ky|xac nhan.*ky)\b/.test(t) ? "contract.sign" : exportFile ? "contract.export" : update ? "contract.update" : create ? "contract.create" : /\bchi tiet\b/.test(t) ? "contract.detail" : "contract.list";
  else if (/\b(?:ngan sach|phuong an)\b/.test(t)) id = exportFile ? "budget.export" : /\btinh lai\b/.test(t) ? "budget.recalculate" : /\bgia dinh\b/.test(t) && update ? "budget.assumption" : /\b(?:tra loi|cau hoi)\b/.test(t) && update ? "budget.answer" : /\bso luong\b/.test(t) && update ? "budget.quantity" : /\bhang muc.*thieu\b/.test(t) && update ? "budget.missing" : create || /\bde xuat\b/.test(t) ? "budget.create" : "budget.list";
  else if (/\byeu cau\b/.test(t) && !/\bda phan tich\b/.test(t) && /\b(?:phan tich|yeu cau lap du toan|yeu cau du toan)\b/.test(t)) id = /\bphan tich\b/.test(t) ? "request.analyze" : create ? "request.create" : "request.list";
  else if (/\bgui duyet\b/.test(t)) id = "quote.submit-review";
  else if (/\b(?:tra lai|tu choi)\b/.test(t)) id = "quote.reject";
  else if (/\bduyet\b/.test(t)) id = "quote.approve";
  else if (/\b(?:thu lai|tao lai file)\b/.test(t)) id = "quote.export-retry";
  else if (/\btinh lai\b/.test(t)) id = "quote.recalculate";
  else if (exportFile) id = /\bpdf\b/.test(t) ? "quote.pdf" : "quote.export";
  else if (remove) id = "quote.delete";
  else if (update) id = "quote.update";
  else if (create) id = /\bdu toan\b/.test(t) ? /\btu bao gia\b/.test(t) ? "estimate.from-customer" : "estimate.create" : "customer-quote.create";
  else if (/\b(?:de xuat|goi y)\b/.test(t)) id = "customer-quote.suggest";
  else if (/\b(?:chi tiet|thong tin)\b/.test(t)) id = "quote.detail";
  else if (/\b(?:xem|tra cuu|danh sach|liet ke|tim)\b/.test(t)) id = "quote.list";
  return { domain: true, ...(id ? { actionId: `quotation.${id}` } : {}) };
}
