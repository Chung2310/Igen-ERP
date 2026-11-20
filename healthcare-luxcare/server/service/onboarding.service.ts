import { organizationInvitationsConfigured } from "../config/onboarding";
import mongoose, { type ClientSession } from "mongoose";
import { createHmac, randomInt, randomUUID } from "node:crypto";
import { archiveHistoricalUser } from "./historical-user.service";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { BranchModel } from "../model/branch.model";
import {
  CompanyApplicationModel as Applications,
  CompanyInvitationModel as Invitations,
  EmailVerificationModel as Verifications,
  AccountDeletionRequestModel as Deletions,
  PlatformMailOutboxModel as Mail,
  onboardingModels,
} from "../model/onboarding.model";
import { assertPlatformEmailConfigured, queuePlatformMail } from "./platform-email.service";
import { renderVerificationEmail } from "./platform-email-templates";
import { clearModuleCache } from "../middleware/require-module";
import { getSuperAdminEncryptionKey } from "../config/env";
const verificationHash = (version: string, code: string) =>
  createHmac("sha256", getSuperAdminEncryptionKey())
    .update(version + ":" + code)
    .digest("hex");
import { MODULE_KEYS } from "../config/module-keys";
import type { CompanyApplicationInput } from "../../shared/onboarding";

export class OnboardingError extends Error {
  constructor(
    message: string,
    public statusCode = 409,
    public code = "ONBOARDING_CONFLICT",
  ) {
    super(message);
  }
}
let ready = false;
export function isPublicRegistrationEnabled() {
  return false;
}
export function isInvitationRegistrationEnabled() {
  return false;
}
export async function prepareOnboarding() {
  ready = false;
  if (!organizationInvitationsConfigured()) return;
  assertPlatformEmailConfigured();
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new Error("Public onboarding requires MongoDB replica set or sharded cluster; standalone is not supported.");
  for (const model of onboardingModels) {
    await model.createCollection();
    await model.createIndexes();
  }
  await BranchModel.createCollection();
  await BranchModel.createIndexes();
  await CompanyModel.createIndexes();
  ready = true;
}
function requireEnabled() {
  if (!ready || !organizationInvitationsConfigured())
    throw new OnboardingError(
      "Tiếp nhận lời mời đang tạm đóng. Vui lòng liên hệ quản trị viên tổ chức.",
      503,
      "ONBOARDING_DISABLED",
    );
}
async function transaction<T>(
  fn: (session: ClientSession) => Promise<T>,
  options: { requireRegistration?: boolean } = {},
): Promise<T> {
  if (options.requireRegistration !== false) requireEnabled();
  const session = await mongoose.startSession();
  try {
    return (await session.withTransaction(() => fn(session)))!;
  } finally {
    await session.endSession();
  }
}
const unassigned = { companyCode: { $in: [null, ""] } };
async function lockApplicant(userId: string, session: ClientSession, verified = true) {
  const user = await UserModel.findOneAndUpdate(
    {
      _id: userId,
      role: { $in: ["user", "trial_user"] },
      $or: [
        { role: "user", ...unassigned },
        { role: "trial_user", companyCode: { $type: "string", $ne: "" } },
      ],
      disabledAt: null,
      ...(verified ? { emailVerifiedAt: { $ne: null } } : {}),
    },
    { $inc: { onboardingRevision: 1 } },
    { session, returnDocument: "after" },
  );
  if (!user)
    throw new OnboardingError(
      "Tài khoản phải xác minh email và chưa thuộc doanh nghiệp nào.",
      403,
      "ONBOARDING_REQUIRED",
    );
  if (user.role === "trial_user") {
    const workspace = await CompanyModel.findOne({
      code: user.companyCode,
      trialOwnerId: String(user._id),
      lifecycleStatus: "trial",
    }).session(session);
    if (!workspace)
      throw new OnboardingError("Workspace trải nghiệm không còn khả dụng.", 403, "TRIAL_WORKSPACE_INVALID");
  }
  if (await Deletions.exists({ userId, active: true }).session(session))
    throw new OnboardingError("Tài khoản đang có yêu cầu xóa. Hãy hủy yêu cầu trước khi tiếp tục.");
  return user;
}
async function issueCode(user: any, session: ClientSession) {
  const previous = await Verifications.findOne({ userId: String(user._id) }).session(session);
  if (previous?.lastSentAt && Date.now() - previous.lastSentAt.getTime() < 60000)
    throw new OnboardingError("Vui lòng chờ 60 giây trước khi gửi lại mã.", 429, "EMAIL_COOLDOWN");
  const code = String(randomInt(100000, 1000000));
  const version = randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60000);
  await Verifications.updateOne(
    { userId: String(user._id) },
    {
      $set: {
        email: user.email,
        version,
        codeHash: verificationHash(version, code),
        attempts: 0,
        expiresAt,
        lastSentAt: new Date(),
      },
    },
    { upsert: true, session },
  );
  await queuePlatformMail(
    "verify:" + version,
    user.email,
    "Xác minh tài khoản LuxCare",
    "Mã xác minh của bạn: " + code + ". Mã có hiệu lực 15 phút. Không chia sẻ mã này.",
    {
      session,
      userId: String(user._id),
      expiresAt,
      html: renderVerificationEmail(user.displayName, code),
    },
  );
}
async function notify(user: any, event: string, subject: string, text: string, session: ClientSession) {
  await queuePlatformMail(event, user.email, subject, text, { session, userId: String(user._id) });
}
export const onboardingService = {
  async register(_data: {
    email: string;
    password: string;
    displayName: string;
    phone?: string;
    termsAccepted?: boolean;
    personalAiConsent?: boolean;
    personalAiDisclosureFingerprint?: string;
  }): Promise<never> {
    throw new OnboardingError(
      "Tài khoản do quản trị viên doanh nghiệp cung cấp. Vui lòng liên hệ quản trị viên để được cấp tài khoản.",
      410,
      "SELF_REGISTRATION_DISABLED",
    );
  },
  async verifyRegistration(_emailInput: string, _code: string): Promise<never> {
    throw new OnboardingError(
      "Tạo tài khoản từ lời mời đã dừng. Vui lòng đăng nhập bằng tài khoản do quản trị viên doanh nghiệp cung cấp.",
      410,
      "SELF_REGISTRATION_DISABLED",
    );
  },
  async state(userId: string) {
    const user = await UserModel.findById(userId).select("email role companyCode emailVerifiedAt").lean();
    if (!user) throw new OnboardingError("Không tìm thấy tài khoản.", 404);
    await Invitations.updateMany(
      { email: user.email, active: true, expiresAt: { $lte: new Date() } },
      { $set: { status: "expired", active: false } },
    );
    const [applications, invitations, deletionRequest] = await Promise.all([
      Applications.find({ userId }).sort({ createdAt: -1 }).limit(20).lean(),
      user.emailVerifiedAt
        ? Invitations.find({ email: user.email, active: true }).sort({ createdAt: -1 }).limit(50).lean()
        : [],
      Deletions.findOne({ userId, active: true }).select("status dueAt").lean(),
    ]);
    return {
      personalAiEnabled: false,
      emailVerified: Boolean(user.emailVerifiedAt),
      companyCode: user.companyCode,
      applications,
      invitations,
      deletionRequest,
    };
  },
  async resendCode(userId: string) {
    return transaction(async (session) => {
      const user = await lockApplicant(userId, session, false);
      if (user.emailVerifiedAt) return { verified: true };
      await issueCode(user, session);
      return { sent: true };
    });
  },
  async verify(userId: string, code: string) {
    // Return failure from the transaction, then throw outside: attempted codes must not roll back.
    const success = await transaction(async (session) => {
      const user = await lockApplicant(userId, session, false);
      if (user.emailVerifiedAt) return true;
      const challenge = await Verifications.findOneAndUpdate(
        {
          userId,
          email: user.email,
          expiresAt: { $gt: new Date() },
          attempts: { $lt: 5 },
        },
        { $inc: { attempts: 1 } },
        { session, returnDocument: "after" },
      );
      if (!challenge || verificationHash(challenge.version, code) !== challenge.codeHash) return false;
      await UserModel.updateOne({ _id: userId }, { $set: { emailVerifiedAt: new Date() } }, { session });
      await Verifications.deleteOne({ userId }, { session });
      return true;
    });
    if (!success)
      throw new OnboardingError(
        "Mã không đúng, đã hết hạn hoặc đã thử quá 5 lần. Hãy gửi lại mã.",
        400,
        "EMAIL_CODE_INVALID",
      );
    return { verified: true };
  },
  async submit(_userId: string, _input: CompanyApplicationInput, _applicationId?: string, _revision?: number) {
    throw new OnboardingError(
      "Tổ chức được LuxCare cấp workspace theo thỏa thuận doanh nghiệp. Hãy liên hệ quản trị viên để được mời.",
      410,
      "ORGANIZATION_APPLICATION_DISABLED",
    );
  },
  async cancel(userId: string, id: string) {
    return transaction(async (session) => {
      await lockApplicant(userId, session);
      const app = await Applications.findOneAndUpdate(
        { _id: id, userId, active: true },
        {
          $set: { status: "cancelled", active: false },
          $inc: { revision: 1 },
          $push: { history: { status: "cancelled", actorId: userId, at: new Date() } },
        },
        { session, returnDocument: "after" },
      );
      if (!app) throw new OnboardingError("Đơn không còn có thể hủy.");
      return app;
    });
  },
  async review(actorId: string, id: string, input: any) {
    return transaction(async (session) => {
      const app = await Applications.findById(id).session(session);
      if (!app) throw new OnboardingError("Không tìm thấy đơn.", 404);
      // Safe recovery after a committed approval whose HTTP response was lost.
      if (
        app.status === "approved" &&
        input.decision === "approved" &&
        (!input.companyCode || app.companyCode === input.companyCode)
      )
        return app;
      if (app.status !== "pending" || app.revision !== input.revision)
        throw new OnboardingError("Đơn đã thay đổi. Hãy tải lại.");
      const user = await lockApplicant(app.userId, session);
      if (input.decision === "approved") {
        const trialWorkspace =
          user.role === "trial_user"
            ? await CompanyModel.findOne({
                code: user.companyCode,
                trialOwnerId: String(user._id),
                lifecycleStatus: "trial",
              }).session(session)
            : null;
        const code = trialWorkspace
          ? String(trialWorkspace.code)
          : String(input.companyCode || "")
              .trim()
              .toUpperCase();
        if (!code || code === "SYSTEM") throw new OnboardingError("Mã công ty không hợp lệ.", 400);
        if (trialWorkspace && input.companyCode && String(input.companyCode).toUpperCase() !== code)
          throw new OnboardingError("Workspace trải nghiệm sẽ được giữ nguyên mã để bảo toàn dữ liệu.", 400);
        if (!trialWorkspace && (await CompanyModel.exists({ code }).session(session)))
          throw new OnboardingError("Mã công ty đã được sử dụng.");

        let branchId = user.branchId ? String(user.branchId) : "";
        if (trialWorkspace) {
          const updatedWorkspace = await CompanyModel.updateOne(
            { _id: trialWorkspace._id, trialOwnerId: String(user._id), lifecycleStatus: "trial" },
            {
              $set: {
                name: app.companyName,
                ownerEmail: user.email,
                businessType: app.businessType,
                enabledModules: input.enabledModules,
                onboardingApplicationId: String(app._id),
                modulePolicyManaged: true,
                lifecycleStatus: "active",
                lifecycleChangedAt: new Date(),
                locationConfig: { addressName: app.address, latitude: 0, longitude: 0, allowedRadius: 1 },
              },
              $unset: { trialOwnerId: "" },
            },
            { session, runValidators: true },
          );
          if (!updatedWorkspace.matchedCount) throw new OnboardingError("Workspace đã thay đổi. Hãy tải lại hồ sơ.");
          const branch = await BranchModel.findOneAndUpdate(
            { _id: branchId, companyCode: code },
            {
              $set: {
                name: "Trụ sở chính",
                address: app.address,
                phone: app.phone,
                managerId: String(user._id),
                pendingOwnerSetup: true,
                isActive: true,
              },
            },
            { session, returnDocument: "after" },
          );
          if (!branch) throw new OnboardingError("Không tìm thấy chi nhánh chính của workspace.");
          branchId = String(branch._id);
        } else {
          await CompanyModel.create(
            [
              {
                code,
                name: app.companyName,
                ownerEmail: user.email,
                businessType: app.businessType,
                enabledModules: input.enabledModules,
                onboardingApplicationId: String(app._id),
                modulePolicyManaged: true,
                lifecycleStatus: "active",
                locationConfig: { addressName: app.address, latitude: 0, longitude: 0, allowedRadius: 1 },
              },
            ],
            { session },
          );
          const [branch] = await BranchModel.create(
            [
              {
                companyCode: code,
                code: "MAIN",
                name: "Trụ sở chính",
                address: app.address,
                phone: app.phone,
                managerId: String(user._id),
                pendingOwnerSetup: true,
              },
            ],
            { session },
          );
          branchId = String(branch._id);
        }
        const promoted = await UserModel.updateOne(
          trialWorkspace
            ? { _id: user._id, role: "trial_user", companyCode: code }
            : { _id: user._id, role: "user", ...unassigned },
          {
            $set: {
              role: "admin",
              companyCode: code,
              companyName: app.companyName,
              branchId,
              level: 1,
              permissions: [],
              parentId: "",
              isLeader: true,
              onboardingRequired: false,
            },
          },
          { session },
        );
        if (!promoted.matchedCount) throw new OnboardingError("Tài khoản đã thay đổi. Hãy tải lại hồ sơ.");
        clearModuleCache(code);
        app.companyCode = code;
        await Invitations.updateMany(
          { email: user.email, active: true },
          { $set: { status: "declined", active: false } },
          { session },
        );
      }
      app.status = input.decision;
      app.active = input.decision === "needs_information";
      app.reviewedBy = actorId;
      app.reviewerNote = input.note || "";
      app.revision++;
      app.history.push({ status: input.decision, actorId, note: input.note, at: new Date() });
      await app.save({ session });
      await notify(
        user,
        "application:" + app._id + ":" + app.revision,
        "Cập nhật đơn đăng ký doanh nghiệp LuxCare",
        "Đơn của bạn: " + input.decision + ". " + (input.note || "") + "\nĐăng nhập LuxCare để xem và tiếp tục.",
        session,
      );
      return app;
    });
  },
  async invite(actorId: string, companyCode: string, email: string, branchId: string) {
    return transaction(async (session) => {
      const admin = await UserModel.findOneAndUpdate(
        { _id: actorId, companyCode, role: "admin", disabledAt: null },
        { $inc: { onboardingRevision: 1 } },
        { session, returnDocument: "after" },
      );
      const company = await CompanyModel.findOne({ code: companyCode, lifecycleStatus: "active" }).session(session);
      if (!admin || !company) throw new OnboardingError("Bạn không có quyền mời vào doanh nghiệp này.", 403);
      const branch = await BranchModel.findOne({ _id: branchId, companyCode, isActive: true }).session(session);
      if (!branch) throw new OnboardingError("Chi nhánh không thuộc công ty hoặc đã ngừng hoạt động.", 400);
      const target = await UserModel.findOne({ email }).session(session);
      if (!target)
        throw new OnboardingError(
          "Hãy tạo tài khoản nhân viên trong Quản lý người dùng trước khi gửi lời mời.",
          409,
          "ACCOUNT_PROVISIONING_REQUIRED",
        );
      const targetHasOwnedTrialWorkspace =
        target?.role === "trial_user" && target.companyCode
          ? Boolean(
              await CompanyModel.exists({
                code: target.companyCode,
                trialOwnerId: String(target._id),
                lifecycleStatus: "trial",
              }).session(session),
            )
          : false;
      if (target && !targetHasOwnedTrialWorkspace && (target.companyCode || target.role !== "user"))
        throw new OnboardingError(
          "Email đã thuộc doanh nghiệp hoặc vai trò khác. Không thể chuyển công ty bằng lời mời.",
        );
      await Invitations.updateMany(
        { companyCode, email, active: true, expiresAt: { $lte: new Date() } },
        { $set: { status: "expired", active: false } },
        { session },
      );
      const existing = await Invitations.findOne({ companyCode, email, active: true }).session(session);
      if (existing) {
        if (existing.branchId !== branchId)
          throw new OnboardingError("Email đã có lời mời tới chi nhánh khác. Hãy thu hồi trước.");
        return existing;
      }
      const [invite] = await Invitations.create(
        [
          {
            companyCode,
            companyName: company.name,
            branchId,
            inviterId: actorId,
            email,
            expiresAt: new Date(Date.now() + 7 * 86400000),
            lastSentAt: new Date(),
            history: [{ status: "pending", actorId, at: new Date() }],
          },
        ],
        { session },
      );
      await queuePlatformMail(
        "invite:" + invite._id,
        email,
        "Lời mời tham gia " + company.name,
        "Bạn được mời vào " +
          company.name +
          " với vai trò nhân viên. Lời mời có hiệu lực 7 ngày.\n" +
          "Đăng nhập bằng tài khoản đã được cấp và xác nhận lời mời tại: " +
          process.env.PLATFORM_PUBLIC_URL,
        { session, userId: target ? String(target._id) : undefined, expiresAt: invite.expiresAt },
      );
      return invite;
    });
  },
  async resendInvitation(actorId: string, companyCode: string, id: string) {
    return transaction(async (session) => {
      const actor = await UserModel.findOneAndUpdate(
        { _id: actorId, companyCode, role: "admin", disabledAt: null },
        { $inc: { onboardingRevision: 1 } },
        { session },
      );
      const company = await CompanyModel.findOne({ code: companyCode, lifecycleStatus: "active" }).session(session);
      if (!actor || !company) throw new OnboardingError("Không có quyền gửi lại lời mời.", 403);
      const invite = await Invitations.findOne({
        _id: id,
        companyCode,
        active: true,
        status: "pending",
        expiresAt: { $gt: new Date() },
      }).session(session);
      if (!invite) throw new OnboardingError("Lời mời không còn hiệu lực.");
      if (Date.now() - (invite.lastSentAt || invite.createdAt).getTime() < 60000)
        throw new OnboardingError("Chờ 60 giây trước khi gửi lại.", 429);
      invite.lastSentAt = new Date();
      invite.mailVersion = (invite.mailVersion || 1) + 1;
      await invite.save({ session });
      await queuePlatformMail(
        "invite:" + invite._id + ":" + invite.mailVersion,
        invite.email,
        "Lời mời tham gia " + company.name,
        "Đăng nhập bằng tài khoản đã được cấp và xác nhận lời mời tại " + process.env.PLATFORM_PUBLIC_URL,
        { session, expiresAt: invite.expiresAt },
      );
      return invite;
    });
  },
  async revoke(actorId: string, companyCode: string, id: string) {
    return transaction(async (session) => {
      const actor = await UserModel.findOneAndUpdate(
        { _id: actorId, companyCode, role: "admin", disabledAt: null },
        { $inc: { onboardingRevision: 1 } },
        { session },
      );
      if (!actor) throw new OnboardingError("Không có quyền thu hồi.", 403);
      const invite = await Invitations.findOneAndUpdate(
        { _id: id, companyCode, active: true, status: "pending" },
        {
          $set: { active: false, status: "revoked" },
          $push: { history: { status: "revoked", actorId, at: new Date() } },
        },
        { session, returnDocument: "after" },
      );
      if (!invite) throw new OnboardingError("Lời mời đã thay đổi hoặc đã được xác nhận.");
      return invite;
    });
  },
  async answerInvite(userId: string, id: string, accept: boolean) {
    return transaction(async (session) => {
      const previous = await Invitations.findById(id).session(session);
      const current = await UserModel.findById(userId).session(session);
      if (
        previous &&
        current &&
        previous.acceptedBy === userId &&
        previous.email === current.email &&
        previous.status === (accept ? "accepted" : "declined") &&
        (!accept || current.companyCode === previous.companyCode)
      )
        return previous;
      const user = await lockApplicant(userId, session);
      const invite = await Invitations.findOne({
        _id: id,
        email: user.email,
        active: true,
        status: "pending",
        expiresAt: { $gt: new Date() },
      }).session(session);
      if (!invite) throw new OnboardingError("Lời mời đã hết hạn, bị thu hồi hoặc không dành cho email này.");
      if (accept) {
        const company = await CompanyModel.findOne({ code: invite.companyCode, lifecycleStatus: "active" }).session(
          session,
        );
        const branch = await BranchModel.findOne({
          _id: invite.branchId,
          companyCode: invite.companyCode,
          isActive: true,
        }).session(session);
        const admin = await UserModel.findOne({
          _id: invite.inviterId,
          role: "admin",
          companyCode: invite.companyCode,
          disabledAt: null,
        }).session(session);
        if (!company || !branch || !admin)
          throw new OnboardingError("Công ty, chi nhánh hoặc người mời không còn khả dụng.");
        if (user.role === "trial_user") {
          await CompanyModel.updateOne(
            { code: user.companyCode, trialOwnerId: String(user._id), lifecycleStatus: "trial" },
            {
              $set: {
                lifecycleStatus: "archived",
                lifecycleChangedAt: new Date(),
                ownerEmail: `archived-${user._id}@invalid.example`,
              },
              $unset: { trialOwnerId: "" },
            },
            { session },
          );
          await BranchModel.updateMany({ companyCode: user.companyCode }, { $set: { isActive: false } }, { session });
        }
        // Both approval and acceptance write this same user document inside their transactions.
        await UserModel.updateOne(
          user.role === "trial_user"
            ? { _id: userId, role: "trial_user", companyCode: user.companyCode }
            : { _id: userId, ...unassigned },
          {
            $set: {
              companyCode: invite.companyCode,
              companyName: company.name,
              branchId: invite.branchId,
              role: "user",
              level: 4,
              parentId: invite.inviterId,
              permissions: [],
              isLeader: false,
            },
          },
          { session },
        );
        await Applications.updateMany(
          { userId, active: true },
          {
            $set: { status: "cancelled", active: false },
            $inc: { revision: 1 },
            $push: {
              history: { status: "cancelled", actorId: userId, note: "Đã tham gia doanh nghiệp", at: new Date() },
            },
          },
          { session },
        );
        await Invitations.updateMany(
          { email: user.email, _id: { $ne: invite._id }, active: true },
          { $set: { status: "declined", active: false } },
          { session },
        );
      }
      invite.status = accept ? "accepted" : "declined";
      invite.active = false;
      invite.acceptedBy = userId;
      invite.acceptedAt = new Date();
      invite.history.push({ status: invite.status, actorId: userId, at: new Date() });
      await invite.save({ session });
      return invite;
    });
  },
  async requestDeletion(user: any) {
    return transaction(
      async (session) => {
        const locked = await UserModel.findOneAndUpdate(
          { _id: user._id, role: { $in: ["admin", "trial_user"] }, companyCode: user.companyCode },
          { $inc: { onboardingRevision: 1 } },
          { session, returnDocument: "after" },
        );
        if (!locked) throw new OnboardingError("Tài khoản đã thay đổi.");
        const request = await Deletions.findOneAndUpdate(
          { userId: String(user._id), active: true },
          {
            $setOnInsert: {
              userId: String(user._id),
              email: user.email,
              companyCode: user.companyCode,
              status: "requested",
              dueAt: new Date(Date.now() + 7 * 86400000),
            },
          },
          { session, upsert: true, returnDocument: "after" },
        );
        await notify(
          user,
          "delete-request:" + request._id,
          "Đã tiếp nhận yêu cầu xóa tài khoản LuxCare",
          "Yêu cầu sẽ được xử lý trong 7 ngày. Bạn có thể xem trạng thái hoặc hủy tại ứng dụng. Dữ liệu của các đồng nghiệp được giữ lại.",
          session,
        );
        return request;
      },
      { requireRegistration: false },
    );
  },
  async cancelDeletion(userId: string) {
    return transaction(
      async (session) => {
        await UserModel.updateOne({ _id: userId }, { $inc: { onboardingRevision: 1 } }, { session });
        const result = await Deletions.findOneAndUpdate(
          { userId, active: true },
          { $set: { active: false, status: "cancelled" } },
          { session, returnDocument: "after" },
        );
        if (!result) throw new OnboardingError("Yêu cầu không còn có thể hủy.");
        return result;
      },
      { requireRegistration: false },
    );
  },
  async completeDeletion(actorId: string, id: string) {
    const result = await transaction(
      async (session) => {
        const request = await Deletions.findById(id).session(session);
        if (!request) throw new OnboardingError("Không tìm thấy yêu cầu.", 404);
        if (request.status === "completed") return request;
        if (!request.active) throw new OnboardingError("Yêu cầu đã bị hủy.");
        const companyScope = request.companyCode
          ? { companyCode: request.companyCode }
          : { $or: [{ companyCode: { $exists: false } }, { companyCode: null }, { companyCode: "" }] };
        const user = await UserModel.findOneAndUpdate(
          { _id: request.userId, ...companyScope, role: { $ne: "superadmin" } },
          { $inc: { onboardingRevision: 1 } },
          { session, returnDocument: "after" },
        );
        if (!user) throw new OnboardingError("Tài khoản đã đổi công ty hoặc không tồn tại.");
        // Do not delete colleagues or company records. A company without an admin is suspended.
        const hasCompany = Boolean(request.companyCode?.trim());
        const replacement = hasCompany
          ? await UserModel.findOne({
              companyCode: request.companyCode,
              role: "admin",
              _id: { $ne: user._id },
              disabledAt: null,
            }).session(session)
          : null;
        if (hasCompany)
          await CompanyModel.updateOne(
            { code: request.companyCode, ownerEmail: user.email },
            replacement
              ? { $set: { ownerEmail: replacement.email } }
              : { $set: { ownerEmail: "deleted-" + request._id + "@invalid.example", lifecycleStatus: "suspended" } },
            { session },
          );
        if (hasCompany && !replacement)
          await CompanyModel.updateOne(
            { code: request.companyCode },
            { $set: { lifecycleStatus: "suspended" } },
            { session },
          );
        if (hasCompany) {
          await UserModel.updateMany(
            { parentId: request.userId, companyCode: request.companyCode },
            { $set: { parentId: replacement ? String(replacement._id) : "" } },
            { session },
          );
          await BranchModel.updateMany(
            { managerId: request.userId, companyCode: request.companyCode },
            { $set: { managerId: replacement ? String(replacement._id) : "", pendingOwnerSetup: !replacement } },
            { session },
          );
        }
        await archiveHistoricalUser(user, { session });
        await cleanupOnboardingAccount(request.userId, user.email, session);
        const { MobilePushDevice } = await import("../model/mobile-push.model");
        await MobilePushDevice.deleteMany({ uid: request.userId }, { session });
        await UserModel.deleteOne({ _id: user._id }, { session });
        // Send completion to original email only through the encrypted short-lived outbox.
        await queuePlatformMail(
          "delete-completed:" + request._id,
          user.email,
          "Đã xóa tài khoản LuxCare",
          "Tài khoản LuxCare của bạn đã được xóa. Hồ sơ nghiệp vụ cần lưu của doanh nghiệp được giữ theo chính sách dữ liệu.",
          { session, expiresAt: new Date(Date.now() + 7 * 86400000) },
        );
        request.status = "completed";
        request.active = false;
        request.completedAt = new Date();
        request.completedBy = actorId;
        request.email = undefined;
        await request.save({ session });
        return request;
      },
      { requireRegistration: false },
    );
    const { disconnectUserSockets } = await import("../socket");
    disconnectUserSockets(result.userId);
    return result;
  },
};
export async function cleanupOnboardingAccount(userId: string, email: string, session?: ClientSession) {
  const { cleanupBlogSafety } = await import("./blog-moderation.service");
  await cleanupBlogSafety(userId, session);
  // Applicant PII is not retained in cancelled requests after account deletion.
  await Applications.deleteMany({ userId }, { session });
  await Invitations.updateMany(
    { inviterId: userId, active: true },
    { $set: { active: false, status: "revoked" } },
    { session },
  );
  await Deletions.updateMany(
    { userId, active: true },
    { $set: { active: false, status: "completed", completedAt: new Date() }, $unset: { email: 1 } },
    { session },
  );
  await Deletions.updateMany({ userId }, { $unset: { email: 1 } }, { session });
  await Invitations.deleteMany({ email }, { session });
  await Verifications.deleteMany({ userId }, { session });
  await Mail.deleteMany({ userId }, { session });
  const { FreeAiRequestModel, FreeAiGuardModel } = await import("../model/ai-access.model");
  await FreeAiRequestModel.deleteMany({ userId }, { session });
  await FreeAiGuardModel.deleteOne({ key: `user:${userId}` }, { session });
}
export { MODULE_KEYS };
