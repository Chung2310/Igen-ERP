import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';

interface RoadmapSession { sessionNumber: number; name: string; focus: string; exercises?: string[] }
interface RoadmapWeek { week: number; focus: string; sessionTargets?: number; sessions?: RoadmapSession[] }
interface RoadmapPhase { order: number; name: string; durationWeeks: number; goals: string[]; weeks: RoadmapWeek[] }
export interface IRoadmap {
  customerId: mongoose.Types.ObjectId; ptId: mongoose.Types.ObjectId; title: string;
  baseline: Record<string, number>; strategy?: Record<string, unknown>; phases: RoadmapPhase[];
  status: 'DRAFT' | 'PUBLISHED'; version: number; publishedAt: Date | null;
}

const sessionSchema = new Schema<RoadmapSession>({
  sessionNumber: { type: Number, required: true, min: 1 },
  name: { type: String, default: '' },
  focus: { type: String, default: '' },
  exercises: { type: [String], default: [] },
}, { _id: false });

const weekSchema = new Schema<RoadmapWeek>({
  week: { type: Number, required: true, min: 1 }, focus: { type: String, required: true, trim: true },
  sessionTargets: { type: Number, min: 0, default: null },
  sessions: { type: [sessionSchema], default: [] },
}, { _id: false });
const phaseSchema = new Schema<RoadmapPhase>({
  order: { type: Number, required: true, min: 1 }, name: { type: String, required: true, trim: true },
  durationWeeks: { type: Number, required: true, min: 1 }, goals: { type: [String], default: [] },
  weeks: { type: [weekSchema], default: [] },
}, { _id: false });
const roadmapSchema = new Schema<IRoadmap>({
  customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', required: true, index: true },
  ptId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  baseline: { type: Schema.Types.Mixed, default: {} },
  strategy: { type: Schema.Types.Mixed, default: {} },
  phases: { type: [phaseSchema], default: [] },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT', index: true },
  version: { type: Number, default: 1 }, publishedAt: { type: Date, default: null },
}, { timestamps: true });
roadmapSchema.index({ customerId: 1, status: 1, createdAt: -1 });roadmapSchema.plugin(centerTenantPlugin);


export default mongoose.model<IRoadmap>('Roadmap', roadmapSchema);
