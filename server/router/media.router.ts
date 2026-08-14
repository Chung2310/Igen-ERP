import { Router, type RequestHandler } from "express";
import Joi from "joi";
import { mediaController } from "../controller/media.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth, requirePermission } from "../middleware/auth";
import https from "https";
import http from "http";

export const mediaRouter = Router();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Dò định dạng file thật qua magic bytes (chữ ký nhị phân đầu file).
 * Dùng khi URL lưu trên Cloudinary không có đuôi mở rộng và client cũng
 * không gửi được filename gốc (dữ liệu cũ), để tránh tải về file không có đuôi.
 */
function sniffFileExtension(buffer: Buffer): string {
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF") {
    return ".pdf";
  }
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)) {
    // Zip-based: docx/xlsx/pptx đều bắt đầu bằng "PK", phân biệt qua tên thư mục nội bộ.
    const text = buffer.toString("latin1");
    if (text.includes("word/")) return ".docx";
    if (text.includes("xl/")) return ".xlsx";
    if (text.includes("ppt/")) return ".pptx";
    return ".zip";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1") {
    return ".doc"; // Office cũ (doc/xls/ppt) dùng chung định dạng OLE, không phân biệt được chính xác.
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return ".jpg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return ".png";
  }
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) {
    return ".gif";
  }
  return "";
}

const EXTENSION_MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".doc": "application/msword",
  ".zip": "application/zip",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
};

const uploadSchema = {
  body: Joi.object({
    file: Joi.string().required().messages({
      "any.required": "Trường 'file' là bắt buộc và không thể thiếu.",
      "string.empty": "Nội dung 'file' không được để trống.",
    }),
    folder: Joi.string().optional().allow("").messages({
      "string.base": "Trường 'folder' phải là kiểu văn bản (string).",
    }),
    sourceType: Joi.string().trim().max(100).optional(),
    name: Joi.string().trim().max(300).optional(),
    fileName: Joi.string().trim().max(300).optional(),
    mimeType: Joi.string().trim().max(200).allow("").optional(),
    size: Joi.number().integer().min(0).optional(),
  }),
};

// Route tải lên đa phương tiện tới Cloudinary qua Backend Relay (Yêu cầu đăng nhập)
mediaRouter.post(
  "/upload",
  requireAuth as RequestHandler,
  requirePermission("resource:manage") as RequestHandler,
  validateRequest(uploadSchema),
  mediaController.upload as RequestHandler
);

// Route ký tham số tải lên trực tiếp lên Cloudinary từ Client (Bảo mật)
mediaRouter.post(
  "/sign-upload",
  requireAuth as RequestHandler,
  requirePermission("resource:manage") as RequestHandler,
  async (req, res) => {
    try {
      const { paramsToSign } = req.body;
      if (!paramsToSign) {
        return res.status(400).json({ error: "Thiếu tham số cần ký 'paramsToSign'." });
      }
      
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (!apiSecret) {
        return res.status(500).json({ error: "Chưa cấu hình CLOUDINARY_API_SECRET trên server." });
      }

      const { v2: cloudinary } = await import("cloudinary");
      const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
      
      return res.status(200).json({
        signature,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      });
    } catch (err: unknown) {
      console.error("[Media Sign Upload Error]:", err);
      res.status(500).json({ error: "Lỗi tạo chữ ký upload.", details: getErrorMessage(err) });
    }
  }
);

// Route download proxy để giải quyết vấn đề CORS ở phía Client
mediaRouter.get(
  "/download",
  requireAuth as RequestHandler,
  async (req, res) => {
    const fileUrl = req.query.url as string;
    const filename = (req.query.filename as string) || "igen-download";
    if (!fileUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    // Chỉ cho phép proxy các domain đã được whitelist (chặn SSRF tới mạng nội bộ/metadata)
    const allowedDomains = [
      "res.cloudinary.com",
      "cdn.pixabay.com",
      "www.soundhelix.com",
      "assets.mixkit.co",
      "freesound.org",
      // Google Drive (tính năng Tài nguyên)
      "drive.google.com",
      "docs.google.com",
      "drive.usercontent.google.com",
      "lh3.googleusercontent.com",
    ];
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      return res.status(400).json({ error: "URL không hợp lệ." });
    }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return res.status(400).json({ error: "Giao thức URL không được phép." });
    }
    const isAllowed = allowedDomains.some(
      (domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
    );
    if (!isAllowed) {
      return res.status(403).json({ error: "Domain không được phép proxy." });
    }

    try {
      // Trích xuất phần mở rộng (extension) từ fileUrl để đính kèm vào tên file tải về
      let extension = "";
      const pathname = parsedUrl.pathname;
      const lastDot = pathname.lastIndexOf(".");
      if (lastDot !== -1) {
        const ext = pathname.substring(lastDot);
        // Chỉ lấy các extension hợp lệ (độ dài từ 2 đến 6 ký tự chữ và số)
        if (/^\.[a-zA-Z0-9]{1,5}$/.test(ext)) {
          extension = ext;
        }
      }

      // Filename do client truyền lên đã có sẵn đuôi hợp lệ hay chưa (vd les.fileName gốc)
      const hasValidExtension = /\.[a-zA-Z0-9]{1,5}$/.test(filename);

      let finalFilename = filename;
      if (extension && !filename.toLowerCase().endsWith(extension.toLowerCase())) {
        finalFilename = `${filename}${extension}`;
      }

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Nếu vẫn chưa xác định được đuôi file (URL không có extension và filename client
      // gửi lên cũng không có), dò định dạng thật của file qua magic bytes để tránh tải về
      // một file không có đuôi (mở lên bị lỗi/không đọc được nội dung).
      let sniffedExt = "";
      if (!extension && !hasValidExtension) {
        sniffedExt = sniffFileExtension(buffer);
        if (sniffedExt) {
          finalFilename = `${finalFilename}${sniffedExt}`;
        }
      }

      const upstreamContentType = response.headers.get("content-type");
      const isGenericContentType = !upstreamContentType || upstreamContentType === "application/octet-stream";
      const contentType = isGenericContentType && sniffedExt ? EXTENSION_MIME_MAP[sniffedExt] : upstreamContentType;
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      // Content-Disposition theo RFC 5987: giữ đúng tên gốc (kể cả tiếng Việt) + fallback ASCII.
      const asciiFallback = finalFilename.replace(/["\\]/g, "").replace(/[^\x20-\x7E]/g, "_");
      const disposition = req.query.inline === "true" ? "inline" : "attachment";
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(finalFilename)}`
      );

      res.send(buffer);
    } catch (err: unknown) {
      console.error("[Media Proxy Download Error]:", err);
      res.status(500).json({ error: "Failed to download file", details: getErrorMessage(err) });
    }
  }
);

// Route preview proxy — phục vụ tài liệu với Content-Disposition: inline để trình duyệt
// hiển thị trực tiếp trong iframe thay vì tải về (tránh vấn đề header từ Cloudinary).
mediaRouter.get(
  "/preview",
  requireAuth as RequestHandler,
  async (req, res) => {
    const fileUrl = req.query.url as string;
    if (!fileUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    const allowedDomains = [
      "res.cloudinary.com",
      "drive.google.com",
      "docs.google.com",
      "drive.usercontent.google.com",
      "lh3.googleusercontent.com",
    ];
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      return res.status(400).json({ error: "URL không hợp lệ." });
    }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return res.status(400).json({ error: "Giao thức URL không được phép." });
    }
    const isAllowed = allowedDomains.some(
      (domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
    );
    if (!isAllowed) {
      return res.status(403).json({ error: "Domain không được phép proxy." });
    }

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Xác định MIME type: ưu tiên từ upstream, fallback sniff magic bytes
      const upstreamContentType = response.headers.get("content-type");
      const isGeneric = !upstreamContentType || upstreamContentType === "application/octet-stream";
      let contentType = upstreamContentType || "";
      if (isGeneric) {
        const sniffedExt = sniffFileExtension(buffer);
        contentType = EXTENSION_MIME_MAP[sniffedExt] || "application/octet-stream";
      }

      res.setHeader("Content-Type", contentType);
      // inline: trình duyệt sẽ render file thay vì tải về
      res.setHeader("Content-Disposition", "inline");
      // Cho phép nhúng trong iframe cùng origin
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.send(buffer);
    } catch (err: unknown) {
      console.error("[Media Proxy Preview Error]:", err);
      res.status(500).json({ error: "Failed to preview file", details: getErrorMessage(err) });
    }
  }
);


/**
 * Audio proxy endpoint — phục vụ audio từ URL bên ngoài qua server nội bộ.
 * Giải quyết lỗi 403 Forbidden trên Safari do thiếu CORS headers từ domain bên ngoài.
 * Hỗ trợ Range requests (cần thiết cho HTML5 audio/video streaming).
 */
mediaRouter.get(
  "/audio-proxy",
  async (req, res) => {
    const audioUrl = req.query.url as string;
    if (!audioUrl) {
      return res.status(400).json({ error: "Thiếu tham số 'url'." });
    }

    // Chỉ cho phép proxy các domain audio đã được whitelist
    const allowedDomains = [
      "cdn.pixabay.com",
      "www.soundhelix.com",
      "assets.mixkit.co",
      "freesound.org",
      "res.cloudinary.com",
    ];

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(audioUrl);
    } catch {
      return res.status(400).json({ error: "URL không hợp lệ." });
    }

    const isAllowed = allowedDomains.some((domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`));
    if (!isAllowed) {
      return res.status(403).json({ error: "Domain không được phép proxy." });
    }

    try {
      const upstreamHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (compatible; IgenERP/1.0)",
      };

      // Chuyển tiếp Range header nếu có (để hỗ trợ seek/streaming)
      if (req.headers.range) {
        upstreamHeaders["Range"] = req.headers.range as string;
      }

      const protocol = parsedUrl.protocol === "https:" ? https : http;
      const proxyReq = protocol.get(
        audioUrl,
        { headers: upstreamHeaders },
        (proxyRes) => {
          // Gán CORS headers để Safari chấp nhận
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          res.setHeader("Accept-Ranges", "bytes");

          // Chuyển tiếp status và headers từ upstream
          const statusCode = proxyRes.statusCode || 200;
          res.status(statusCode);

          const headersToForward = ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"];
          for (const header of headersToForward) {
            const val = proxyRes.headers[header];
            if (val) res.setHeader(header, val);
          }

          proxyRes.pipe(res);
        }
      );

      proxyReq.on("error", (err) => {
        console.error("[Audio Proxy Error]:", err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: "Không thể kết nối đến nguồn audio.", details: err.message });
        }
      });
    } catch (err: unknown) {
      console.error("[Audio Proxy Unexpected Error]:", err);
      res.status(500).json({ error: "Lỗi không xác định khi proxy audio.", details: getErrorMessage(err) });
    }
  }
);

/**
 * Video proxy endpoint — phục vụ video từ URL bên ngoài qua server nội bộ.
 * Giải quyết lỗi url_ownership_unverified của TikTok khi gọi video từ Cloudinary.
 * Hỗ trợ Range requests (cần thiết cho HTML5 video streaming).
 */
mediaRouter.get(
  "/video-proxy",
  async (req, res) => {
    const videoUrl = req.query.url as string;
    if (!videoUrl) {
      return res.status(400).json({ error: "Thiếu tham số 'url'." });
    }

    const allowedDomains = [
      "res.cloudinary.com",
    ];

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(videoUrl);
    } catch {
      return res.status(400).json({ error: "URL không hợp lệ." });
    }

    const isAllowed = allowedDomains.some((domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`));
    if (!isAllowed) {
      return res.status(403).json({ error: "Domain không được phép proxy." });
    }

    try {
      const upstreamHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (compatible; IgenERP/1.0)",
      };

      // Chuyển tiếp Range header nếu có (để hỗ trợ seek/streaming)
      if (req.headers.range) {
        upstreamHeaders["Range"] = req.headers.range as string;
      }

      const protocol = parsedUrl.protocol === "https:" ? https : http;
      const proxyReq = protocol.get(
        videoUrl,
        { headers: upstreamHeaders },
        (proxyRes) => {
          // Gán CORS headers
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          res.setHeader("Accept-Ranges", "bytes");

          // Chuyển tiếp status và headers từ upstream
          const statusCode = proxyRes.statusCode || 200;
          res.status(statusCode);

          const headersToForward = ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"];
          for (const header of headersToForward) {
            const val = proxyRes.headers[header];
            if (val) res.setHeader(header, val);
          }

          proxyRes.pipe(res);
        }
      );

      proxyReq.on("error", (err) => {
        console.error("[Video Proxy Error]:", err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: "Không thể kết nối đến nguồn video.", details: err.message });
        }
      });
    } catch (err: unknown) {
      console.error("[Video Proxy Unexpected Error]:", err);
      res.status(500).json({ error: "Lỗi không xác định khi proxy video.", details: getErrorMessage(err) });
    }
  }
);

