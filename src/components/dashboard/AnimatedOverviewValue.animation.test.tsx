// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimatedOverviewValue } from "./AnimatedOverviewValue";

const motionFrame = vi.hoisted(() => ({ onUpdate: null as ((value: number) => void) | null }));

vi.mock("motion/react", () => ({
  animate: (_from: number, _to: number, options: { onUpdate: (value: number) => void }) => {
    motionFrame.onUpdate = options.onUpdate;
    return { stop: () => {} };
  },
  useReducedMotion: () => false,
}));

afterEach(cleanup);

describe("AnimatedOverviewValue", () => {
  it("only shows whole numbers from zero to the real KPI value", () => {
    const { container } = render(<AnimatedOverviewValue value={9} format={value => value.toLocaleString("vi-VN")} />);
    const visibleNumber = container.querySelector('[aria-hidden="true"]');
    expect(visibleNumber?.textContent).toBe("0");

    act(() => motionFrame.onUpdate?.(1.335));
    expect(visibleNumber?.textContent).toBe("1");

    act(() => motionFrame.onUpdate?.(13.5));
    expect(visibleNumber?.textContent).toBe("9");
  });
});
