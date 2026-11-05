import { describe, expect, it } from "vitest";
import { formatChatLongDate, formatChatShortDate, formatChatTime, isSameChatDay } from "./chatDateTime";

describe("Vietnamese chat timestamps", () => {
  it("shows 24-hour Vietnam time regardless of the viewer's local clock", () => {
    expect(formatChatTime(new Date("2026-11-05T07:07:00Z"))).toBe("14:07");
    expect(formatChatTime(new Date("2026-11-05T17:07:00Z"))).toBe("00:07");
  });

  it("groups messages and labels dates at the Vietnam midnight boundary", () => {
    const beforeMidnight = new Date("2026-11-05T16:59:00Z");
    const afterMidnight = new Date("2026-11-05T17:01:00Z");

    expect(isSameChatDay(beforeMidnight, afterMidnight)).toBe(false);
    expect(formatChatShortDate(afterMidnight)).toBe("6/11");
    expect(formatChatLongDate(afterMidnight)).toContain("6 tháng 11, 2026");
  });
});
