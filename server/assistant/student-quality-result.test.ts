import { describe, expect, it } from "vitest";
import { operationById } from "./catalog";
import { formatAssistantResult } from "./result-format";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";

describe("student quality assistant results", () => {
  it("shows roadmap progression rates and eligibility in the shared result table", () => {
    const operation = operationById("student.learning-roadmap.progression.list")!;
    const reply = formatAssistantResult(operation, { data: [{
      id: "507f1f77bcf86cd799439021", studentName: "Nguyễn An", studentPhone: "0900000000",
      sourceStepName: "A1", targetStepName: "A2", attendanceRate: 85, assignmentRate: 75,
      miniTestRate: 80, examRate: 90, teacherAssessment: "Đạt", eligible: true,
      eligibilityReasonSummary: "Đáp ứng chuyên cần và điểm số", intent: "pending",
      teacherNote: "", overrideEligible: null, overrideReason: "",
    }] });
    const row = parseAssistantResultTable(reply)?.rows[0]?.values;

    expect(row).toMatchObject({
      "Học viên": "Nguyễn An", "Chặng hiện tại": "A1", "Chặng tiếp theo": "A2",
      "Chuyên cần": "85%", "Bài tập": "75%", "Mini test": "80%", "Điểm thi": "90%",
      "Đủ điều kiện lên lớp": "Đủ điều kiện", "Lý do xét điều kiện": "Đáp ứng chuyên cần và điểm số",
      "Quyết định hiện tại": "Chờ quyết định",
    });
    expect(reply).not.toContain("507f1f77bcf86cd799439021");
    expect(reply).not.toContain("Thông tin:");
  });

  it("shows metrics and translates unrated status into Vietnamese", () => {
    const operation = operationById("student.quality.list")!;
    const response = { items: [
      {
        studentName: "La V\u0103n S\u1EBFn", studentPhone: "0987217127", batchCode: "LOPKIEMTIEN001", courseTitle: "Kh\u00F3a ki\u1EBFm ti\u1EC1n",
        attendanceAttended: 0, attendanceTotal: 0, attendanceRate: null,
        assignmentCompleted: 0, assignmentTotal: 0, assignmentRate: null,
        latestMiniTestTitle: "", latestMiniTestScore: null, latestMiniTestMaxScore: null,
        latestExamName: "", latestExamResult: "", warningLevel: "unrated",
      },
      {
        studentName: "Nguy\u1EC5n An", studentPhone: "0900000000", batchCode: "LOP-A1", courseTitle: "Ti\u1EBFng Anh A1",
        attendanceAttended: 8, attendanceTotal: 10, attendanceRate: 80,
        assignmentCompleted: 3, assignmentTotal: 4, assignmentRate: 75,
        latestMiniTestTitle: "B\u00E0i nghe", latestMiniTestScore: 8.5, latestMiniTestMaxScore: 10,
        latestExamName: "Cu\u1ED1i k\u1EF3", latestExamResult: 8.25, warningLevel: "good",
      },
    ] };

    const reply = formatAssistantResult(operation, response);
    const rows = parseAssistantResultTable(reply)?.rows.map(item => item.values);

    expect(rows?.[0]).toMatchObject({
      "H\u1ECDc vi\u00EAn": "La V\u0103n S\u1EBFn",
      "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i": "0987217127",
      "M\u00E3 l\u1EDBp": "LOPKIEMTIEN001",
      "Chuy\u00EAn c\u1EA7n": "Ch\u01B0a c\u00F3 d\u1EEF li\u1EC7u",
      "B\u00E0i t\u1EADp": "Ch\u01B0a c\u00F3 d\u1EEF li\u1EC7u",
      "M\u1EE9c \u0111\u00E1nh gi\u00E1": "Ch\u01B0a \u0111\u00E1nh gi\u00E1",
    });
    expect(rows?.[1]).toMatchObject({
      "Chuy\u00EAn c\u1EA7n": "8/10 (80%)",
      "B\u00E0i t\u1EADp": "3/4 (75%)",
      "Ki\u1EC3m tra g\u1EA7n nh\u1EA5t": "B\u00E0i nghe: 8,5/10",
      "K\u1EF3 thi g\u1EA7n nh\u1EA5t": "Cu\u1ED1i k\u1EF3: 8,25",
      "M\u1EE9c \u0111\u00E1nh gi\u00E1": "\u1ED4n \u0111\u1ECBnh",
    });
    expect(reply).not.toContain("unrated");
    expect(reply).not.toContain("Th\u00F4ng tin:");
  });
});
