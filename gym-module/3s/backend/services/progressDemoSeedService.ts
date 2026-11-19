import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import CustomerProfile from '../models/CustomerProfile.js';
import WorkoutTemplate from '../models/WorkoutTemplate.js';
import WorkoutPlan from '../models/WorkoutPlan.js';
import WorkoutSession from '../models/WorkoutSession.js';
import BodyMeasurement from '../models/BodyMeasurement.js';
import CalendarEvent from '../models/CalendarEvent.js';
import ProgressPhoto from '../models/ProgressPhoto.js';
import ProgressReport from '../models/ProgressReport.js';
import Center from '../models/Center.js';
import { runWithCenter, runWithSystemCenterAccess } from '../tenancy/centerContext.js';

const PASSWORD = 'Demo123!';
const PT_USERNAME = 'pt.demo.progress';
const CUSTOMER_USERNAME = 'customer.demo.progress';
const CUSTOMER_PHONE = '0900000991';
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

const sessions = [
  { name: 'Buổi A · Chân & Mông', exercises: [{ name: 'Back Squat', sets: 4, reps: '8' }, { name: 'Romanian Deadlift', sets: 3, reps: '10' }, { name: 'Walking Lunge', sets: 3, reps: '12' }] },
  { name: 'Buổi B · Ngực & Vai', exercises: [{ name: 'Bench Press', sets: 4, reps: '8' }, { name: 'Overhead Press', sets: 3, reps: '10' }, { name: 'Incline Dumbbell Press', sets: 3, reps: '12' }] },
  { name: 'Buổi C · Lưng & Tay', exercises: [{ name: 'Deadlift', sets: 3, reps: '6' }, { name: 'Lat Pulldown', sets: 4, reps: '10' }, { name: 'Seated Cable Row', sets: 3, reps: '12' }] },
];

function exerciseLogs(sessionIndex: number, week: number) {
  const baseWeights = [[45, 40, 12], [35, 15, 12], [60, 35, 30]][sessionIndex];
  return sessions[sessionIndex].exercises.map((exercise, exerciseIndex) => ({
    name: exercise.name,
    sets: Array.from({ length: exercise.sets }, (_, setIndex) => ({
      reps: Number(exercise.reps) - (setIndex === exercise.sets - 1 ? 1 : 0),
      weight: Number((baseWeights[exerciseIndex] + week * (exerciseIndex === 2 ? 0.5 : 1.5)).toFixed(1)),
      rpe: Number((6.5 + Math.min(2, week * 0.12) + setIndex * 0.15).toFixed(1)),
      rir: Math.max(1, 3 - Math.floor(week / 5)), completed: true,
    })),
    notes: week % 4 === 0 ? 'Kỹ thuật ổn định, kiểm soát nhịp tốt.' : '',
  }));
}

async function seedProgressDemoForCenter() {
  const password = await bcrypt.hash(PASSWORD, 10);
  const pt = await User.findOneAndUpdate({ username: PT_USERNAME }, { $set: { fullName: 'PT Demo Tiến Độ', password, role: 'PT', status: 'ACTIVE', phone: '0900000990', specialization: 'Strength & Conditioning', yearsOfExperience: 6 } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
  const customerUser = await User.findOneAndUpdate({ username: CUSTOMER_USERNAME }, { $set: { fullName: 'Khách Demo Tiến Độ', password, role: 'CUSTOMER', status: 'ACTIVE', phone: '0900000992' } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
  const customer = await CustomerProfile.findOneAndUpdate({ phone: CUSTOMER_PHONE }, { $set: { userId: customerUser._id, assignedPtId: pt._id, fullName: 'Khách Demo Tiến Độ', email: 'demo.progress@3sgym.local', gender: 'FEMALE', height: 165, initialWeight: 78, medicalNotes: 'Không có chấn thương. Dữ liệu demo.', initialGoal: 'Giảm mỡ, tăng sức mạnh và duy trì 3 buổi/tuần.', internalNotes: 'Bộ dữ liệu demo-progress, có thể seed lại.', status: 'ACTIVE' } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
  const template = await WorkoutTemplate.findOneAndUpdate({ ownerPtId: pt._id, title: 'Demo · Strength Foundation 12 tuần' }, { $set: { goal: 'Giảm mỡ và tăng sức mạnh', level: 'INTERMEDIATE', durationDays: 84, sessions, muscleGroups: ['Chân', 'Mông', 'Ngực', 'Vai', 'Lưng'], version: 1, status: 'ACTIVE' } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });

  await WorkoutPlan.deleteMany({ customerId: customer._id });
  await WorkoutPlan.create({ customerId: customer._id, ptId: pt._id, title: template.title, startDate: new Date('2026-06-08T00:00:00.000Z'), endDate: new Date('2026-08-30T00:00:00.000Z'), sessions, sourceTemplateId: template._id, goal: template.goal, level: template.level, durationDays: 84, muscleGroups: template.muscleGroups, lifecycleStatus: 'ACTIVE', status: 'PUBLISHED', publishedAt: new Date('2026-06-01T00:00:00.000Z') });
  await Promise.all([WorkoutSession.deleteMany({ customerId: customer._id }), BodyMeasurement.deleteMany({ customerId: customer._id }), CalendarEvent.deleteMany({ customerId: customer._id }), ProgressPhoto.deleteMany({ customerId: customer._id }), ProgressReport.deleteMany({ customerId: customer._id })]);

  const start = new Date('2026-06-08T10:00:00.000Z');
  const workoutSessions = []; const calendarEvents = [];
  for (let week = 0; week < 12; week += 1) for (let sessionIndex = 0; sessionIndex < 3; sessionIndex += 1) {
    const sequence = week * 3 + sessionIndex; const performedAt = addDays(start, week * 7 + sessionIndex * 2);
    const attendance = [10, 25].includes(sequence) ? 'ABSENT' : [7, 19, 31].includes(sequence) ? 'LATE' : 'PRESENT';
    workoutSessions.push({ customerId: customer._id, ptId: pt._id, templateId: template._id, performedAt, attendance, absenceReason: attendance === 'ABSENT' ? 'Bận công việc đột xuất' : '', planSnapshot: { templateId: template._id, title: template.title, version: 1, session: sessions[sessionIndex] }, exerciseLogs: attendance === 'ABSENT' ? [] : exerciseLogs(sessionIndex, week), feeling: attendance === 'ABSENT' ? '' : week < 3 ? 'Hơi mỏi nhưng hoàn thành tốt.' : week < 8 ? 'Thể lực tốt, kiểm soát bài ổn.' : 'Khỏe và tự tin hơn rõ rệt.', notes: attendance === 'LATE' ? 'Đến muộn 10 phút, đã rút ngắn phần khởi động.' : `Tuần ${week + 1} · theo đúng giáo án.`, idempotencyKey: `demo-progress-session-${sequence + 1}` });
    calendarEvents.push({ ownerPtId: pt._id, customerId: customer._id, title: sessions[sessionIndex].name, startsAt: performedAt, endsAt: new Date(performedAt.getTime() + 75 * 60_000), notes: `Lịch demo tuần ${week + 1}`, status: attendance === 'ABSENT' ? 'CANCELLED' : 'COMPLETED' });
  }
  await WorkoutSession.insertMany(workoutSessions); await CalendarEvent.insertMany(calendarEvents);

  const measurements = Array.from({ length: 13 }, (_, index) => ({ customerId: customer._id, ptId: pt._id, measuredAt: addDays(new Date('2026-06-01T02:00:00.000Z'), index * 7), weight: Number((78 - index * 0.45).toFixed(1)), bodyFatPercentage: Number((24 - index * 0.35).toFixed(1)), muscleMass: Number((31 + index * 0.2).toFixed(1)), measurements: { chest: Number((94 - index * 0.12).toFixed(1)), waist: Number((86 - index * 0.55).toFixed(1)), hips: Number((101 - index * 0.3).toFixed(1)), arm: Number((30 + index * 0.08).toFixed(1)), thigh: Number((59 - index * 0.18).toFixed(1)), calf: Number((37 - index * 0.05).toFixed(1)) } }));
  await BodyMeasurement.insertMany(measurements);
  await ProgressPhoto.insertMany([
    { customerId: customer._id, ptId: pt._id, photoUrl: 'https://placehold.co/720x960/e2e8f0/334155?text=BEFORE', takenDate: '2026-06-01', stage: 'BEFORE', angle: 'FRONT', weight: 78, bodyFat: 24, notes: 'Ảnh bắt đầu chương trình.' },
    { customerId: customer._id, ptId: pt._id, photoUrl: 'https://placehold.co/720x960/dbeafe/1e40af?text=PROGRESS', takenDate: '2026-07-13', stage: 'PROGRESS', angle: 'FRONT', weight: 75.3, bodyFat: 21.9, notes: 'Ảnh giữa chương trình.' },
    { customerId: customer._id, ptId: pt._id, photoUrl: 'https://placehold.co/720x960/dcfce7/166534?text=AFTER', takenDate: '2026-08-24', stage: 'AFTER', angle: 'FRONT', weight: 72.6, bodyFat: 19.8, notes: 'Ảnh cuối chu kỳ 12 tuần.' },
  ]);
  await ProgressReport.insertMany([
    { customerId: customer._id, ptId: pt._id, periodStart: '2026-06-01', periodEnd: '2026-07-12', summary: 'Hoàn thành tốt nửa đầu chương trình. Cân nặng giảm đều, kỹ thuật squat ổn định và mức tạ tăng đúng kế hoạch.', metrics: { attendanceRate: 94.4, weightDelta: -2.7, bodyFatDelta: -2.1, muscleDelta: 1.2 }, sourceVersions: { analytics: 1 }, warnings: [], generatorVersion: 1, status: 'PUBLISHED', version: 1, publishedAt: '2026-07-13' },
    { customerId: customer._id, ptId: pt._id, periodStart: '2026-07-13', periodEnd: '2026-08-30', summary: 'Kết thúc 12 tuần với tiến bộ rõ rệt: giảm 5,4 kg, body fat giảm 4,2%, cơ tăng 2,4 kg và duy trì lịch tập ổn định.', metrics: { attendanceRate: 94.4, weightDelta: -5.4, bodyFatDelta: -4.2, muscleDelta: 2.4, streakWeeks: 12 }, sourceVersions: { analytics: 1 }, warnings: [], generatorVersion: 1, status: 'PUBLISHED', version: 1, publishedAt: '2026-08-29' },
  ]);
  return { ptUsername: PT_USERNAME, customerUsername: CUSTOMER_USERNAME, password: PASSWORD, customerId: customer.id, counts: { sessions: workoutSessions.length, measurements: measurements.length, calendarEvents: calendarEvents.length, photos: 3, reports: 2 } };
}

export async function seedProgressDemo() {
  const center = await runWithSystemCenterAccess(() => Center.findOne({ slug: '3s-gym' }).select({ _id: 1 }).lean());
  if (!center) throw new Error('Run npm run db:migrate before seeding progress demo data.');
  return runWithCenter(String(center._id), seedProgressDemoForCenter);
}
