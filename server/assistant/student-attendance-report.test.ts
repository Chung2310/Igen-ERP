import {expect,it} from "vitest";
import {studentAttendanceSummary} from "./student-attendance-report";
const batch = {name: "Lớp A", learnerIds: ["one", "two"],startDate:"2026-11-01",endDate:"2026-12-31",daysOfWeek:[3]};
it("does not claim attendance or absence when the session has not been recorded",()=>{
  expect(studentAttendanceSummary(batch,"2026-11-18")).toMatchObject({total:2,present:0,absent:0,unrecorded:2,note:"Chưa có dữ liệu điểm danh; chưa thể kết luận đi đủ hay vắng."});
});
it("counts only enrolled learners on the requested date, deduplicating records",()=>{
  const result=studentAttendanceSummary({...batch,attendanceSessions:[{date:"2026-11-18",records:[{studentId:"one",status:"present"},{studentId:"one",status:"late"},{studentId:"two",status:"present"},{studentId:"outside",status:"absent"}]},{date:"2026-11-17",records:[{studentId:"two",status:"absent"}]}]},"2026-11-18");
  expect(result).toMatchObject({total:2,present:1,late:1,absent:0,unrecorded:0});
  expect(JSON.stringify(result)).not.toContain("outside");
});
it("keeps schedule and remaining-seat details with attendance totals",()=>{
  const result=studentAttendanceSummary({...batch,startTime:"19:00",endTime:"21:00",location:"P204",remainingSlots:4,attendanceSessions:[{date:"2026-11-18",records:[{studentId:"one",status:"present"},{studentId:"two",status:"absent"}]}]},"2026-11-18");
  expect(result).toMatchObject({startTime:"19:00",endTime:"21:00",location:"P204",remainingSlots:4,total:2,present:1,absent:1});
});
