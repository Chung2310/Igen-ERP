import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for combining Tailwind classes with merging support.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number or string into a dot-separated currency format (VND).
 * Example: 4000000 -> 4.000.000
 */
export function formatVND(amount: number | string): string {
  const num = typeof amount === 'string' ? parseInt(amount.replace(/\D/g, ''), 10) : amount;
  if (isNaN(num as number) || num === null) return '';
  return num.toLocaleString('vi-VN');
}

/**
 * Removes all non-digit characters from a formatted currency string.
 * Example: 4.000.000 -> 4000000
 */

export function parseVND(formattedValue: string): string {
  return formattedValue.replace(/\D/g, '');
}

/**
 * Formats a date string for display (DD/MM/YYYY).
 * Handles YYYY-MM-DD (from date inputs) and existing DD/MM/YYYY formats.
 */
export function formatDisplayDate(dateStr: string | undefined): string {
  if (!dateStr) return 'Chưa cập nhật';
  
  // If it's already DD/MM/YYYY, return as is
  const displayMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (displayMatch) {
    return `${displayMatch[1].padStart(2, '0')}/${displayMatch[2].padStart(2, '0')}/${displayMatch[3]}`;
  }
  
  // If it's YYYY-MM-DD (from HTML date input)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T)/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, '0')}/${isoMatch[2].padStart(2, '0')}/${isoMatch[1]}`;
  }
  
  return dateStr;
}

/**
 * Converts a date string (either DD/MM/YYYY or YYYY-MM-DD) to YYYY-MM-DD format for HTML date inputs.
 */
export function toInputDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return '';
}

/**
 * Converts a date string from YYYY-MM-DD to DD/MM/YYYY.
 */
export function toDisplayDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T)/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, '0')}/${isoMatch[2].padStart(2, '0')}/${isoMatch[1]}`;
  }
  const displayMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (displayMatch) {
    return `${displayMatch[1].padStart(2, '0')}/${displayMatch[2].padStart(2, '0')}/${displayMatch[3]}`;
  }
  return dateStr;
}

/**
 * Converts a Vietnamese string into a clean URL-friendly slug.
 */
export function toSlug(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/([^a-z0-9\s-])/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Maps lowercase bank IDs to official VietQR codes.
 */
export function getVietQRBankCode(bankId: string | undefined): string {
  if (!bankId) return 'MB';
  const map: Record<string, string> = {
    mbbank: 'MB',
    vietcombank: 'VCB',
    techcombank: 'TCB',
    vietinbank: 'ICB',
    bidv: 'BIDV',
    agribank: 'VBA',
    acb: 'ACB',
    sacombank: 'STB',
    tpbank: 'TPB',
    vpbank: 'VPB'
  };
  return map[bankId.toLowerCase()] || bankId.toUpperCase();
}

/**
 * Compresses an image file on the client side using HTML5 Canvas.
 * Returns the original file if the browser doesn't support canvas/images or if it's not an image (e.g. PDF).
 */
export async function compressImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<File> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = options;

  // If not an image, return original file (like pdf)
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Draw to canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file); // fallback
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas back to Blob, then to File
        const outputType = 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Create a new file with the same name (adjusting extension to .jpg)
              let name = file.name;
              const lastDot = name.lastIndexOf('.');
              if (lastDot !== -1) {
                name = name.substring(0, lastDot) + '.jpg';
              } else {
                name = name + '.jpg';
              }
              const compressedFile = new File([blob], name, {
                type: outputType,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          outputType,
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Maps lowercase bank IDs to official VietQR display names.
 */
export function getBankDisplayName(bankId: string | undefined): string {
  if (!bankId) return '';
  const map: Record<string, string> = {
    mbbank: 'MBBank (MB)',
    vietcombank: 'Vietcombank (VCB)',
    techcombank: 'Techcombank (TCB)',
    vietinbank: 'Vietinbank (CTG)',
    bidv: 'BIDV',
    agribank: 'Agribank (VBA)',
    acb: 'ACB',
    sacombank: 'Sacombank (STB)',
    tpbank: 'TPBank (TPB)',
    vpbank: 'VPBank (VPB)'
  };
  return map[bankId.toLowerCase()] || bankId;
}

