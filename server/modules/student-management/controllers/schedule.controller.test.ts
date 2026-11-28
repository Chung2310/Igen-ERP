import {expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({exam:vi.fn(),bookings:vi.fn(),classes:vi.fn(),owner:vi.fn(),resolve:vi.fn()}));
vi.mock('../models/exam.model',()=>({Exam:{find:state.exam}}));
vi.mock('../services/resource.service',()=>({ResourceService:{getBookingsInRange:state.bookings}}));
vi.mock('../services/batch.service',()=>({BatchService:{getClassEventsInRange:state.classes}}));
vi.mock('../utils/auth.util',()=>({getAllowedOwnerIds:state.owner,resolveOwnerFilter:state.resolve}));
import {ScheduleController} from './schedule.controller';
it('filters class identity natively while preserving owner and branch and avoiding unrelated bookings',async()=>{
 state.owner.mockResolvedValue(['owner']);state.resolve.mockResolvedValue(['owner']);state.exam.mockResolvedValue([]);state.classes.mockResolvedValue([]);state.bookings.mockClear();
 const id='64b000000000000000000001',res={json:vi.fn()},next=vi.fn();
 await ScheduleController.getEvents({user:{branchId:'branch'},query:{batchId:id,from:'2026-11-27',to:'2026-11-27'}} as any,res as any,next);
 expect(next).not.toHaveBeenCalled();expect(state.exam).toHaveBeenCalledWith({batchId:id,ownerId:{$in:['owner']},branchId:'branch'});
 expect(state.classes).toHaveBeenCalledWith(['owner'],'2026-11-27','2026-11-27','branch',id);expect(state.bookings).not.toHaveBeenCalled();
});
it('keeps the authorized owner, branch and date range while returning structured locations for calendar events',async()=>{
 state.owner.mockResolvedValue(['owner']);state.resolve.mockResolvedValue(['owner']);
 state.exam.mockResolvedValue([{_id:'exam',name:'QA Kiểm tra',status:'Sắp diễn ra',officialDate:'2026-11-27',location:'QA P02',studentCount:2}]);
 state.bookings.mockResolvedValue([{id:'booking',title:'QA Đặt phòng',date:'2026-11-27',time:'08:00',details:'QA',location:'QA P02'}]);
 state.classes.mockResolvedValue([]);
 const req={user:{branchId:'branch'},query:{from:'2026-11-27',to:'2026-11-27'}},res={json:vi.fn()},next=vi.fn();
 await ScheduleController.getEvents(req as any,res as any,next);
 expect(next).not.toHaveBeenCalled();expect(state.exam).toHaveBeenCalledWith({ownerId:{$in:['owner']},branchId:'branch'});
 expect(state.bookings).toHaveBeenCalledWith(['owner'],'2026-11-27','2026-11-27','branch');
 expect(res.json.mock.calls[0][0].events.map((event:any)=>event.location)).toEqual(['QA P02','QA P02']);
});
