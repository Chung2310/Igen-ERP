import { Response, NextFunction } from "express";
import { PaymentService } from "../services/payment.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds } from "../utils/auth.util";
import {listTuitionBalances} from '../services/tuition-balance.service';
import {previewTuitionReminder,sendTuitionReminder} from '../services/tuition-reminder.service';

function errorStatus(error: unknown) {
  const status = Number((error as { statusCode?: unknown; status?: unknown })?.statusCode ?? (error as { status?: unknown })?.status);
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : 400;
}

export class PaymentController {
  static async previewReminder(req:AuthRequest,res:Response,next:NextFunction){try{const owners=await getAllowedOwnerIds(req.user!);res.json({success:true,data:await previewTuitionReminder({owners,companyCode:req.user!.companyCode!,userId:req.user!.uid,branchId:req.user!.branchId},typeof req.query.batchId==='string'?req.query.batchId:undefined,String(req.query.contentDigest||''))});}catch(error){next(error);}}
  static async sendReminder(req:AuthRequest,res:Response,next:NextFunction){try{const owners=await getAllowedOwnerIds(req.user!);res.json({success:true,data:await sendTuitionReminder({owners,companyCode:req.user!.companyCode!,userId:req.user!.uid,branchId:req.user!.branchId},req.body)});}catch(error){next(error);}}
  static async balances(req:AuthRequest,res:Response,next:NextFunction){
    try{const owners=await getAllowedOwnerIds(req.user!);const batchId=typeof req.query.batchId==='string'?req.query.batchId:undefined;
      res.json({success:true,data:await listTuitionBalances(owners,req.user!.branchId,batchId)});
    }catch(error){next(error);}
  }
  static async reconcileStudent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const owners = await getAllowedOwnerIds(req.user!);
      res.json({ success: true, data: await PaymentService.reconcileStudent(owners, req.params.id, req.user!.branchId) });
    } catch (error) { next(error); }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const payment = await PaymentService.createPayment(ownerId, req.body, req.user!.branchId);
      res.status(201).json({ success: true, data: payment });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(errorStatus(error)).json({ success: false, error: msg });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const payment = await PaymentService.updatePayment(ownerId, req.params.id, req.body, req.user!.branchId);
      res.json({ success: true, data: payment });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(errorStatus(error)).json({ success: false, error: msg });
    }
  }

  static async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const filters = {
        page: typeof req.query.page === "string" ? req.query.page : undefined,
        limit: typeof req.query.limit === "string" ? req.query.limit : undefined,
        studentId: typeof req.query.studentId === "string" ? req.query.studentId : undefined,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        ownerFilter: typeof req.query.ownerFilter === "string" ? req.query.ownerFilter : undefined,
        startDate: typeof req.query.startDate === "string" ? req.query.startDate : undefined,
        endDate: typeof req.query.endDate === "string" ? req.query.endDate : undefined,
      };
      const result = await PaymentService.getPayments(ownerId, filters, req.user!.branchId);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const payment = await PaymentService.deletePayment(ownerId, req.params.id, req.user!.branchId);
      if (!payment) {
        return res.status(404).json({ success: false, error: "Không tìm thấy giao dịch thanh toán để xóa." });
      }
      res.json({ success: true, data: payment });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(errorStatus(error)).json({ success: false, error: msg });
    }
  }
}
