import { renderAsync } from "docx-preview";
import * as XLSX from "xlsx";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;
type Payload = { name: string; base64: string; extension: string };
declare global { interface Window { renderBlogDocument: (payload: Payload) => Promise<void>; ReactNativeWebView?: { postMessage: (value: string) => void } } }
const content = document.getElementById("content")!, toolbar = document.getElementById("toolbar")!, status = document.getElementById("status")!;
const notify = (type: string, message?: string) => { const value = { type, message }; window.ReactNativeWebView?.postMessage(JSON.stringify(value)); if (window.parent !== window) window.parent.postMessage(value, "*"); };
let generation = 0;
let destroyPdf: (() => Promise<void>) | undefined;
function button(label: string, action: () => void) { const result = document.createElement("button"); result.textContent = label; result.onclick = action; toolbar.append(result); return result; }
window.renderBlogDocument = async (payload: Payload) => {
  const version = ++generation;
  await destroyPdf?.(); destroyPdf = undefined;
  content.replaceChildren(); toolbar.replaceChildren(); status.textContent = "Đang xử lý tài liệu…";
  try {
    if (!payload || typeof payload.base64 !== "string" || payload.base64.length > 28 * 1024 * 1024) throw new Error("Tệp không hợp lệ hoặc quá lớn.");
    const bytes = Uint8Array.from(atob(payload.base64), char => char.charCodeAt(0));
    if (payload.extension === "pdf") {
      const task = getDocument({ data: bytes, isEvalSupported: false, enableXfa: false });
      destroyPdf = () => task.destroy();
      const pdf = await task.promise;
      if (version !== generation) return;
      let pageNumber = 1, rendering = false;
      const previous = button("Trang trước", () => { if (!rendering && pageNumber > 1) { pageNumber--; void renderPage(); } });
      const label = document.createElement("span"); toolbar.append(label);
      const next = button("Trang sau", () => { if (!rendering && pageNumber < pdf.numPages) { pageNumber++; void renderPage(); } });
      async function renderPage() {
        rendering = true; previous.disabled = next.disabled = true;
        try {
          const page = await pdf.getPage(pageNumber);
          const unscaled = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: Math.min(1600 / unscaled.width, Math.max(320, window.innerWidth - 16) * Math.min(devicePixelRatio || 1, 2) / unscaled.width) });
          const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height;
          content.replaceChildren(canvas); label.textContent = pageNumber + " / " + pdf.numPages;
          await page.render({ canvas, viewport }).promise;
          status.textContent = ""; notify("loaded");
        } catch { status.textContent = "Không thể hiển thị trang PDF này."; notify("error", status.textContent); }
        finally { rendering = false; previous.disabled = pageNumber <= 1; next.disabled = pageNumber >= pdf.numPages; }
      }
      await renderPage();
    } else if (payload.extension === "docx") {
      await renderAsync(bytes, content, undefined, { ignoreWidth: true, ignoreHeight: true, inWrapper: true, renderAltChunks: false, useBase64URL: true });
      status.textContent = ""; notify("loaded");
    } else if (["xls", "xlsx"].includes(payload.extension)) {
      const workbook = XLSX.read(bytes, { type: "array", sheetRows: 10000, cellHTML: false });
      if (!workbook.SheetNames.length) throw new Error("Bảng tính không có trang dữ liệu.");
      const select = document.createElement("select"); select.setAttribute("aria-label", "Trang tính");
      workbook.SheetNames.forEach(name => { const option = document.createElement("option"); option.value = name; option.textContent = name; select.append(option); });
      toolbar.append(select);
      let rowPage = 0;
      const previous = button("Trước", () => { rowPage--; renderSheet(); });
      const label = document.createElement("span"); toolbar.append(label);
      const next = button("Sau", () => { rowPage++; renderSheet(); });
      function renderSheet() {
        const sheet = workbook.Sheets[select.value];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
        const pages = Math.max(1, Math.ceil(rows.length / 100)); rowPage = Math.max(0, Math.min(rowPage, pages - 1));
        label.textContent = (rowPage + 1) + " / " + pages; previous.disabled = rowPage === 0; next.disabled = rowPage === pages - 1;
        const table = document.createElement("table");
        rows.slice(rowPage * 100, rowPage * 100 + 100).forEach((row, index) => {
          const tr = table.insertRow(), number = document.createElement("th"); number.textContent = String(rowPage * 100 + index + 1); tr.append(number);
          row.slice(0, 200).forEach(value => { tr.insertCell().textContent = String(value); });
        });
        content.replaceChildren(table);
        status.textContent = !rows.length ? "Trang tính trống." : "Bản xem trước tối đa 10.000 dòng và 200 cột mỗi trang tính.";
        notify("loaded");
      }
      select.onchange = () => { rowPage = 0; renderSheet(); }; renderSheet();
    } else throw new Error("Định dạng chưa hỗ trợ. Với Word .doc, hãy lưu lại thành .docx.");
  } catch (error: any) { const message = error?.message || "Không thể xem trước tài liệu."; status.textContent = message; notify("error", message); }
};
document.addEventListener("click", event => { if ((event.target as Element)?.closest?.("a")) event.preventDefault(); }, true);
document.addEventListener("contextmenu", event => event.preventDefault());
window.addEventListener("message", event => { if (event.source === window.parent && event.data?.type === "document") void window.renderBlogDocument(event.data.payload); });
notify("ready");
