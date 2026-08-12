import { describe, expect, it, vi } from "vitest";
import { createHidScannerBuffer } from "./retailScannerInput";
const key = (value: string, timeStamp: number) => ({ key: value, timeStamp } as KeyboardEvent);
describe("HID scanner buffer", () => {
  it("emits a scan only when Enter terminates the minimum-length buffer", () => { const onScan = vi.fn(), scanner = createHidScannerBuffer({ timeoutMs: 50, minLength: 3, onScan }); for (const [value, time] of [["A", 0], ["1", 10], ["2", 20], ["Enter", 25]] as const) scanner.keydown(key(value, time)); expect(onScan).toHaveBeenCalledWith("A12"); });
  it("resets stale input after the timeout", () => { const onScan = vi.fn(), scanner = createHidScannerBuffer({ timeoutMs: 30, minLength: 2, onScan }); scanner.keydown(key("A", 0)); scanner.keydown(key("B", 50)); scanner.keydown(key("Enter", 55)); expect(onScan).not.toHaveBeenCalled(); });
});
