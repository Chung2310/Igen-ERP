import { Types, type QueryFilter } from 'mongoose';
import BodyMeasurement from '../models/BodyMeasurement.js';
import CalendarEvent from '../models/CalendarEvent.js';
import CustomerProfile, { type CustomerProfileDocument, type ICustomerProfile } from '../models/CustomerProfile.js';
import ProgressPhoto from '../models/ProgressPhoto.js';
import ProgressReport from '../models/ProgressReport.js';
import WorkoutPlan from '../models/WorkoutPlan.js';
import WorkoutSession from '../models/WorkoutSession.js';
import Roadmap from '../models/Roadmap.js';
import NutritionPlan from '../models/NutritionPlan.js';
import Goal from '../models/Goal.js';
import InBodyRecord from '../models/InBodyRecord.js';
import PtPackage from '../models/PtPackage.js';
import User from '../models/User.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { AuthenticatedUser } from '../types/express.js';
import { analyzeProgress } from './progressAnalyticsService.js';
import { resolveWorkoutPlanTracking } from './exerciseTrackingService.js';

const fail = (message: string, status: number) => new AppError({ message, status, code: status === 403 ? ERROR_CODES.AUTHORIZATION : ERROR_CODES.NOT_FOUND });

async function staffCustomer(user: AuthenticatedUser, customerId: string) {
  const customer = await CustomerProfile.findById(customerId).lean();
  if (!customer) throw fail('Không tìm thấy khách hàng.', 404);
  if (user.role === 'PT' && String(customer.assignedPtId) !== user.id) throw fail('Bạn không có quyền xem hành trình khách hàng này.', 403);
  return customer;
}

async function ownCustomer(user: AuthenticatedUser) {
  const existing = await CustomerProfile.findOne({ userId: user.id }).lean();
  if (existing) return existing;

  const dbUser = await User.findById(user.id);
  if (dbUser) {
    if (dbUser.phone || dbUser.email) {
      const filterConditions: Array<QueryFilter<ICustomerProfile>> = [];
      if (dbUser.phone) filterConditions.push({ phone: dbUser.phone });
      if (dbUser.email) filterConditions.push({ email: dbUser.email.toLowerCase() });

      const matched = (await CustomerProfile.findOne({
        $or: filterConditions,
        userId: { $in: [null, undefined] },
      } as QueryFilter<ICustomerProfile>)) as CustomerProfileDocument | null;
      if (matched) {
        matched.userId = new Types.ObjectId(user.id);
        await matched.save();
        return matched.toObject();
      }
    }

    const defaultPt = await User.findOne({ role: 'PT', status: 'ACTIVE' }).lean();
    if (defaultPt) {
      const [created] = await CustomerProfile.create([
        {
          userId: new Types.ObjectId(user.id),
          assignedPtId: defaultPt._id,
          fullName: dbUser.fullName || dbUser.username,
          phone: dbUser.phone || '0000000000',
          email: dbUser.email || null,
          gender: dbUser.gender || 'OTHER',
          dateOfBirth: dbUser.dateOfBirth ? new Date(dbUser.dateOfBirth) : null,
          status: 'ACTIVE',
          initialGoal: 'Cải thiện thể lực và vóc dáng',
          medicalNotes: '',
          internalNotes: '',
        },
      ]);
      return created.toObject();
    }
  }
  throw fail('Không tìm thấy hồ sơ khách hàng. Vui lòng liên hệ quản trị viên để gán PT phụ trách.', 404);
}

function dateFilter(field: string, from?: unknown, to?: unknown) {
  if (typeof from !== 'string' && typeof to !== 'string') return {};
  return { [field]: { ...(typeof from === 'string' ? { $gte: new Date(from) } : {}), ...(typeof to === 'string' ? { $lte: new Date(to) } : {}) } };
}

function inbodyToMeasurement(rec: any) {
  return {
    _id: rec._id,
    customerId: rec.customerId,
    ptId: rec.ptId,
    measuredAt: rec.measurementDate || rec.createdAt,
    weight: rec.weight,
    bodyFatPercentage: rec.bodyFatPercentage ?? undefined,
    muscleMass: rec.muscleMass ?? undefined,
    measurements: {
      bodyFatMass: rec.bodyFatMass ?? undefined,
      visceralFatLevel: rec.visceralFatLevel ?? undefined,
      inbodyScore: rec.inbodyScore ?? undefined,
      waistHipRatio: rec.waistHipRatio ?? undefined,
      bodyWater: rec.bodyWater ?? undefined,
      boneMineral: rec.boneMineral ?? undefined,
    },
  };
}

export async function getJourney(user: AuthenticatedUser, options: { customerId?: string; from?: unknown; to?: unknown; customerView?: boolean }) {
  const customer = options.customerView ? await ownCustomer(user) : await staffCustomer(user, String(options.customerId));
  const customerId = new Types.ObjectId(String(customer._id));
  const [
    sessions,
    measurements,
    calendar,
    photos,
    activePlan,
    planHistory,
    reports,
    roadmaps,
    nutritionPlans,
    goals,
    inbodyRecords,
    ptPackages,
    assignedPt,
    publishedWorkoutPlans,
  ] = await Promise.all([
    WorkoutSession.find({ customerId, ...dateFilter('performedAt', options.from, options.to) }).sort({ performedAt: -1 }).lean(),
    BodyMeasurement.find({ customerId, ...dateFilter('measuredAt', options.from, options.to) }).sort({ measuredAt: 1 }).lean(),
    CalendarEvent.find({ customerId, ...dateFilter('startsAt', options.from, options.to) }).sort({ startsAt: 1 }).lean(),
    ProgressPhoto.find({ customerId, ...dateFilter('takenDate', options.from, options.to) }).sort({ takenDate: 1 }).lean(),
    WorkoutPlan.findOne({ customerId, lifecycleStatus: 'ACTIVE' }).lean(),
    WorkoutPlan.find({ customerId, lifecycleStatus: 'ARCHIVED' }).sort({ archivedAt: -1 }).lean(),
    ProgressReport.find({ customerId, ...(options.customerView ? { status: 'PUBLISHED' } : {}) }).sort({ periodEnd: -1 }).lean(),
    Roadmap.find({ customerId, ...(options.customerView ? { status: 'PUBLISHED' } : {}) }).sort({ createdAt: -1 }).lean(),
    NutritionPlan.find({ customerId, ...(options.customerView ? { status: 'PUBLISHED' } : {}) }).sort({ startDate: -1, createdAt: -1 }).lean(),
    Goal.find({ customerId, ...(options.customerView ? { status: 'PUBLISHED' } : {}) }).sort({ createdAt: -1 }).lean(),
    InBodyRecord.find({ customerId, ...dateFilter('measurementDate', options.from, options.to), ...(options.customerView ? { status: 'PUBLISHED' } : {}) }).sort({ measurementDate: -1 }).lean(),
    PtPackage.find({ customerId }).sort({ startDate: -1 }).lean(),
    customer.assignedPtId ? User.findById(customer.assignedPtId, 'fullName username phone email avatarUrl').lean() : null,
    WorkoutPlan.find({ customerId, ...(options.customerView ? { status: 'PUBLISHED' } : {}) }).sort({ createdAt: -1 }).lean(),
  ]);
  const selectedActivePlan = activePlan || publishedWorkoutPlans.find((plan) => plan.status === 'PUBLISHED') || null;
  const resolvedActivePlan = selectedActivePlan
    ? await resolveWorkoutPlanTracking(selectedActivePlan as unknown as Record<string, unknown>)
    : null;
  const inbodyMeasurements = inbodyRecords.map(inbodyToMeasurement);
  const combinedMeasurements = [...measurements, ...inbodyMeasurements].sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
  );
  const analytics = analyzeProgress({
    sessions: sessions as unknown as Parameters<typeof analyzeProgress>[0]['sessions'],
    measurements: combinedMeasurements as unknown as Parameters<typeof analyzeProgress>[0]['measurements'],
    ...(typeof options.from === 'string' ? { periodStart: options.from } : {}),
    ...(typeof options.to === 'string' ? { periodEnd: options.to } : {}),
  });
  return {
    customer: {
      _id: String(customer._id),
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email || null,
      gender: customer.gender,
      height: customer.height,
      initialWeight: customer.initialWeight,
      initialGoal: customer.initialGoal,
      status: customer.status,
      assignedPt: assignedPt
        ? {
            _id: String(assignedPt._id),
            fullName: assignedPt.fullName || assignedPt.username,
            username: assignedPt.username,
            phone: assignedPt.phone || '',
            email: assignedPt.email || '',
            avatarUrl: assignedPt.avatarUrl || '',
          }
        : null,
      packages: ptPackages,
      activePackage: ptPackages.find((p) => p.status === 'ACTIVE') || ptPackages[0] || null,
    },
    sessions,
    measurements: combinedMeasurements,
    calendar,
    photos,
    plans: {
      active: resolvedActivePlan,
      history: planHistory,
      published: publishedWorkoutPlans,
    },
    roadmaps,
    nutritionPlans,
    goals,
    inbodyRecords,
    reports,
    analytics,
  };
}

export async function getProgressOverview(user: AuthenticatedUser) {
  const customerFilter = user.role === 'PT' ? { assignedPtId: new Types.ObjectId(user.id) } : {};
  const customers = await CustomerProfile.find(customerFilter).sort({ fullName: 1 }).lean();
  if (!customers.length) return [];
  const customerIds = customers.map((customer) => customer._id);
  const [sessions, measurements, inbodyRecords] = await Promise.all([
    WorkoutSession.find({ customerId: { $in: customerIds } }).sort({ performedAt: 1 }).lean(),
    BodyMeasurement.find({ customerId: { $in: customerIds } }).sort({ measuredAt: 1 }).lean(),
    InBodyRecord.find({ customerId: { $in: customerIds } }).sort({ measurementDate: 1 }).lean(),
  ]);
  const sessionsByCustomer = new Map<string, typeof sessions>();
  const measurementsByCustomer = new Map<string, any[]>();
  for (const session of sessions) { const key = String(session.customerId); sessionsByCustomer.set(key, [...(sessionsByCustomer.get(key) || []), session]); }
  for (const measurement of measurements) { const key = String(measurement.customerId); measurementsByCustomer.set(key, [...(measurementsByCustomer.get(key) || []), measurement]); }
  for (const inbody of inbodyRecords) { const key = String(inbody.customerId); measurementsByCustomer.set(key, [...(measurementsByCustomer.get(key) || []), inbodyToMeasurement(inbody)]); }
  return customers.map((customer) => {
    const key = String(customer._id);
    const customerSessions = sessionsByCustomer.get(key) || [];
    const customerMeasurements = (measurementsByCustomer.get(key) || []).sort(
      (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
    );
    const analytics = analyzeProgress({
      sessions: customerSessions as unknown as Parameters<typeof analyzeProgress>[0]['sessions'],
      measurements: customerMeasurements as unknown as Parameters<typeof analyzeProgress>[0]['measurements'],
    });
    return { customer: { _id: key, fullName: customer.fullName, phone: customer.phone, status: customer.status }, sessionCount: customerSessions.length, lastSessionAt: customerSessions.at(-1)?.performedAt || null, latestMeasurement: customerMeasurements.at(-1) || null, analytics };
  });
}
