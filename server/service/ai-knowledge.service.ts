import crypto from "crypto";
import { AIKnowledgeChunkModel, AIKnowledgeDocumentModel } from "../model/ai-knowledge.model";

const EMBEDDING_DIMENSIONS = 96;
const DEFAULT_TOP_K = 5;
const MAX_CONTEXT_CHARS = 4500;

type ChannelScope = "facebook" | "zalo" | "all";

function normalizeCompanyCode(companyCode?: string) {
  return (companyCode || "SYSTEM").trim().toUpperCase();
}

function normalizeText(text: string) {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tokenize(text: string) {
  return normalizeText(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function hashToken(token: string) {
  const digest = crypto.createHash("md5").update(token).digest();
  return digest.readUInt32BE(0);
}

function embedText(text: string) {
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0);
  for (const token of tokenize(text)) {
    const hash = hashToken(token);
    const index = hash % EMBEDDING_DIMENSIONS;
    const sign = hash % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function cosineSimilarity(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length);
  let score = 0;
  for (let i = 0; i < length; i++) {
    score += a[i] * b[i];
  }
  return score;
}

function chunkText(text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  const maxChars = 1200;
  const minChars = 250;

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).trim().length > maxChars && current.length >= minChars) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = [current, paragraph].filter(Boolean).join("\n\n");
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxChars * 1.4) return [chunk];
    const parts: string[] = [];
    for (let start = 0; start < chunk.length; start += maxChars) {
      parts.push(chunk.slice(start, start + maxChars).trim());
    }
    return parts.filter(Boolean);
  });
}

export const aiKnowledgeService = {
  normalizeCompanyCode,

  async upsertKnowledgeFromText(params: {
    companyCode?: string;
    sourceType: "manual" | "google_doc";
    sourceTitle: string;
    text: string;
    sourceUrl?: string;
    createdBy?: string;
    channelScope?: ChannelScope[];
  }) {
    const companyCode = normalizeCompanyCode(params.companyCode);
    const text = normalizeText(params.text);
    const contentHash = crypto.createHash("sha256").update(text).digest("hex");
    const channelScope = params.channelScope?.length ? params.channelScope : ["all"];

    if (!text) {
      await AIKnowledgeDocumentModel.deleteMany({
        companyCode,
        sourceType: params.sourceType,
        sourceUrl: params.sourceUrl || "",
      });
      return { document: null, chunksCount: 0 };
    }

    const existing = await AIKnowledgeDocumentModel.findOne({
      companyCode,
      sourceType: params.sourceType,
      sourceUrl: params.sourceUrl || "",
    }).sort({ updatedAt: -1 });

    const version = existing ? existing.version + (existing.contentHash === contentHash ? 0 : 1) : 1;
    const document = await AIKnowledgeDocumentModel.findOneAndUpdate(
      {
        companyCode,
        sourceType: params.sourceType,
        sourceUrl: params.sourceUrl || "",
      },
      {
        companyCode,
        sourceType: params.sourceType,
        sourceTitle: params.sourceTitle,
        sourceUrl: params.sourceUrl || "",
        status: "active",
        version,
        channelScope,
        contentHash,
        createdBy: params.createdBy || "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await AIKnowledgeChunkModel.deleteMany({ documentId: document._id });

    const chunks = chunkText(text);
    if (chunks.length > 0) {
      await AIKnowledgeChunkModel.insertMany(
        chunks.map((chunk, index) => ({
          companyCode,
          documentId: document._id,
          chunkIndex: index,
          text: chunk,
          embedding: embedText(chunk),
          tokensApprox: Math.ceil(chunk.length / 4),
          channelScope,
          version,
        }))
      );
    }

    return { document, chunksCount: chunks.length };
  },

  async searchRelevantContext(params: {
    companyCode?: string;
    query: string;
    channel?: "facebook" | "zalo";
    topK?: number;
  }) {
    const companyCode = normalizeCompanyCode(params.companyCode);
    const queryVector = embedText(params.query);
    const topK = params.topK || DEFAULT_TOP_K;
    const channel = params.channel || "facebook";

    const chunks = await AIKnowledgeChunkModel.find({
      companyCode,
      channelScope: { $in: ["all", channel] },
    })
      .sort({ updatedAt: -1 })
      .limit(300)
      .lean();

    const ranked = chunks
      .map((chunk) => ({
        text: chunk.text,
        score: cosineSimilarity(queryVector, chunk.embedding || []),
      }))
      .filter((item) => item.score > 0.08)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    let usedChars = 0;
    const selected: string[] = [];
    for (const item of ranked) {
      if (usedChars + item.text.length > MAX_CONTEXT_CHARS) break;
      selected.push(item.text);
      usedChars += item.text.length;
    }

    return {
      contextText: selected.map((text, index) => `[Nguon ${index + 1}]\n${text}`).join("\n\n---\n\n"),
      matches: ranked.length,
    };
  },
};
