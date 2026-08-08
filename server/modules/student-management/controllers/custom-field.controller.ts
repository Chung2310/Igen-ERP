import type { NextFunction, Response } from "express";
import type { ModuleKey } from "../interfaces/custom-field.interface";
import { type CreateFieldInput, CustomFieldService, type UpdateFieldInput } from "../services/custom-field.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { canManageCustomFields, resolveCustomFieldTenant } from "../utils/custom-field.util";
import { CustomFieldUploadService } from "../services/custom-field-upload.service";

type CustomFieldServiceContract = Pick<CustomFieldService, "list" | "create" | "update" | "archive" | "restore" | "delete">;

function messageFor(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function sendExpectedError(error: unknown, res: Response): boolean {
  const message = messageFor(error);
  if (!message) return false;

  if (/không tìm thấy|not found/i.test(message)) {
    res.status(404).json({ success: false, error: message });
    return true;
  }

  if (/trùng|duplicate|conflict|đã có|không thể thay đổi loại/i.test(message)) {
    res.status(409).json({ success: false, error: message });
    return true;
  }

  if (/không hợp lệ|lựa chọn|dành riêng|phải có|không thể/i.test(message)) {
    res.status(400).json({ success: false, error: message });
    return true;
  }

  return false;
}

function createInput(req: AuthRequest): CreateFieldInput {
  const { label, type, placeholder, defaultValue, options, validation, isVisible, isRequired } = req.body;
  return Object.fromEntries(Object.entries({
    moduleKey: req.params.moduleKey as ModuleKey,
    label,
    type,
    placeholder,
    defaultValue,
    options,
    validation,
    isVisible,
    isRequired,
  }).filter(([, value]) => value !== undefined)) as CreateFieldInput;
}

function updateInput(req: AuthRequest): UpdateFieldInput {
  const { label, type, placeholder, defaultValue, options, validation, isVisible, isRequired, order } = req.body;
  return Object.fromEntries(Object.entries({ label, type, placeholder, defaultValue, options, validation, isVisible, isRequired, order }).filter(([, value]) => value !== undefined)) as UpdateFieldInput;
}

export class CustomFieldController {
  static service: CustomFieldServiceContract = new CustomFieldService();
  static uploadService = new CustomFieldUploadService();

  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tenantId = await resolveCustomFieldTenant(req.user!, req.query?.tenantId);
      const includeArchived = (req.query.includeArchived as unknown) === true && canManageCustomFields(req.user!.role);
      const data = await CustomFieldController.service.list(tenantId, req.params.moduleKey as ModuleKey, includeArchived);
      res.json({ success: true, data });
    } catch (error) {
      if (!sendExpectedError(error, res)) next(error);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await CustomFieldController.service.create(
        { tenantId: await resolveCustomFieldTenant(req.user!, req.query?.tenantId), actorId: req.user!.uid },
        createInput(req),
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      if (!sendExpectedError(error, res)) next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await CustomFieldController.service.update(
        { tenantId: await resolveCustomFieldTenant(req.user!, req.query?.tenantId), actorId: req.user!.uid },
        req.params.moduleKey as ModuleKey,
        req.params.id,
        updateInput(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      if (!sendExpectedError(error, res)) next(error);
    }
  }

  static async archive(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await CustomFieldController.service.archive(
        { tenantId: await resolveCustomFieldTenant(req.user!, req.query?.tenantId), actorId: req.user!.uid },
        req.params.moduleKey as ModuleKey,
        req.params.id,
      );
      res.json({ success: true, data });
    } catch (error) {
      if (!sendExpectedError(error, res)) next(error);
    }
  }

  static async restore(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await CustomFieldController.service.restore(
        { tenantId: await resolveCustomFieldTenant(req.user!, req.query?.tenantId), actorId: req.user!.uid },
        req.params.moduleKey as ModuleKey,
        req.params.id,
      );
      res.json({ success: true, data });
    } catch (error) {
      if (!sendExpectedError(error, res)) next(error);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await CustomFieldController.service.delete(
        { tenantId: await resolveCustomFieldTenant(req.user!, req.query?.tenantId), actorId: req.user!.uid },
        req.params.moduleKey as ModuleKey,
        req.params.id,
      );
      res.json({ success: true });
    } catch (error) {
      if (!sendExpectedError(error, res)) next(error);
    }
  }

  static async upload(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: "Không tìm thấy tệp tải lên." });
      const data = await CustomFieldController.uploadService.upload(
        await resolveCustomFieldTenant(req.user!, req.query?.tenantId),
        req.params.moduleKey as ModuleKey,
        req.params.id,
        req.file,
        { actorId: req.user!.uid, actorName: req.user!.email, branchId: req.user!.branchId },
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      if (!sendExpectedError(error, res)) {
        const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : undefined;
        if (status) res.status(status).json({ success: false, error: messageFor(error) });
        else next(error);
      }
    }
  }
}
