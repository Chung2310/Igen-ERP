export interface FoodImageItem {
  _id: string;
  name: string;
  normalizedName: string;
  keywords?: string[];
  category?: string;
  imageUrl: string;
  localPath?: string;
  fileSize?: number;
  mimeType?: string;
  source: 'AI' | 'UPLOAD' | 'SEED';
  prompt?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FoodImageSummary {
  totalImages: number;
  totalUsage: number;
  aiCount: number;
  uploadCount: number;
  seedCount: number;
  estimatedSavingsVnd: number;
}

export interface KnowledgeDocument {
  _id: string;
  title: string;
  topic: string;
  content: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED';
  approvedById?: string;
  effectiveAt?: string;
  publishedAt?: string;
  chunkCount?: number;
  createdAt: string;
  updatedAt: string;
}
