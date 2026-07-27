import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { ShiftAssignmentModel, WorkShiftModel } from "../model/work-shift.model";
import { UserModel } from "../model/user.model";
import { calculateStandardMinutes } from "../service/work-shift.service";

const tenant = (req: AuthenticatedRequest) => req.user?.companyCode || "SYSTEM";

export const workShiftController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const shifts = await WorkShiftModel.find({ companyCode: tenant(req) }).sort({ isDefault: -1, name: 1 }).lean();
    const counts = await ShiftAssignmentModel.aggregate([
      { $match: { companyCode: tenant(req), $or: [{ effectiveTo: null }, { effectiveTo: { $gte: new Date().toISOString().slice(0, 10) } }] } },
      { $group: { _id: "$shiftId", employeeCount: { $addToSet: "$employeeId" } } },
    ]);
    const countMap = new Map(counts.map((item) => [String(item._id), item.employeeCount.length]));
    return res.json({ status: "success", data: shifts.map((shift) => ({ ...shift, employeeCount: countMap.get(String(shift._id)) || 0 })) });
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const companyCode = tenant(req);
    const payload = { ...req.body, companyCode };
    payload.crossesMidnight = payload.crossesMidnight ?? payload.endTime <= payload.startTime;
    payload.standardMinutes = payload.standardMinutes || calculateStandardMinutes(payload.startTime, payload.endTime, payload.breakPeriods);
    if (payload.isDefault) await WorkShiftModel.updateMany({ companyCode, isDefault: true }, { $set: { isDefault: false } });
    try {
      const data = await WorkShiftModel.create(payload);
      return res.status(201).json({ status: "success", data });
    } catch (error: any) {
      if (error?.code === 11000) return res.status(409).json({ status: "error", message: "Mã ca đã tồn tại trong công ty." });
      throw error;
    }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const companyCode = tenant(req);
    const existing = await WorkShiftModel.findOne({ _id: req.params.id, companyCode });
    if (!existing) return res.status(404).json({ status: "error", message: "Không tìm thấy ca làm việc." });
    const payload = { ...req.body };
    const start = payload.startTime || existing.startTime;
    const end = payload.endTime || existing.endTime;
    const breaks = payload.breakPeriods || existing.breakPeriods;
    payload.crossesMidnight = payload.crossesMidnight ?? end <= start;
    payload.standardMinutes = payload.standardMinutes || calculateStandardMinutes(start, end, breaks as any);
    if (payload.isDefault) await WorkShiftModel.updateMany({ companyCode, _id: { $ne: existing._id }, isDefault: true }, { $set: { isDefault: false } });
    const data = await WorkShiftModel.findOneAndUpdate({ _id: existing._id, companyCode }, { $set: payload }, { new: true, runValidators: true });
    return res.json({ status: "success", data });
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    const companyCode = tenant(req);
    const assigned = await ShiftAssignmentModel.exists({ companyCode, shiftId: req.params.id });
    if (assigned) return res.status(409).json({ status: "error", message: "Ca đang được phân cho nhân viên. Hãy ngừng sử dụng ca thay vì xóa." });
    const data = await WorkShiftModel.findOneAndDelete({ _id: req.params.id, companyCode });
    if (!data) return res.status(404).json({ status: "error", message: "Không tìm thấy ca làm việc." });
    return res.json({ status: "success" });
  },

  async listAssignments(req: AuthenticatedRequest, res: Response) {
    const companyCode = tenant(req);
    const [employees, assignments] = await Promise.all([
      UserModel.find({ companyCode, isActive: { $ne: false } }).select("_id displayName email department role").sort({ displayName: 1 }).lean(),
      ShiftAssignmentModel.find({ companyCode }).sort({ effectiveFrom: -1 }).lean(),
    ]);
    const latest = new Map<string, any>();
    for (const item of assignments) if (!latest.has(item.employeeId)) latest.set(item.employeeId, item);
    return res.json({ status: "success", data: employees.map((employee) => ({ ...employee, assignment: latest.get(String(employee._id)) || null })) });
  },

  async assign(req: AuthenticatedRequest, res: Response) {
    const companyCode = tenant(req);
    const { employeeIds, shiftId, effectiveFrom, effectiveTo, daysOfWeek } = req.body;
    const [shift, users] = await Promise.all([
      WorkShiftModel.findOne({ _id: shiftId, companyCode, isActive: true }).lean(),
      UserModel.countDocuments({ _id: { $in: employeeIds }, companyCode }),
    ]);
    if (!shift) return res.status(404).json({ status: "error", message: "Không tìm thấy ca làm việc đang hoạt động." });
    if (users !== employeeIds.length) return res.status(400).json({ status: "error", message: "Danh sách có nhân viên không thuộc công ty." });
    const data = await ShiftAssignmentModel.insertMany(employeeIds.map((employeeId: string) => ({ companyCode, employeeId, shiftId, effectiveFrom, effectiveTo: effectiveTo || null, daysOfWeek: daysOfWeek?.length ? daysOfWeek : shift.workingDays })));
    return res.status(201).json({ status: "success", data });
  },
};
