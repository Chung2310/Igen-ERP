import { Router } from "express";
import Joi from "joi";
import { mediaController } from "../controller/media.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth } from "../middleware/auth";
import https from "https";
import http from "http";

export const mediaRouter = Router();

/**
 * DÃ² Ä‘á»‹nh dáº¡ng file tháº­t qua magic bytes (chá»¯ kÃ½ nhá»‹ phÃ¢n Ä‘áº§u file).
 * DÃ¹ng khi URL lÆ°u trÃªn Cloudinary khÃ´ng cÃ³ Ä‘uÃ´i má»Ÿ rá»™ng vÃ  client cÅ©ng
 * khÃ´ng gá»­i Ä‘Æ°á»£c filename gá»‘c (dá»¯ liá»‡u cÅ©), Ä‘á»ƒ trÃ¡nh táº£i vá» file khÃ´ng cÃ³ Ä‘uÃ´i.
 */
function sniffFileExtension(buffer: Buffer): string {
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF") {
    return ".pdf";
  }
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)) {
    // Zip-based: docx/xlsx/pptx Ä‘á»u báº¯t Ä‘áº§u báº±ng "PK", phÃ¢n biá»‡t qua tÃªn thÆ° má»¥c ná»™i bá»™.
    const text = buffer.toString("latin1");
    if (text.includes("word/")) return ".docx";
    if (text.includes("xl/")) return ".xlsx";
    if (text.includes("ppt/")) return ".pptx";
    return ".zip";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1") {
    return ".doc"; // Office cÅ© (doc/xls/ppt) dÃ¹ng chung Ä‘á»‹nh dáº¡ng OLE, khÃ´ng phÃ¢n biá»‡t Ä‘Æ°á»£c chÃ­nh xÃ¡c.
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
      "any.required": "TrÆ°á»ng 'file' lÃ  báº¯t buá»™c vÃ  khÃ´ng thá»ƒ thiáº¿u.",
      "string.empty": "Ná»™i dung 'file' khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.",
    }),
    folder: Joi.string().optional().allow("").messages({
      "string.base": "TrÆ°á»ng 'folder' pháº£i lÃ  kiá»ƒu vÄƒn báº£n (string).",
    }),
  }),
};

// Route táº£i lÃªn Ä‘a phÆ°Æ¡ng tiá»‡n tá»›i Cloudinary qua Backend Relay (YÃªu cáº§u Ä‘Äƒng nháº­p)
mediaRouter.post(
  "/upload",
  requireAuth as any,
  validateRequest(uploadSchema),
  mediaController.upload as any
);

// Route kÃ½ tham sá»‘ táº£i lÃªn trá»±c tiáº¿p lÃªn Cloudinary tá»« Client (Báº£o máº­t)
mediaRouter.post(
  "/sign-upload",
  requireAuth as any,
  async (req, res) => {
    try {
      const { paramsToSign } = req.body;
      if (!paramsToSign) {
        return res.status(400).json({ error: "Thiáº¿u tham sá»‘ cáº§n kÃ½ 'paramsToSign'." });
      }
      
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (!apiSecret) {
        return res.status(500).json({ error: "ChÆ°a cáº¥u hÃ¬nh CLOUDINARY_API_SECRET trÃªn server." });
      }

      const { v2: cloudinary } = await import("cloudinary");
      const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
      
      return res.status(200).json({
        signature,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      });
    } catch (err: any) {
      console.error("[Media Sign Upload Error]:", err);
      res.status(500).json({ error: "Lá»—i táº¡o chá»¯ kÃ½ upload.", details: err.message });
    }
  }
);

// Route download proxy Ä‘á»ƒ giáº£i quyáº¿t váº¥n Ä‘á» CORS á»Ÿ phÃ­a Client
mediaRouter.get(
  "/download",
  requireAuth as any,
  async (req, res) => {
    const fileUrl = req.query.url as string;
    const filename = (req.query.filename as string) || "igen-download";
    if (!fileUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    // Chá»‰ cho phÃ©p proxy cÃ¡c domain Ä‘Ã£ Ä‘Æ°á»£c whitelist (cháº·n SSRF tá»›i máº¡ng ná»™i bá»™/metadata)
    const allowedDomains = [
      "res.cloudinary.com",
      "cdn.pixabay.com",
      "www.soundhelix.com",
      "assets.mixkit.co",
      "freesound.org",
      // Google Drive (tÃ­nh nÄƒng TÃ i nguyÃªn)
      "drive.google.com",
      "docs.google.com",
      "drive.usercontent.google.com",
      "lh3.googleusercontent.com",
    ];
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      return res.status(400).json({ error: "URL khÃ´ng há»£p lá»‡." });
    }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return res.status(400).json({ error: "Giao thá»©c URL khÃ´ng Ä‘Æ°á»£c phÃ©p." });
    }
    const isAllowed = allowedDomains.some(
      (domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
    );
    if (!isAllowed) {
      return res.status(403).json({ error: "Domain khÃ´ng Ä‘Æ°á»£c phÃ©p proxy." });
    }

    try {
      // TrÃ­ch xuáº¥t pháº§n má»Ÿ rá»™ng (extension) tá»« fileUrl Ä‘á»ƒ Ä‘Ã­nh kÃ¨m vÃ o tÃªn file táº£i vá»
      let extension = "";
      try {
        const urlObj = new URL(fileUrl);
        const pathname = urlObj.pathname;
        const lastDot = pathname.lastIndexOf(".");
        if (lastDot !== -1) {
          const ext = pathname.substring(lastDot);
          // Chá»‰ láº¥y cÃ¡c extension há»£p lá»‡ (Ä‘á»™ dÃ i tá»« 2 Ä‘áº¿n 6 kÃ½ tá»± chá»¯ vÃ  sá»‘)
          if (/^\.[a-zA-Z0-9]{1,5}$/.test(ext)) {
            extension = ext;
          }
        }
      } catch {}

      // Filename do client truyá»n lÃªn Ä‘Ã£ cÃ³ sáºµn Ä‘uÃ´i há»£p lá»‡ hay chÆ°a (vd les.fileName gá»‘c)
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

      // Náº¿u váº«n chÆ°a xÃ¡c Ä‘á»‹nh Ä‘Æ°á»£c Ä‘uÃ´i file (URL khÃ´ng cÃ³ extension vÃ  filename client
      // gá»­i lÃªn cÅ©ng khÃ´ng cÃ³), dÃ² Ä‘á»‹nh dáº¡ng tháº­t cá»§a file qua magic bytes Ä‘á»ƒ trÃ¡nh táº£i vá»
      // má»™t file khÃ´ng cÃ³ Ä‘uÃ´i (má»Ÿ lÃªn bá»‹ lá»—i/khÃ´ng Ä‘á»c Ä‘Æ°á»£c ná»™i dung).
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
      // Content-Disposition theo RFC 5987: giá»¯ Ä‘Ãºng tÃªn gá»‘c (ká»ƒ cáº£ tiáº¿ng Viá»‡t) + fallback ASCII.
      const asciiFallback = finalFilename.replace(/["\\]/g, "").replace(/[^\x20-\x7E]/g, "_");
      const disposition = req.query.inline === "true" ? "inline" : "attachment";
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(finalFilename)}`
      );

      res.send(buffer);
    } catch (err: any) {
      console.error("[Media Proxy Download Error]:", err);
      res.status(500).json({ error: "Failed to download file", details: err.message });
    }
  }
);

/**
 * Audio proxy endpoint â€” phá»¥c vá»¥ audio tá»« URL bÃªn ngoÃ i qua server ná»™i bá»™.
 * Giáº£i quyáº¿t lá»—i 403 Forbidden trÃªn Safari do thiáº¿u CORS headers tá»« domain bÃªn ngoÃ i.
 * Há»— trá»£ Range requests (cáº§n thiáº¿t cho HTML5 audio/video streaming).
 */
mediaRouter.get(
  "/audio-proxy",
  async (req, res) => {
    const audioUrl = req.query.url as string;
    if (!audioUrl) {
      return res.status(400).json({ error: "Thiáº¿u tham sá»‘ 'url'." });
    }

    // Chá»‰ cho phÃ©p proxy cÃ¡c domain audio Ä‘Ã£ Ä‘Æ°á»£c whitelist
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
      return res.status(400).json({ error: "URL khÃ´ng há»£p lá»‡." });
    }

    const isAllowed = allowedDomains.some((domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`));
    if (!isAllowed) {
      return res.status(403).json({ error: "Domain khÃ´ng Ä‘Æ°á»£c phÃ©p proxy." });
    }

    try {
      const upstreamHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (compatible; IgenERP/1.0)",
      };

      // Chuyá»ƒn tiáº¿p Range header náº¿u cÃ³ (Ä‘á»ƒ há»— trá»£ seek/streaming)
      if (req.headers.range) {
        upstreamHeaders["Range"] = req.headers.range as string;
      }

      const protocol = parsedUrl.protocol === "https:" ? https : http;
      const proxyReq = protocol.get(
        audioUrl,
        { headers: upstreamHeaders },
        (proxyRes) => {
          // GÃ¡n CORS headers Ä‘á»ƒ Safari cháº¥p nháº­n
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          res.setHeader("Accept-Ranges", "bytes");

          // Chuyá»ƒn tiáº¿p status vÃ  headers tá»« upstream
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
          res.status(502).json({ error: "KhÃ´ng thá»ƒ káº¿t ná»‘i Ä‘áº¿n nguá»“n audio.", details: err.message });
        }
      });
    } catch (err: any) {
      console.error("[Audio Proxy Unexpected Error]:", err);
      res.status(500).json({ error: "Lá»—i khÃ´ng xÃ¡c Ä‘á»‹nh khi proxy audio.", details: err.message });
    }
  }
);

/**
 * Video proxy endpoint â€” phá»¥c vá»¥ video tá»« URL bÃªn ngoÃ i qua server ná»™i bá»™.
 * Giáº£i quyáº¿t lá»—i url_ownership_unverified cá»§a TikTok khi gá»i video tá»« Cloudinary.
 * Há»— trá»£ Range requests (cáº§n thiáº¿t cho HTML5 video streaming).
 */
mediaRouter.get(
  "/video-proxy",
  async (req, res) => {
    const videoUrl = req.query.url as string;
    if (!videoUrl) {
      return res.status(400).json({ error: "Thiáº¿u tham sá»‘ 'url'." });
    }

    const allowedDomains = [
      "res.cloudinary.com",
    ];

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(videoUrl);
    } catch {
      return res.status(400).json({ error: "URL khÃ´ng há»£p lá»‡." });
    }

    const isAllowed = allowedDomains.some((domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`));
    if (!isAllowed) {
      return res.status(403).json({ error: "Domain khÃ´ng Ä‘Æ°á»£c phÃ©p proxy." });
    }

    try {
      const upstreamHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (compatible; IgenERP/1.0)",
      };

      // Chuyá»ƒn tiáº¿p Range header náº¿u cÃ³ (Ä‘á»ƒ há»— trá»£ seek/streaming)
      if (req.headers.range) {
        upstreamHeaders["Range"] = req.headers.range as string;
      }

      const protocol = parsedUrl.protocol === "https:" ? https : http;
      const proxyReq = protocol.get(
        videoUrl,
        { headers: upstreamHeaders },
        (proxyRes) => {
          // GÃ¡n CORS headers
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          res.setHeader("Accept-Ranges", "bytes");

          // Chuyá»ƒn tiáº¿p status vÃ  headers tá»« upstream
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
          res.status(502).json({ error: "KhÃ´ng thá»ƒ káº¿t ná»‘i Ä‘áº¿n nguá»“n video.", details: err.message });
        }
      });
    } catch (err: any) {
      console.error("[Video Proxy Unexpected Error]:", err);
      res.status(500).json({ error: "Lá»—i khÃ´ng xÃ¡c Ä‘á»‹nh khi proxy video.", details: err.message });
    }
  }
);

