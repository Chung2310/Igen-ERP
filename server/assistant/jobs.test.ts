import { beforeEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({rows:[] as any[],execute:vi.fn(),auth:true,sessionUpdate:vi.fn(),turn:null as any}));
vi.mock("../config/env",()=>({getJwtAccessSecret:()=>"test-job-encryption-secret-only"}));
vi.mock("./service",()=>({processTurn:state.execute}));
vi.mock("./workflows",()=>({actorScope:(req:any)=>({userId:req.user.id,companyCode:req.user.companyCode})}));
vi.mock("../middleware/auth",()=>({
  requireAuth:(req:any,res:any,next:any)=>{if(!state.auth)return res.status(401).json({});req.user={id:"u",companyCode:"c",branchId:"b"};next();},
  requirePermission:()=> (_req:any,_res:any,next:any)=>next(),
}));
vi.mock("./models",()=>({AssistantSessionModel:{updateOne:state.sessionUpdate},AssistantTurnModel:{findOne:()=>({select:()=>({lean:async()=>state.turn}),lean:async()=>state.turn})}}));
vi.mock("mongoose",()=>{
  const matches=(row:any,filter:any)=>Object.entries(filter).every(([key,value]:[string,any])=>value?.$lt ? row[key]<value.$lt : row[key]===value);
  const query=(get:()=>any):any=>({lean:async()=>get(),select:()=>query(get),then:(resolve:any,reject:any)=>Promise.resolve(get()).then(resolve,reject)});
  const apply=(row:any,update:any)=>{Object.assign(row,update.$set);for(const key of Object.keys(update.$unset||{}))delete row[key];};
  return {Schema:class {static Types={Mixed:Object};index(){}},model:()=>({
    init:async()=>{},createIndexes:async()=>{},
    create:async(input:any)=>{if(state.rows.some(row=>row.requestId===input.requestId || row.active&&row.conversationId===input.conversationId))throw {code:11000};state.rows.push({_id:String(state.rows.length),status:"queued",active:true,cancelRequested:false,...input});},
    find:(filter:any)=>query(()=>state.rows.filter(row=>matches(row,filter))),
    findOne:(filter:any)=>query(()=>state.rows.find(row=>matches(row,filter))),
    findById:(id:any)=>query(()=>state.rows.find(row=>row._id===id)),
    findOneAndUpdate:(filter:any,update:any)=>query(()=>{const row=state.rows.find(row=>matches(row,filter));if(row)apply(row,update);return row;}),
    updateOne:async(filter:any,update:any)=>{const row=state.rows.find(row=>matches(row,filter));if(row)apply(row,update);return {matchedCount:row?1:0};},
  })};
});
import { submitAssistantJob, runNextAssistantJob, cancelAssistantJob, assistantJobStatus } from "./jobs";
const req={user:{id:"u",companyCode:"c",branchId:"b"},headers:{authorization:"Bearer private"},socket:{localPort:4050,localAddress:"127.0.0.1"}} as any;
const input={requestId:"r",conversationId:"v",text:"Đếm nhân viên"};
beforeEach(()=>{state.rows=[];state.turn=null;state.auth=true;state.execute.mockReset();state.sessionUpdate.mockReset();vi.stubEnv("ASSISTANT_BACKGROUND_ENABLED","true");});
it("deduplicates submissions and executes a claimed job once",async()=>{
  await submitAssistantJob(req,input);await submitAssistantJob(req,input);
  expect(state.rows).toHaveLength(1);expect(state.rows[0].envelope).not.toContain("Bearer private");
  state.execute.mockResolvedValue({status:"completed",reply:"Xong"});
  expect(await runNextAssistantJob()).toBe(true);expect(await runNextAssistantJob()).toBe(false);
  expect(state.execute).toHaveBeenCalledTimes(1);expect(state.rows[0].envelope).toBeUndefined();
  expect(await submitAssistantJob(req,input)).toEqual({status:"completed",reply:"Xong"});
});
it("checks current authentication before execution",async()=>{
  await submitAssistantJob(req,input);state.auth=false;await runNextAssistantJob();
  expect(state.execute).not.toHaveBeenCalled();expect(state.rows[0].status).toBe("failed");
});
it("cancels queued jobs and scopes status to the owner",async()=>{
  await submitAssistantJob(req,input);await cancelAssistantJob(req,"r");
  expect(await runNextAssistantJob()).toBe(false);
  expect((await assistantJobStatus(req,"r")).status).toBe("cancelled");
  await expect(assistantJobStatus({...req,user:{id:"other",companyCode:"c",branchId:"b"}},"r")).rejects.toThrow();
});
it("signals cancellation during execution without replaying the call",async()=>{
  await submitAssistantJob(req,input);
  state.execute.mockImplementation(async(_req,_input,control)=>{
    await cancelAssistantJob(req,"r");expect(await control.cancelled()).toBe(true);
    return {status:"collecting",reply:"Đã dừng"};
  });
  await runNextAssistantJob();expect(state.rows[0].status).toBe("cancelled");expect(state.execute).toHaveBeenCalledTimes(1);
});
it("marks abandoned execution uncertain and unlocks only its own session",async()=>{
  await submitAssistantJob(req,input);Object.assign(state.rows[0],{status:"running",leaseUntil:new Date(0)});
  await runNextAssistantJob();expect(state.rows[0].status).toBe("uncertain");expect(state.execute).not.toHaveBeenCalled();
  expect(state.sessionUpdate.mock.calls[0][0]).toMatchObject({activeRequestId:"r",userId:"u",companyCode:"c",branchId:"b"});
});
