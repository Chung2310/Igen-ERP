// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OverviewChartViewport } from "./OverviewChartViewport";

vi.mock("motion/react", () => ({ useReducedMotion: () => false }));

let onIntersection: IntersectionObserverCallback;

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { onIntersection = callback; }
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() { return []; }
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("mounts a chart only when it enters view and keeps it mounted after scrolling away", () => {
  render(<OverviewChartViewport><span>Biểu đồ đã tải</span></OverviewChartViewport>);
  expect(screen.queryByText("Biểu đồ đã tải")).toBeNull();

  act(() => onIntersection([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(screen.getByText("Biểu đồ đã tải")).toBeTruthy();

  act(() => onIntersection([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(screen.getByText("Biểu đồ đã tải")).toBeTruthy();
});
