const ALLOWED_TAGS = new Set([
  "A", "B", "BLOCKQUOTE", "BR", "CAPTION", "CODE", "DEL", "DIV", "EM", "H1", "H2", "H3", "H4", "H5", "H6",
  "HR", "I", "IMG", "LI", "OL", "P", "PRE", "S", "SPAN", "STRONG", "SUB", "SUP", "TABLE", "TBODY", "TD",
  "TFOOT", "TH", "THEAD", "TR", "U",
]);
const DROP_TAGS = new Set(["IFRAME", "OBJECT", "SCRIPT", "STYLE", "SVG", "MATH", "TEMPLATE"]);
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  A: new Set(["href", "title"]),
  IMG: new Set(["src", "alt", "title", "width", "height"]),
  TD: new Set(["colspan", "rowspan"]),
  TH: new Set(["colspan", "rowspan"]),
  OL: new Set(["start", "reversed"]),
};

function isSafeUrl(value: string) {
  const url = value.trim();
  if (!url || url.startsWith("\\")) return false;
  try {
    const protocol = new URL(url, "https://product-description.invalid/").protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function sanitizeProductDescriptionHtml(value?: string | null) {
  const html = String(value || "");
  if (typeof DOMParser === "undefined") return escapeHtml(html);
  if (!/<\/?[a-z][\s\S]*?>/i.test(html)) return escapeHtml(html).replace(/\r?\n/g, "<br>");

  const document = new DOMParser().parseFromString(html, "text/html");
  const cleanChildren = (parent: Node) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) continue;
      if (!(node instanceof Element)) {
        node.parentNode?.removeChild(node);
        continue;
      }

      const tag = node.tagName.toUpperCase();
      if (DROP_TAGS.has(tag)) {
        node.remove();
        continue;
      }
      cleanChildren(node);
      if (!ALLOWED_TAGS.has(tag)) {
        node.replaceWith(...Array.from(node.childNodes));
        continue;
      }

      const allowed = ALLOWED_ATTRIBUTES[tag] || new Set<string>();
      for (const attribute of Array.from(node.attributes)) {
        if (!allowed.has(attribute.name.toLowerCase()) || ((attribute.name === "href" || attribute.name === "src") && !isSafeUrl(attribute.value))) {
          node.removeAttribute(attribute.name);
        }
      }
      if (tag === "A" && node.hasAttribute("href")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer nofollow");
      }
    }
  };

  cleanChildren(document.body);
  return document.body.innerHTML;
}

export function productDescriptionToText(value?: string | null) {
  const html = String(value || "");
  if (!html) return "";
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script,style,iframe,object,svg,math").forEach((node) => node.remove());
  return (document.body.textContent || "").replace(/\s+/g, " ").trim();
}
