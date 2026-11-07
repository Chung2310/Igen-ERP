import { describe, expect, it } from "vitest";
import { messageDateLabel, messageLocalDateKey, messageTimeLabel } from "./chatMessageTime";

describe("chat message times", () => {
  const today = new Date(2026, 10, 6, 13, 50);
  const sameDay = new Date(2026, 10, 6, 9, 5).toISOString();
  const yesterday = new Date(2026, 10, 5, 23, 40).toISOString();
  const older = new Date(2026, 9, 31, 8, 30).toISOString();

  it("groups messages by the local calendar day", () => {
    expect(messageLocalDateKey(sameDay)).toBe(messageLocalDateKey(today.toISOString()));
    expect(messageLocalDateKey(yesterday)).not.toBe(messageLocalDateKey(sameDay));
  });

  it("labels today, yesterday and older dates in Vietnamese", () => {
    expect(messageDateLabel(sameDay, today)).toBe("Hôm nay");
    expect(messageDateLabel(yesterday, today)).toBe("Hôm qua");
    expect(messageDateLabel(older, today)).toBe("31-10-2026");
  });

  it("shows the sent time without inventing a time for old messages", () => {
    expect(messageTimeLabel(sameDay)).toBe("09:05");
    expect(messageTimeLabel()).toBe("");
    expect(messageDateLabel("invalid", today)).toBe("");
  });
});
