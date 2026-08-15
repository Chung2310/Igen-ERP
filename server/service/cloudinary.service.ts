import { v2 as cloudinary } from "cloudinary";

let isConfigured = false;

function ensureConfigured() {
  if (isConfigured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  isConfigured = true;
}

export interface PrivateImageAsset {
  publicId: string;
  resourceType: string;
  type: string;
  format: string;
  bytes: number;
}

export type PrivateRawAsset = PrivateImageAsset;
export type PublicRawAsset = { publicId: string; secureUrl: string; bytes: number };
export interface PublicMediaAsset {
  secureUrl: string;
  publicId: string;
  resourceType: string;
  bytes: number;
}

export function normalizeCloudinaryUploadSource(source: string): string {
  const dataUriHeader = source.match(/^(data:[^;,]+)(?:;[^;]*)*;base64,/i);
  if (!dataUriHeader) return source;
  return `${dataUriHeader[1]};base64,${source.slice(dataUriHeader[0].length)}`;
}

export const cloudinaryService = {
  /**
   * Tải tệp tin (Base64 hoặc URL công khai) lên Cloudinary
   * @param fileStr Dữ liệu file dạng Base64 hoặc URL của ảnh/video
   * @param folder Thư mục lưu trữ trên Cloudinary
   * @returns URL công khai bảo mật (secure_url)
   */
  async uploadMediaAsset(fileStr: string, folder: string): Promise<PublicMediaAsset> {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error("Cấu hình Cloudinary chưa đầy đủ trong biến môi trường (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).");
    }

    ensureConfigured();

    try {
      const response = await cloudinary.uploader.upload(normalizeCloudinaryUploadSource(fileStr), {
        folder: folder || "igen_erp",
        resource_type: "auto", // Tự động nhận diện ảnh/video
        timeout: 600000, // Tăng timeout lên 10 phút cho video dung lượng lớn
      });
      return {
        secureUrl: response.secure_url,
        publicId: response.public_id,
        resourceType: response.resource_type,
        bytes: response.bytes,
      };
    } catch (error: any) {
      console.error("[cloudinaryService.uploadMedia] Error:", error);
      throw new Error(`Tải lên Cloudinary thất bại: ${error.message || error}`);
    }
  },

  async uploadMedia(fileStr: string, folder: string): Promise<string> {
    return (await this.uploadMediaAsset(fileStr, folder)).secureUrl;
  },

  async deletePublicMedia(publicId: string, resourceType = "image"): Promise<void> {
    ensureConfigured();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: "upload",
      invalidate: true,
    });
  },

  /**
   * Tải tệp tin dạng Buffer trực tiếp lên Cloudinary bằng stream
   * @param buffer Dữ liệu file dạng Buffer
   * @param folder Thư mục lưu trữ trên Cloudinary
   * @returns URL công khai bảo mật (secure_url)
   */
  async uploadMediaBuffer(buffer: Buffer, folder: string): Promise<string> {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error("Cấu hình Cloudinary chưa đầy đủ trong biến môi trường (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).");
    }

    ensureConfigured();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder || "igen_erp",
          resource_type: "auto",
          timeout: 600000, // Tăng timeout lên 10 phút cho video lớn
        },
        (error, result) => {
          if (error) {
            console.error("[cloudinaryService.uploadMediaBuffer] Error:", error);
            reject(new Error(`Tải lên Cloudinary thất bại: ${error.message || error}`));
          } else {
            resolve(result!.secure_url);
          }
        }
      );
      uploadStream.write(buffer);
      uploadStream.end();
    });
  },

  async uploadPrivateImage(buffer: Buffer, folder: string): Promise<PrivateImageAsset> {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error("Cloudinary configuration is incomplete");
    }
    ensureConfigured();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder || "igen_erp/attendance/evidence",
          resource_type: "image",
          type: "authenticated",
        },
        (error, result) => {
          if (error) {
            reject(new Error(`Private Cloudinary upload failed: ${error.message || error}`));
            return;
          }
          if (
            !result ||
            !result.public_id ||
            !result.resource_type ||
            !result.type ||
            !result.format ||
            typeof result.bytes !== "number"
          ) {
            reject(new Error("Cloudinary returned incomplete private asset metadata"));
            return;
          }
          resolve({
            publicId: result.public_id,
            resourceType: result.resource_type,
            type: result.type,
            format: result.format,
            bytes: result.bytes,
          });
        },
      );
      uploadStream.end(buffer);
    });
  },

  async uploadPrivateRaw(buffer: Buffer, folder: string, filename: string): Promise<PrivateRawAsset> {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error("Cloudinary configuration is incomplete");
    }
    ensureConfigured();
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, public_id: filename, resource_type: "raw", type: "authenticated", use_filename: false },
        (error, result) => {
          if (error) return reject(new Error(`Private Cloudinary upload failed: ${error.message || error}`));
          if (!result?.public_id || !result.resource_type || !result.type || typeof result.bytes !== "number") {
            return reject(new Error("Cloudinary returned incomplete private asset metadata"));
          }
          resolve({ publicId: result.public_id, resourceType: result.resource_type, type: result.type, format: result.format || "", bytes: result.bytes });
        },
      );
      uploadStream.end(buffer);
    });
  },

  async uploadPublicRaw(buffer: Buffer, folder: string, filename: string): Promise<PublicRawAsset> {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) throw new Error("Cloudinary configuration is incomplete");
    ensureConfigured();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, public_id: filename, resource_type: "raw", type: "upload", use_filename: false },
        (error, result) => {
          if (error) return reject(new Error(`Public Cloudinary upload failed: ${error.message || error}`));
          if (!result?.public_id || !result.secure_url || typeof result.bytes !== "number") return reject(new Error("Cloudinary returned incomplete public asset metadata"));
          resolve({ publicId: result.public_id, secureUrl: result.secure_url, bytes: result.bytes });
        },
      );
      stream.end(buffer);
    });
  },

  async deletePublicRaw(publicId: string): Promise<void> {
    ensureConfigured();
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw", type: "upload", invalidate: true });
  },

  createSignedImageUrl(publicId: string, expiresAt: Date): string {
    return cloudinary.url(publicId, {
      resource_type: "image",
      type: "authenticated",
      secure: true,
      sign_url: true,
      expires_at: Math.floor(expiresAt.getTime() / 1000),
    });
  },

  createSignedRawUrl(publicId: string, expiresAt: Date): string {
    ensureConfigured();
    return cloudinary.url(publicId, {
      resource_type: "raw", type: "authenticated", secure: true, sign_url: true,
      expires_at: Math.floor(expiresAt.getTime() / 1000),
    });
  },

  async deleteRawAsset(publicId: string): Promise<void> {
    ensureConfigured();
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw", type: "authenticated", invalidate: true });
  },

  async deleteAsset(publicId: string): Promise<void> {
    ensureConfigured();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      type: "authenticated",
      invalidate: true,
    });
  },
};
