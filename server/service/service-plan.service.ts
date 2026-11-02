import type { ClientSession } from "mongoose";
import { CompanyModel } from "../model/company.model";
import { ServicePlanModel } from "../model/service-plan.model";

const conflict = (message: string) => Object.assign(new Error(message), { statusCode: 409, code: "SERVICE_PLAN_CONFLICT" });
export const servicePlanService = {
  async current(companyCode: string) {
    const company = await CompanyModel.findOne({ code: companyCode.toUpperCase() }).select("code serviceSubscription").lean();
    if (!company) throw Object.assign(new Error("Không tìm thấy doanh nghiệp."), { statusCode: 404 });
    const value = company.serviceSubscription;
    return value ? { ...value, status: value.status === "active" && value.expiresAt <= new Date() ? "expired" : value.status } : null;
  },
  async assign(companyCode: string, planId: string, actorId: string, expectedStartsAt: string | null, planUpdatedAt: string, session: ClientSession) {
    const company = await CompanyModel.findOne({ code: companyCode.toUpperCase() }).session(session);
    if (!company) throw Object.assign(new Error("Không tìm thấy doanh nghiệp."), { statusCode: 404 });
    const existing = company.serviceSubscription;
    if ((existing?.startsAt?.toISOString() || null) !== expectedStartsAt) throw conflict("Gói doanh nghiệp đã thay đổi. Hãy tải lại.");
    const plan = await ServicePlanModel.findOne({ _id: planId, active: true }).session(session);
    if (!plan || plan.updatedAt.getTime() !== new Date(planUpdatedAt).getTime()) throw conflict("Danh mục gói đã thay đổi. Hãy tải lại.");
    const startsAt = new Date();
    const subscription = { planId: plan._id, planName: plan.name, priceVnd: plan.priceVnd,
      modules: [...plan.modules], startsAt, expiresAt: new Date(startsAt.getTime() + plan.durationDays * 86_400_000),
      status: "active" as const, assignedBy: actorId };
    company.serviceSubscription = subscription;
    company.enabledModules = [...plan.modules];
    await company.save({ session });
    return subscription;
  },
  async cancel(companyCode: string, expectedStartsAt: string, session: ClientSession) {
    const company = await CompanyModel.findOne({ code: companyCode.toUpperCase() }).session(session);
    const value = company?.serviceSubscription;
    if (!company || !value || value.status !== "active" || value.startsAt.toISOString() !== expectedStartsAt)
      throw conflict("Gói doanh nghiệp đã thay đổi. Hãy tải lại.");
    value.status = "cancelled";
    company.markModified("serviceSubscription");
    await company.save({ session });
    return value;
  },
};
