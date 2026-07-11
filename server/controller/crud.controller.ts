import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { crudService } from "../service/crud.service";
import { SupportedModelName } from "../interface/crud.interface";
import { UserModel } from "../model/user.model";
import { TrainingCourseModel } from "../model/training-course.model";
import { HRCalendarEventModel } from "../model/hr-calendar-event.model";
import { HRLeaveTemplateModel } from "../model/hr-leave-template.model";
import { HRLeaveApplicationModel } from "../model/hr-leave-application.model";

export const crudController = {
  /**
   * GET /api/v1/crud/:modelName
   */
  async getList(req: AuthenticatedRequest, res: Response) {
    try {
      const modelName = req.params.modelName as SupportedModelName;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const userRole = req.user?.role || "user";

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 1000;
      const sort = req.query.sort as string;
      const search = req.query.search as string;

      // Trích xuất các tham số còn lại làm bộ lọc động (filters)
      const { page: _p, limit: _l, sort: _s, search: _sh, filters: queryFilters, ...otherParams } = req.query;
      const filters: any = {
        ...(typeof queryFilters === "object" && queryFilters !== null ? queryFilters : {}),
        ...otherParams,
      };

      if (modelName === "training-enrollments") {
        let isSupervisor = ["superadmin", "admin", "manager"].includes(userRole);
        if (!isSupervisor && req.user?.id) {
          const userDoc = await UserModel.findById(req.user.id).select("level").lean();
          if (userDoc && typeof userDoc.level === "number" && userDoc.level <= 3) {
            isSupervisor = true;
          }
        }
        if (!isSupervisor) {
          filters.uid = req.user?.id;
        }
      }

      if (modelName === "hr-leave-applications") {
        const isSupervisor = ["superadmin", "admin", "manager"].includes(userRole);
        if (!isSupervisor && req.user?.id) {
          filters.employeeId = req.user.id;
        }
      }

      const result = await crudService.getList(modelName, companyCode, {
        page,
        limit,
        sort,
        search,
        filters,
      }, userRole);

      return res.status(200).json({
        status: "success",
        data: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (error: any) {
      console.error("[crudController.getList] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi tải danh sách tài nguyên",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/crud/:modelName/:id
   */
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { modelName, id } = req.params;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const userRole = req.user?.role || "user";

      const item = await crudService.getById(modelName as SupportedModelName, id, companyCode, userRole);
      return res.status(200).json({
        status: "success",
        data: item,
      });
    } catch (error: any) {
      console.error("[crudController.getById] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi tải thông tin tài nguyên",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/crud/:modelName
   */
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const modelName = req.params.modelName as SupportedModelName;
      const companyCode = req.user?.companyCode || "SYSTEM";

      console.log(`[crudController.create] modelName=${modelName} body:`, req.body);

      const LEAVE_TYPES = ["leave", "wfh", "exception"];
      if (modelName === "hr-calendar-events" && LEAVE_TYPES.includes(req.body.type)) {
        const userRole = req.user?.role || "user";
        if (userRole !== "superadmin" && userRole !== "admin" && userRole !== "manager") {
          return res.status(403).json({
            status: "error",
            message: "Chỉ quản lý và admin mới có quyền tạo đơn nghỉ phép, làm tại nhà hoặc ngoại lệ.",
          });
        }
        if (req.body.status === "approved") {
          return res.status(403).json({
            status: "error",
            message: "Bạn không được phép tự duyệt khi tạo đơn.",
          });
        }
      }

      if (modelName === "hr-leave-templates") {
        const userRole = req.user?.role || "user";
        if (userRole !== "superadmin" && userRole !== "admin" && userRole !== "manager") {
          return res.status(403).json({
            status: "error",
            message: "Chỉ quản lý và admin mới có quyền tải lên biểu mẫu mẫu.",
          });
        }
      }

      const item = await crudService.create(modelName, req.body, companyCode);
      return res.status(201).json({
        status: "success",
        data: item,
      });
    } catch (error: any) {
      console.error("[crudController.create] Error:", error);
      return res.status(error.statusCode || 500).json({
        status: "error",
        message: error.statusCode ? error.message : "Lỗi khi tạo mới tài nguyên",
        details: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/crud/:modelName/:id
   */
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { modelName, id } = req.params;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const userRole = req.user?.role || "user";

      console.log(`[crudController.update] modelName=${modelName} id=${id} body:`, req.body);

      if (modelName === "training-courses") {
        const course = await TrainingCourseModel.findById(id).lean();
        if (course && course.creatorUid !== req.user?.id && userRole !== "superadmin" && userRole !== "admin") {
          return res.status(403).json({
            status: "error",
            message: "Bạn không có quyền sửa đổi khóa học này vì không phải là người tạo.",
          });
        }
      }

      if (modelName === "hr-calendar-events") {
        const LEAVE_TYPES = ["leave", "wfh", "exception"];
        const event = await HRCalendarEventModel.findById(id).lean();
        if (event && (LEAVE_TYPES.includes(event.type) || LEAVE_TYPES.includes(req.body.type))) {
          if (userRole !== "superadmin" && userRole !== "admin" && userRole !== "manager") {
            return res.status(403).json({
              status: "error",
              message: "Chỉ quản lý và admin mới có quyền chỉnh sửa đơn nghỉ phép / làm tại nhà / ngoại lệ.",
            });
          }
          if (req.body.status === "approved" && event.creatorId === req.user?.id) {
            return res.status(403).json({
              status: "error",
              message: "Người tạo đơn không được phép tự duyệt.",
            });
          }
        }
      }

      if (modelName === "hr-leave-templates") {
        if (userRole !== "superadmin" && userRole !== "admin" && userRole !== "manager") {
          return res.status(403).json({
            status: "error",
            message: "Chỉ quản lý và admin mới có quyền chỉnh sửa biểu mẫu mẫu.",
          });
        }
      }

      if (modelName === "hr-leave-applications") {
        const app = await HRLeaveApplicationModel.findById(id).lean();
        if (app) {
          const isSupervisor = ["superadmin", "admin", "manager"].includes(userRole);
          if (!isSupervisor) {
            if (app.employeeId !== req.user?.id) {
              return res.status(403).json({
                status: "error",
                message: "Bạn không có quyền chỉnh sửa đơn của người khác.",
              });
            }
          }
          if (req.body.status && req.body.status !== app.status) {
            if (userRole !== "admin" && userRole !== "superadmin") {
              return res.status(403).json({
                status: "error",
                message: "Chỉ Admin và Superadmin mới có quyền phê duyệt/thay đổi trạng thái đơn từ.",
              });
            }
          }
        }
      }

      const item = await crudService.update(modelName as SupportedModelName, id, req.body, companyCode, userRole);

      // Tự động đồng bộ sang hr-calendar-events khi đơn xin nghỉ/trễ được duyệt
      if (modelName === "hr-leave-applications" && item && item.status === "approved") {
        const existingEvent = await HRCalendarEventModel.findOne({
          employeeId: item.employeeId,
          startDate: item.startDate,
          endDate: item.endDate,
          type: "leave",
          companyCode: item.companyCode
        });

        if (!existingEvent) {
          let title = `${item.employeeName} - ${item.type}`;
          if (item.type === "leave") title = `${item.employeeName} xin nghỉ phép`;
          if (item.type === "late") title = `${item.employeeName} xin đi trễ`;
          if (item.type === "early") title = `${item.employeeName} xin về sớm`;
          if (item.type === "other") title = `${item.employeeName} xin phép khác`;

          await HRCalendarEventModel.create({
            companyCode: item.companyCode,
            type: "leave",
            title,
            description: `Đơn đã duyệt. Lý do: ${item.reason}. Đơn đính kèm: ${item.uploadedFileName}${item.note ? `. Phản hồi: ${item.note}` : ""}`,
            startDate: item.startDate,
            endDate: item.endDate,
            employeeId: item.employeeId,
            employeeName: item.employeeName,
            status: "approved",
            creatorId: item.approvedBy || req.user?.id || "system"
          });
        }
      }

      return res.status(200).json({
        status: "success",
        data: item,
      });
    } catch (error: any) {
      console.error("[crudController.update] Error:", error);
      return res.status(error.statusCode || 500).json({
        status: "error",
        message: error.statusCode ? error.message : "Lỗi khi cập nhật tài nguyên",
        details: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/crud/:modelName/:id
   */
  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { modelName, id } = req.params;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const userRole = req.user?.role || "user";

      if (modelName === "training-courses") {
        const course = await TrainingCourseModel.findById(id).lean();
        if (course && course.creatorUid !== req.user?.id && userRole !== "superadmin" && userRole !== "admin") {
          return res.status(403).json({
            status: "error",
            message: "Bạn không có quyền xóa khóa học này vì không phải là người tạo.",
          });
        }
      }

      if (modelName === "hr-calendar-events") {
        const LEAVE_TYPES = ["leave", "wfh", "exception"];
        const event = await HRCalendarEventModel.findById(id).lean();
        if (event && LEAVE_TYPES.includes(event.type)) {
          if (userRole !== "superadmin" && userRole !== "admin" && userRole !== "manager") {
            return res.status(403).json({
              status: "error",
              message: "Chỉ quản lý và admin mới có quyền xóa đơn nghỉ phép / làm tại nhà / ngoại lệ.",
            });
          }
        }
      }

      if (modelName === "hr-leave-templates") {
        if (userRole !== "superadmin" && userRole !== "admin" && userRole !== "manager") {
          return res.status(403).json({
            status: "error",
            message: "Chỉ quản lý và admin mới có quyền xóa biểu mẫu mẫu.",
          });
        }
      }

      if (modelName === "hr-leave-applications") {
        const app = await HRLeaveApplicationModel.findById(id).lean();
        if (app) {
          const isSupervisor = ["superadmin", "admin", "manager"].includes(userRole);
          if (!isSupervisor && app.employeeId !== req.user?.id) {
            return res.status(403).json({
              status: "error",
              message: "Bạn không có quyền xóa đơn của người khác.",
            });
          }
        }
      }

      const item = await crudService.delete(modelName as SupportedModelName, id, companyCode, userRole);
      return res.status(200).json({
        status: "success",
        message: "Xóa tài nguyên thành công",
        data: item,
      });
    } catch (error: any) {
      console.error("[crudController.delete] Error:", error);
      return res.status(error.statusCode || 500).json({
        status: "error",
        message: error.statusCode ? error.message : "Lỗi khi xóa tài nguyên",
        details: error.message,
      });
    }
  },
};
