import { describe, expect, it } from "vitest";
import {
  assertWithinProjectRadius,
  calculateWorkedMinutes,
  resolveAttendanceStatus,
  vietnamMinutesOfDay,
  vietnamWorkDate,
  WorkerAttendanceError,
  DEFAULT_PROJECT_RADIUS_METERS,
} from "./worker-attendance.service";
import fs from "node:fs";
import path from "node:path";

/** Dựng mốc thời gian từ giờ Việt Nam (VN = UTC+7), độc lập với máy chạy test. */
const vn = (isoDate: string, hhmm: string) => {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return new Date(`${isoDate}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00.000+07:00`);
};

describe("mốc thời gian theo giờ Việt Nam", () => {
  it("quy ngày làm việc theo giờ VN chứ không theo UTC", () => {
    // 23:30 UTC ngày 03/08 là 06:30 sáng ngày 04/08 giờ VN
    expect(vietnamWorkDate(new Date("2026-08-03T23:30:00.000Z"))).toBe("2026-08-04");
  });

  it("đọc đúng số phút trong ngày theo giờ VN", () => {
    expect(vietnamMinutesOfDay(vn("2026-08-04", "07:30"))).toBe(7 * 60 + 30);
  });
});

describe("chặn chấm công ngoài phạm vi công trường", () => {
  const site = { latitude: 21.0278, longitude: 105.8342, radiusMeters: 300 };

  it("bỏ qua kiểm tra khi dự án chưa đặt vị trí", () => {
    expect(assertWithinProjectRadius(null, 21.0278, 105.8342)).toBeUndefined();
    expect(assertWithinProjectRadius({ latitude: null, longitude: null }, 1, 1)).toBeUndefined();
  });

  it("trả về khoảng cách khi đứng trong bán kính", () => {
    const distance = assertWithinProjectRadius(site, 21.0280, 105.8344);
    expect(distance).toBeLessThan(300);
  });

  it("từ chối khi ở ngoài bán kính", () => {
    // cách tâm khoảng 2km
    expect(() => assertWithinProjectRadius(site, 21.0458, 105.8342)).toThrowError(WorkerAttendanceError);
    try {
      assertWithinProjectRadius(site, 21.0458, 105.8342);
    } catch (error) {
      expect((error as WorkerAttendanceError).reasonCode).toBe("outside_radius");
    }
  });

  it("bắt buộc gửi GPS khi dự án đã đặt vị trí", () => {
    try {
      assertWithinProjectRadius(site, undefined, undefined);
      throw new Error("đáng lẽ phải ném lỗi");
    } catch (error) {
      expect((error as WorkerAttendanceError).reasonCode).toBe("missing_location");
    }
  });

  it("dùng bán kính mặc định khi dự án không đặt riêng", () => {
    const near = assertWithinProjectRadius(
      { latitude: 21.0278, longitude: 105.8342 },
      21.0298,
      105.8342
    );
    // ~222m: nằm trong mặc định 300m nên không ném lỗi
    expect(near).toBeLessThan(DEFAULT_PROJECT_RADIUS_METERS);
  });
});

describe("trạng thái ngày công theo giờ của dự án", () => {
  const date = "2026-08-04";

  it("chưa bấm giờ về thì để thiếu giờ về, không tự suy ra", () => {
    expect(resolveAttendanceStatus(vn(date, "07:55"), null, "08:00", "17:00")).toBe("missing-checkout");
  });

  it("đúng giờ vào và giờ về là đủ công", () => {
    expect(resolveAttendanceStatus(vn(date, "07:58"), vn(date, "17:05"), "08:00", "17:00")).toBe("present");
  });

  it("trong dung sai vẫn tính đủ công", () => {
    expect(resolveAttendanceStatus(vn(date, "08:04"), vn(date, "16:56"), "08:00", "17:00")).toBe("present");
  });

  it("nhận diện đi muộn, về sớm và cả hai", () => {
    expect(resolveAttendanceStatus(vn(date, "08:30"), vn(date, "17:10"), "08:00", "17:00")).toBe("late");
    expect(resolveAttendanceStatus(vn(date, "07:50"), vn(date, "15:00"), "08:00", "17:00")).toBe("left-early");
    expect(resolveAttendanceStatus(vn(date, "09:00"), vn(date, "15:00"), "08:00", "17:00")).toBe("late-left-early");
  });

  it("dùng giờ mặc định khi dự án có giờ không hợp lệ", () => {
    expect(resolveAttendanceStatus(vn(date, "07:30"), vn(date, "17:30"), "", "")).toBe("present");
    expect(resolveAttendanceStatus(vn(date, "09:30"), vn(date, "17:30"), "99:99", "abc")).toBe("late");
  });
});

describe("số phút làm việc", () => {
  const date = "2026-08-04";

  it("tình theo khoảng cách hai mốc", () => {
    expect(calculateWorkedMinutes(vn(date, "08:00"), vn(date, "17:30"))).toBe(570);
  });

  it("không bao giờ âm", () => {
    expect(calculateWorkedMinutes(vn(date, "17:00"), vn(date, "08:00"))).toBe(0);
  });
});

describe("import isolation", () => {
  it("does not import student-management models for worker attendance", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "server/modules/worker-management/services/worker-attendance.service.ts"), "utf8");
    expect(source).not.toContain("student-management");
    expect(source).not.toContain("../models/batch.model");
  });
});
