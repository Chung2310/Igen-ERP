import { BranchModel } from "../model/branch.model";
import { AssistantSessionModel } from "../assistant/models";

export type AssistantFeedbackFilters = {
  from?: string;
  to?: string;
  companyCode?: string;
  branchId?: string;
  rating?: number;
  search?: string;
  page?: number;
  limit?: number;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class SuperAdminAssistantFeedbackService {
  async list(filters: AssistantFeedbackFilters = {}) {
    const page = Math.max(1, Math.trunc(filters.page || 1));
    const limit = Math.max(1, Math.min(100, Math.trunc(filters.limit || 20)));
    const sessionMatch: Record<string, unknown> = { mode: "work" };
    if (filters.companyCode) sessionMatch.companyCode = filters.companyCode;
    if (filters.branchId) sessionMatch.branchId = filters.branchId;

    const messageMatch: Record<string, unknown> = {
      "messages.role": "assistant",
      "messages.feedback.rating": filters.rating ? Number(filters.rating) : { $gte: 1, $lte: 5 },
      "messages.feedback.submittedAt": { $exists: true },
    };
    if (filters.from) messageMatch["messages.feedback.submittedAt"] = {
      ...(messageMatch["messages.feedback.submittedAt"] as Record<string, unknown>),
      $gte: new Date(`${filters.from}T00:00:00+07:00`),
    };
    if (filters.to) {
      const nextDay = new Date(`${filters.to}T00:00:00+07:00`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      messageMatch["messages.feedback.submittedAt"] = {
        ...(messageMatch["messages.feedback.submittedAt"] as Record<string, unknown>),
        $lt: nextDay,
      };
    }
    const search = filters.search?.trim();
    const searchRegex = search ? new RegExp(escapeRegex(search), "i") : undefined;
    const pipeline = [
      { $match: sessionMatch },
      { $unwind: "$messages" },
      { $match: messageMatch },
      ...(searchRegex ? [{ $match: { $or: [
        { "messages.feedback.question": searchRegex },
        { "messages.content": searchRegex },
        { "messages.feedback.comment": searchRegex },
        { "messages.feedback.displayName": searchRegex },
        { "messages.feedback.email": searchRegex },
        { companyCode: searchRegex },
      ] } }] : []),
      { $sort: { "messages.feedback.submittedAt": -1, _id: -1 } },
      { $facet: {
        summary: [{ $group: {
          _id: null,
          total: { $sum: 1 },
          average: { $avg: "$messages.feedback.rating" },
          lowRatingCount: { $sum: { $cond: [{ $lte: ["$messages.feedback.rating", 2] }, 1, 0] } },
        } }],
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: {
            _id: 0,
            companyCode: 1,
            branchId: 1,
            userName: "$messages.feedback.displayName",
            userEmail: "$messages.feedback.email",
            question: "$messages.feedback.question",
            answer: "$messages.content",
            rating: "$messages.feedback.rating",
            comment: "$messages.feedback.comment",
            submittedAt: "$messages.feedback.submittedAt",
          } },
        ],
      } },
    ];
    const [result] = await AssistantSessionModel.aggregate(pipeline as any[]);
    const summaryRow = result?.summary?.[0];
    const items = Array.isArray(result?.items) ? result.items : [];
    const branchIds = [...new Set(items.map((item: any) => String(item.branchId || "")).filter((id: string) => /^[a-f\d]{24}$/i.test(id)))];
    const companyCodes = [...new Set(items.map((item: any) => String(item.companyCode || "")).filter(Boolean))];
    const branches = branchIds.length
      ? await BranchModel.find({ _id: { $in: branchIds }, companyCode: { $in: companyCodes } } as any).select("_id name code").lean()
      : [];
    const branchNames = new Map(branches.map((branch: any) => [String(branch._id), `${branch.name} (${branch.code})`]));

    return {
      items: items.map((item: any) => ({
        ...item,
        branchName: branchNames.get(String(item.branchId || "")) || (item.branchId ? String(item.branchId) : "Toàn doanh nghiệp"),
        submittedAt: item.submittedAt instanceof Date ? item.submittedAt.toISOString() : String(item.submittedAt || ""),
      })),
      total: Number(summaryRow?.total) || 0,
      page,
      limit,
      summary: {
        total: Number(summaryRow?.total) || 0,
        averageRating: Math.round((Number(summaryRow?.average) || 0) * 10) / 10,
        lowRatingCount: Number(summaryRow?.lowRatingCount) || 0,
      },
    };
  }

  async branches(companyCode: string) {
    const rows = await BranchModel.find({ companyCode }).select("_id code name").sort({ name: 1 }).lean();
    return rows.map((branch: any) => ({ id: String(branch._id), code: branch.code, name: branch.name }));
  }
}

export const superAdminAssistantFeedbackService = new SuperAdminAssistantFeedbackService();
