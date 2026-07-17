let baseImage: HTMLImageElement | null = null;
let baseImageLoading: Promise<HTMLImageElement> | null = null;
let originalHref = "";

function getIconLink(): HTMLLinkElement | null {
  return document.querySelector('link[rel="icon"]');
}

function loadBaseImage(): Promise<HTMLImageElement> {
  if (baseImage) return Promise.resolve(baseImage);
  if (baseImageLoading) return baseImageLoading;

  baseImageLoading = new Promise((resolve, reject) => {
    const link = getIconLink();
    originalHref = link?.getAttribute("href") || "/brand-icon.png";
    const img = new Image();
    img.onload = () => {
      baseImage = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = originalHref;
  });

  return baseImageLoading;
}

/** Vẽ số lượng chưa đọc lên favicon (chấm đỏ ở góc trên bên phải), hoặc khôi phục icon gốc khi count <= 0. */
export async function setFaviconBadge(count: number): Promise<void> {
  const link = getIconLink();
  if (!link) return;

  if (count <= 0) {
    if (originalHref) link.setAttribute("href", originalHref);
    return;
  }

  try {
    const img = await loadBaseImage();
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);

    const label = count > 99 ? "99+" : String(count);
    const badgeRadius = size * (label.length > 2 ? 0.36 : 0.3);
    const cx = size - badgeRadius - 1;
    const cy = badgeRadius + 1;

    ctx.beginPath();
    ctx.arc(cx, cy, badgeRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#e11d48";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${label.length > 2 ? badgeRadius * 0.85 : badgeRadius * 1.1}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy + 1);

    link.setAttribute("href", canvas.toDataURL("image/png"));
  } catch {
    // Favicon gốc tải lỗi (offline/CORS) — bỏ qua, giữ nguyên icon hiện tại.
  }
}
