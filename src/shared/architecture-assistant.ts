export interface ArchitectureRoom {
  id: string;
  name: string;
  floor: number;
  x: number;
  y: number;
  width: number;
  height: number;
  areaM2: number;
  style?: string;
  finishes?: {
    flooring?: string;
    walls?: string;
    ceiling?: string;
    doors?: string;
    windows?: string;
  };
}

export interface ArchitectureFurniture {
  id: string;
  roomId: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  style?: string;
  material?: string;
  color?: string;
}

export interface ArchitectureOpening {
  id: string;
  roomId: string;
  type: "door" | "window";
  wall: "north" | "east" | "south" | "west";
  offset: number;
  width: number;
}

export interface ArchitecturePlan {
  rooms: ArchitectureRoom[];
  notes: string;
  furniture?: ArchitectureFurniture[];
  openings?: ArchitectureOpening[];
  outline?: Array<{ x: number; y: number }>;
}

export interface ArchitectureSyncSuggestion {
  id: string;
  title: string;
  text: string;
}

export interface ArchitectureSyncCategory {
  name: string;
  suggestions: ArchitectureSyncSuggestion[];
}

export type ArchitectureToolId = "plan" | "renders" | "render" | "edit" | "staging" | "visual" | "texture" | "human" | "enhance" | "upscale" | "sync" | "canvas" | "utilities" | "video" | "library";
export const AVAILABLE_ARCHITECTURE_TOOLS: ReadonlySet<ArchitectureToolId> = new Set(["plan", "render", "renders"]);
export type ArchitectureImageToolKind = Exclude<ArchitectureToolId, "plan" | "renders" | "video" | "library">;

export interface ArchitectureRenderAsset {
  id: string;
  filename: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "video/mp4";
  bytes: number;
  model: string;
  resolution?: "1K" | "2K" | "4K";
  createdAt: string;
  kind?: "render" | "edit" | "staging" | "visual" | "texture" | "human" | "enhance" | "upscale" | "sync" | "canvas" | "utilities" | "video";
  prompt?: string;
}

export interface ArchitectureVideoJob {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  prompt: string;
  createdAt: string;
  error?: string;
  assetId?: string;
}

export interface ArchitectureProject {
  _id: string;
  name: string;
  areaM2: number;
  floors: number;
  style: string;
  requirements: string;
  plan: ArchitecturePlan | null;
  renders: ArchitectureRenderAsset[];
  videoJobs?: ArchitectureVideoJob[];
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArchitectureProjectInput {
  name: string;
  areaM2: number;
  floors: number;
  style: string;
  requirements: string;
}
