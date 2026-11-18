import { Schema, model } from "mongoose";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../middleware/auth";
import { actorScope } from "./workflows";
import { AssistantError } from "./policy";
import { AssistantSessionModel, AssistantTurnModel } from "./models";
import { processTurn, type TurnInput } from "./service";
import { openAssistantJob, sealAssistantJob } from "./job-crypto";
import { executionFingerprint } from "./execution-budget";

const schema = new Schema({
  userId: { type: String, required: true }, companyCode: { type: String, required: true }, branchId: { type: String, default: "" },
  requestId: { type: String, required: true }, conversationId: { type: String, required: true }, digest: { type: String, required: true },
  envelope: { type: String, select: false }, status: { type: String, default: "queued" }, active: { type: Boolean, default: true },
  cancelRequested: { type: Boolean, default: false }, leaseUntil: Date, result: Schema.Types.Mixed,
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({companyCode:1,userId:1,branchId:1,requestId:1}, {unique:true});
schema.index({companyCode:1,userId:1,branchId:1,conversationId:1}, {unique:true,partialFilterExpression:{active:true}});
schema.index({status:1,createdAt:1});
schema.index({expiresAt:1},{expireAfterSeconds:0});
export const AssistantJobModel = model("AssistantJob", schema);
const scope = (req: AuthenticatedRequest) => ({...actorScope(req), branchId:req.user?.branchId || ""});
let ready: Promise<unknown> | undefined;
const indexes = () => ready ||= AssistantJobModel.init().then(() => AssistantJobModel.createIndexes()).catch(error => {ready=undefined;throw error;});

export async function submitAssistantJob(req: AuthenticatedRequest, input: TurnInput) {
  if (process.env.ASSISTANT_BACKGROUND_ENABLED !== "true") throw new AssistantError("Xử lý nền chưa được bật trên máy chủ.",503);
  if (!input.text || input.mode === "qa" || input.attachment || input.conversationUpload || input.decision || input.referenceSelections) throw new AssistantError("Tác vụ nền nhận yêu cầu văn bản trong tab Thao tác.");
  await indexes();
  const owner = scope(req);
  const digest = executionFingerprint("job", input);
  try {
    await AssistantJobModel.create({...owner, requestId:input.requestId, conversationId:input.conversationId, digest,
      expiresAt:new Date(Date.now()+24*60*60_000), envelope:sealAssistantJob({input, authorization:req.headers.authorization,
        deviceId:req.headers["x-device-id"], port:req.socket.localPort, localAddress:req.socket.localAddress, queuedAt:Date.now()})});
  } catch (error) {
    if ((error as {code?:number}).code !== 11000) throw error;
    const existing = await AssistantJobModel.findOne({...owner,requestId:input.requestId}).lean();
    if (!existing || existing.digest !== digest) throw new AssistantError("Cuộc trò chuyện đang có tác vụ khác hoặc mã yêu cầu đã được dùng.",409);
  }
  const job = await AssistantJobModel.findOne({...owner,requestId:input.requestId}).lean();
  return job?.result || {status:"processing",reply:"Mình đã nhận yêu cầu và đang xử lý trong nền."};
}

export async function assistantJobStatus(req: AuthenticatedRequest, requestId: string) {
  const owner=scope(req);
  const job=await AssistantJobModel.findOne({...owner,requestId}).lean();
  if (!job) throw new AssistantError("Không tìm thấy tác vụ.",404);
  const turn=await AssistantTurnModel.findOne({...owner,requestId}).select("steps").lean() as {steps?:Array<{status:string}>}|null;
  return {requestId,conversationId:job.conversationId,status:job.status,cancelRequested:job.cancelRequested,
    completedSteps:turn?.steps?.filter(step=>step.status==="completed").length || 0, result:job.result || null};
}
export async function assertNoActiveAssistantJob(req: AuthenticatedRequest, conversationId: string) {
  if (await AssistantJobModel.findOne({...scope(req),conversationId,active:true}).lean()) throw new AssistantError("Cuộc trò chuyện đang xử lý tác vụ nền. Bạn chờ hoàn tất hoặc dừng tác vụ trước nhé.",409);
}
export async function cancelConversationAssistantJob(req: AuthenticatedRequest, conversationId: string) {
  const job=await AssistantJobModel.findOne({...scope(req),conversationId,active:true}).lean();
  if (!job) return null;
  await cancelAssistantJob(req,job.requestId);
  return {status:"completed",reply:"Đã gửi yêu cầu dừng tác vụ. Thao tác đang gọi có thể hoàn tất; trợ lý sẽ dừng trước thao tác tiếp theo."};
}
export async function cancelAssistantJob(req: AuthenticatedRequest, requestId: string) {
  const filter={...scope(req),requestId};
  await AssistantJobModel.updateOne({...filter,status:"queued"},{$set:{status:"cancelled",active:false,cancelRequested:true,result:{status:"cancelled",reply:"Đã hủy tác vụ chưa chạy."}},$unset:{envelope:1}});
  await AssistantJobModel.updateOne({...filter,status:"running"},{$set:{cancelRequested:true}});
  return assistantJobStatus(req,requestId);
}

async function authenticate(req: AuthenticatedRequest) {
  const invoke = (middleware: any) => new Promise<void>((resolve,reject) => {
    const res:any={status:()=>res,json:()=>reject(new AssistantError("Phiên đăng nhập hoặc quyền truy cập không còn hợp lệ.",403))};
    Promise.resolve(middleware(req,res,(error?:unknown)=>error?reject(error):resolve())).catch(reject);
  });
  await invoke(requireAuth);
  await invoke(requirePermission("chat:read"));
}

/** One atomic claim; expired running jobs stop as uncertain and are never replayed. */
export async function runNextAssistantJob(): Promise<boolean> {
  await indexes();
  const expired = await AssistantJobModel.find({status:"running",leaseUntil:{$lt:new Date()}}).lean();
  for (const stale of expired) {
    const owner={userId:stale.userId,companyCode:stale.companyCode,branchId:stale.branchId};
    const turn=await AssistantTurnModel.findOne({...owner,requestId:stale.requestId}).lean();
    const result=turn?.result || {status:"uncertain",reply:"Tác vụ bị gián đoạn. Cần kiểm tra kết quả trước khi thực hiện lại."};
    const retired=await AssistantJobModel.updateOne({_id:stale._id,status:"running",leaseUntil:{$lt:new Date()}},{$set:{status:result.status,active:false,result},$unset:{envelope:1}});
    if (retired.matchedCount) await AssistantSessionModel.updateOne({...owner,conversationId:stale.conversationId,activeRequestId:stale.requestId,busy:true},{$set:{busy:false,activeRequestId:"",...(turn?.result?{}:{pending:null,remainingRequests:[]})}});
  }
  const job=await AssistantJobModel.findOneAndUpdate({status:"queued",cancelRequested:false},{$set:{status:"running",leaseUntil:new Date(Date.now()+10*60_000)}},{sort:{createdAt:1},returnDocument:"after"}).select("+envelope");
  if (!job) return false;
  const heartbeat=setInterval(()=>{void AssistantJobModel.updateOne({_id:job._id,status:"running"},{$set:{leaseUntil:new Date(Date.now()+10*60_000)}}).catch(()=>undefined);},30_000);
  heartbeat.unref();
  try {
    const data=openAssistantJob(job.envelope || "");
    if (executionFingerprint("job",data.input)!==job.digest) throw new AssistantError("Nội dung tác vụ không hợp lệ.");
    if (Date.now()-data.queuedAt>10*60_000) throw new AssistantError("Tác vụ đã chờ quá lâu. Bạn gửi lại yêu cầu để kiểm tra phiên đăng nhập.");
    const req={headers:{authorization:data.authorization,"x-branch-id":job.branchId,"x-device-id":data.deviceId},
      socket:{localPort:data.port,localAddress:data.localAddress},query:{},params:{},body:{},method:"POST",originalUrl:"/api/v1/assistant/turns"} as unknown as AuthenticatedRequest;
    await authenticate(req);
    const owner=scope(req);
    if (owner.userId!==job.userId || owner.companyCode!==job.companyCode || owner.branchId!==job.branchId) throw new AssistantError("Phạm vi truy cập đã thay đổi.",403);
    let result=await processTurn(req,data.input,{background:true,cancelled:async()=>{
      const current=await AssistantJobModel.findById(job._id).select("cancelRequested status").lean();
      return !current || current.status!=="running" || current.cancelRequested;
    }});
    if (result.status==="processing") result={status:"uncertain",reply:"Mã yêu cầu này đang được xử lý ở một lượt khác. Cần kiểm tra kết quả trước khi thực hiện lại."};
    const cancelled=Boolean((await AssistantJobModel.findById(job._id).select("cancelRequested").lean())?.cancelRequested);
    await AssistantJobModel.updateOne({_id:job._id,status:"running"},{$set:{status:cancelled && result.status==="collecting"?"cancelled":["collecting","confirmation"].includes(result.status)?"waiting":result.status,active:false,result},$unset:{envelope:1}});
  } catch (error) {
    await AssistantJobModel.updateOne({_id:job._id,status:"running"},{$set:{status:"failed",active:false,result:{status:"failed",reply:error instanceof AssistantError?error.message:"Không thể xử lý tác vụ nền. Bạn kiểm tra tiến độ trước khi thử lại."}},$unset:{envelope:1}});
  } finally { clearInterval(heartbeat); }
  return true;
}
