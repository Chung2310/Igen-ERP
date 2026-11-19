import type { Model } from 'mongoose';
import ActivityCalorie from '../models/ActivityCalorie.js';
import AiNutritionGenerationJob from '../models/AiNutritionGenerationJob.js';
import AiUsage from '../models/AiUsage.js';
import AiUsageQuotaCounter from '../models/AiUsageQuotaCounter.js';
import AiWorkoutGenerationJob from '../models/AiWorkoutGenerationJob.js';
import AssistantConversation from '../models/AssistantConversation.js';
import AssistantSuggestion from '../models/AssistantSuggestion.js';
import AuditLog from '../models/AuditLog.js';
import BodyMeasurement from '../models/BodyMeasurement.js';
import CalendarEvent from '../models/CalendarEvent.js';
import CareAlert from '../models/CareAlert.js';
import CareLog from '../models/CareLog.js';
import CareTask from '../models/CareTask.js';
import ConsultationNote from '../models/ConsultationNote.js';
import CreditLedgerEntry from '../models/CreditLedgerEntry.js';
import CreditWallet from '../models/CreditWallet.js';
import CustomerProfile from '../models/CustomerProfile.js';
import DeviceSession from '../models/DeviceSession.js';
import Exercise from '../models/Exercise.js';
import FeatureFlag from '../models/FeatureFlag.js';
import FoodImage from '../models/FoodImage.js';
import Goal from '../models/Goal.js';
import InBodyRecord from '../models/InBodyRecord.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import KnowledgeDocument from '../models/KnowledgeDocument.js';
import Notification from '../models/Notification.js';
import MuscleGroup from '../models/MuscleGroup.js';
import NutritionLog from '../models/NutritionLog.js';
import NutritionPlan from '../models/NutritionPlan.js';
import PackageTemplate from '../models/PackageTemplate.js';
import PaymentOrder from '../models/PaymentOrder.js';
import ProgressPhoto from '../models/ProgressPhoto.js';
import ProgressReport from '../models/ProgressReport.js';
import PtPackage from '../models/PtPackage.js';
import Roadmap from '../models/Roadmap.js';
import TransferRequest from '../models/TransferRequest.js';
import User from '../models/User.js';
import GymInvitation from '../models/GymInvitation.js';
import CenterRequestLease from '../models/CenterRequestLease.js';
import WorkoutPlan from '../models/WorkoutPlan.js';
import WorkoutSession from '../models/WorkoutSession.js';
import WorkoutSessionDraft from '../models/WorkoutSessionDraft.js';
import WorkoutTemplate from '../models/WorkoutTemplate.js';

export const centerDataModels: Model<any>[] = [
  GymInvitation,
  CenterRequestLease,
  User, Exercise, ActivityCalorie, FeatureFlag, AiNutritionGenerationJob, AiUsage, AiUsageQuotaCounter, AiWorkoutGenerationJob, AssistantConversation,
  AssistantSuggestion, AuditLog, BodyMeasurement, CalendarEvent, CareAlert, CareLog,
  CareTask, ConsultationNote, CreditLedgerEntry, CreditWallet, CustomerProfile,
  DeviceSession, FoodImage, Goal, InBodyRecord, KnowledgeChunk, KnowledgeDocument, MuscleGroup,
  Notification, NutritionLog, NutritionPlan, PackageTemplate, PaymentOrder,
  ProgressPhoto, ProgressReport, PtPackage, Roadmap, TransferRequest, WorkoutPlan,
  WorkoutSession, WorkoutSessionDraft, WorkoutTemplate,
];

