export interface MedicalAuditFlag {
  id: string;
  type: "dosage_anomaly" | "ocr_glitch" | "contraindication_highlight" | "table_structure";
  severity: "low" | "medium" | "high";
  snippet: string;
  message: string;
  suggestedCorrection?: string;
}

export interface MedicalAuditSummary {
  isClean: boolean;
  requiresSpotCheck: boolean;
  flagsCount: number;
  flags: MedicalAuditFlag[];
}

/**
 * Common medical unit patterns in Vietnamese clinical guidelines
 */
const DOSAGE_REGEX =
  /(?:liều(?:\s+dùng)?|uống|tiêm|truyền)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(mg|mcg|µg|g|ml|l|ui|iu|mmol\/l|g\/l|ml\/kg\/h|viên|ống|gói)(?:\/(?:ngày|lần|kg|giờ|24h))?/gi;

const OCR_GLITCH_REGEX =
  /(?:[a-zA-Z0-9]\uFFFD[a-zA-Z0-9]|(?:[0-9]+[oO][0-9]*\s*(?:mg|ml|mcg))|(?:[a-zA-Z]{3,}[0-9]{2,}[a-zA-Z]{3,}))/g;

const CONTRAINDICATION_REGEX =
  /(?:chống chỉ định(?:\s+tuyệt đối|\s+tương đối)?|không được dùng|cấm dùng|thận trọng khi dùng)/gi;

/**
 * Audits extracted medical document text for dosages, potential OCR corruption, and critical warnings.
 */
export function auditMedicalText(text: string): MedicalAuditSummary {
  const flags: MedicalAuditFlag[] = [];
  let flagIndex = 1;

  if (!text || typeof text !== "string") {
    return { isClean: true, requiresSpotCheck: false, flagsCount: 0, flags: [] };
  }

  // 1. Check for extreme or suspicious dosages (e.g. single dose > 4000mg, or decimal confusion like 05 mg)
  const dosageMatches = [...text.matchAll(DOSAGE_REGEX)];
  for (const match of dosageMatches) {
    const rawNumber = match[1].replace(",", ".");
    const unit = match[2].toLowerCase();
    const val = parseFloat(rawNumber);
    const snippet = text.slice(Math.max(0, (match.index || 0) - 25), Math.min(text.length, (match.index || 0) + match[0].length + 25)).trim();

    // Suspicious pattern: leading zero without decimal point (e.g. 05 mg, 025 mg - classic OCR mistake for 0.5 or 0.25)
    if (/^0[0-9]+/.test(match[1])) {
      flags.push({
        id: `flag-${flagIndex++}`,
        type: "dosage_anomaly",
        severity: "high",
        snippet,
        message: `Số '${match[1]}' có số 0 ở đầu nhưng không có dấu thập phân, có thể OCR bị mất dấu chấm (ví dụ 0.${match[1].slice(1)} ${unit}).`,
        suggestedCorrection: `0.${match[1].slice(1)} ${unit}`,
      });
      continue;
    }

    // High dose check: single value > 4000 mg
    if (unit === "mg" && val > 4000) {
      flags.push({
        id: `flag-${flagIndex++}`,
        type: "dosage_anomaly",
        severity: "high",
        snippet,
        message: `Liều ${val} mg là mức liều đơn rất lớn, cần đối chiếu lại văn bản gốc tránh OCR thừa chữ số 0.`,
      });
    } else if (unit === "g" && val > 50) {
      flags.push({
        id: `flag-${flagIndex++}`,
        type: "dosage_anomaly",
        severity: "high",
        snippet,
        message: `Liều ${val} g bất thường đối với chỉ định thuốc uống/tiêm.`,
      });
    }
  }

  // 2. Check for OCR corruptions (replacement characters, mixed letters/digits in numbers)
  const glitchMatches = [...text.matchAll(OCR_GLITCH_REGEX)];
  for (const match of glitchMatches) {
    const snippet = text.slice(Math.max(0, (match.index || 0) - 20), Math.min(text.length, (match.index || 0) + match[0].length + 20)).trim();
    flags.push({
      id: `flag-${flagIndex++}`,
      type: "ocr_glitch",
      severity: "medium",
      snippet,
      message: `Phát hiện lỗi ký tự lạ hoặc lẫn chữ cái trong số liệu ('${match[0]}').`,
    });
  }

  // 3. Highlight critical contraindication sections
  const contraMatches = [...text.matchAll(CONTRAINDICATION_REGEX)];
  if (contraMatches.length > 0) {
    const firstMatch = contraMatches[0];
    const snippet = text.slice(Math.max(0, (firstMatch.index || 0) - 10), Math.min(text.length, (firstMatch.index || 0) + 70)).trim();
    flags.push({
      id: `flag-${flagIndex++}`,
      type: "contraindication_highlight",
      severity: "low",
      snippet,
      message: `Tài liệu có chứa mục chống chỉ định/cảnh báo an toàn quan trọng.`,
    });
  }

  // Determine if spot check is required: any high severity flag triggers spot-check
  const requiresSpotCheck = flags.some((f) => f.severity === "high");

  return {
    isClean: flags.length === 0,
    requiresSpotCheck,
    flagsCount: flags.length,
    flags,
  };
}

/**
 * Suggests an existing document that might be replaced by this new document based on title/number similarity.
 */
export function suggestSupersededDocument(
  newTitle: string,
  newNumber: string | undefined,
  existingDocs: Array<{ id: string; title: string; number?: string }>,
): { id: string; title: string; matchReason: string } | null {
  if (!newTitle && !newNumber) return null;

  const cleanNewTitle = (newTitle || "").toLowerCase().trim();
  const cleanNewNumber = (newNumber || "").toUpperCase().trim();

  // Normalize terms: remove years, "quyết định", "hướng dẫn chẩn đoán và điều trị"
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/năm\s+\d{4}|\b20\d{2}\b/g, "")
      .replace(/quyết định số\s*[:\d/a-zđ-]+|hướng dẫn chẩn đoán và điều trị|hướng dẫn chẩn đoán|phác đồ điều trị/gi, "")
      .replace(/[^a-z0-9à-ỹ\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  const baseKeywords = normalize(cleanNewTitle)
    .split(" ")
    .filter((w) => w.length > 2);

  for (const doc of existingDocs) {
    const docTitle = (doc.title || "").toLowerCase();
    const docNumber = (doc.number || "").toUpperCase();

    // Direct match: if new document explicitly mentions replacing old document's number
    if (docNumber && cleanNewTitle.includes(docNumber.toLowerCase())) {
      return { id: doc.id, title: doc.title, matchReason: `Tiêu đề nhắc tới số hiệu văn bản cũ: ${doc.number}` };
    }

    // Match keywords: check if 60%+ of meaningful keywords overlap
    const docKeywords = new Set(normalize(docTitle).split(" ").filter((w) => w.length > 2));
    if (baseKeywords.length >= 2 && docKeywords.size >= 2) {
      const matchCount = baseKeywords.filter((k) => docKeywords.has(k)).length;
      const ratio = matchCount / Math.max(baseKeywords.length, docKeywords.size);
      if (ratio >= 0.6) {
        return {
          id: doc.id,
          title: doc.title,
          matchReason: `Chủ đề và phác đồ trùng khớp (${Math.round(ratio * 100)}% từ khóa tương đồng)`,
        };
      }
    }
  }

  return null;
}
