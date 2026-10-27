// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getModuleSettings } from "../api/moduleSettings.api";
import { socketService } from "../../../services/socketService";
import { useEntityLabel } from "./useEntityLabel";
import { resetEntityPresetStoreForTests, getEntityPresetSnapshot, retryEntityPresetLoad, setEntityPreset } from "./entityPresetStore";

vi.mock("../api/moduleSettings.api", () => ({ getModuleSettings: vi.fn() }));
vi.mock("../../../services/socketService", () => ({
  socketService: { on: vi.fn(() => () => undefined) },
}));

function Probe({ name, onRender }: { name: string; onRender?: (preset: string) => void }) {
  const entity = useEntityLabel();
  onRender?.(entity.preset);
  return <output aria-label={name}>{entity.loading ? "loading" : entity.preset}</output>;
}

describe("shared entity preset state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEntityPresetStoreForTests();
  });

  afterEach(() => { cleanup(); resetEntityPresetStoreForTests(); vi.useRealTimers(); });

  it("recovers automatically without remounting after a transient settings error", async () => {
    vi.useFakeTimers();
    vi.mocked(getModuleSettings).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ tenantId: 'ACME', entityPreset: 'worker' });
    render(<Probe name="first" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(getEntityPresetSnapshot().error).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByLabelText('first').textContent).toBe('worker');
    expect(getModuleSettings).toHaveBeenCalledTimes(2);
  });

  it("caps automatic retries and permits an immediate explicit retry", async () => {
    vi.useFakeTimers();
    vi.mocked(getModuleSettings).mockRejectedValue(new Error('Offline'));
    render(<Probe name="first" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(getModuleSettings).toHaveBeenCalledTimes(3);
    expect(getEntityPresetSnapshot().error).toBeTruthy();
    vi.mocked(getModuleSettings).mockResolvedValue({ tenantId: 'ACME', entityPreset: 'student' });
    await act(async () => { await retryEntityPresetLoad(); });
    expect(screen.getByLabelText('first').textContent).toBe('student');
  });

  it("releases a hung settings request and ignores a late response after a realtime update", async () => {
    vi.useFakeTimers();
    let complete!: (value: Awaited<ReturnType<typeof getModuleSettings>>) => void;
    vi.mocked(getModuleSettings).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    render(<Probe name="first" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(getEntityPresetSnapshot().error).toBeTruthy();
    act(() => { setEntityPreset('worker'); });
    await act(async () => { complete({ tenantId: 'ACME', entityPreset: 'student' }); });
    expect(screen.getByLabelText('first').textContent).toBe('worker');
  });

  it("keeps a realtime preset update when the older request completes afterwards", async () => {
    let complete!: (value: Awaited<ReturnType<typeof getModuleSettings>>) => void;
    vi.mocked(getModuleSettings).mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    render(<Probe name="first" />);
    await waitFor(() => expect(getModuleSettings).toHaveBeenCalledTimes(1));
    act(() => { setEntityPreset('worker'); });
    await act(async () => { complete({ tenantId: 'ACME', entityPreset: 'student' }); });
    expect(screen.getByLabelText('first').textContent).toBe('worker');
  });

  it("does not request student settings when label loading is disabled", async () => {
    function DisabledProbe() {
      useEntityLabel(false);
      return null;
    }

    render(<DisabledProbe />);
    await Promise.resolve();
    expect(getModuleSettings).not.toHaveBeenCalled();
  });

  it("does not expose the student label while the real preset is still loading", () => {
    vi.mocked(getModuleSettings).mockResolvedValue({ tenantId: "ACME", entityPreset: "worker" });

    function LabelProbe() {
      const entity = useEntityLabel();
      return <output aria-label="label">{entity.tabLabel}</output>;
    }

    render(<LabelProbe />);

    expect(screen.getByLabelText("label").textContent).toBe("Học viên/Lao động");
  });
  it("shares one settings request across simultaneous consumers", async () => {
    vi.mocked(getModuleSettings).mockResolvedValue({ tenantId: "ACME", entityPreset: "worker" });

    render(
      <>
        <Probe name="first" />
        <Probe name="second" />
      </>,
    );

    await waitFor(() => expect(screen.getByLabelText("first").textContent).toBe("worker"));
    expect(screen.getByLabelText("second").textContent).toBe("worker");
    expect(getModuleSettings).toHaveBeenCalledTimes(1);
  });

  it("gives a late-mounted consumer the resolved worker preset on its first render", async () => {
    vi.mocked(getModuleSettings).mockResolvedValue({ tenantId: "ACME", entityPreset: "worker" });
    const lateRenders: string[] = [];
    const view = render(<Probe name="first" />);
    await waitFor(() => expect(screen.getByLabelText("first").textContent).toBe("worker"));

    view.rerender(
      <>
        <Probe name="first" />
        <Probe name="late" onRender={(preset) => lateRenders.push(preset)} />
      </>,
    );

    expect(screen.getByLabelText("late").textContent).toBe("worker");
    expect(lateRenders).toEqual(["worker"]);
  });

  it("retries instead of locking onto the default preset when the request fails", async () => {
    vi.mocked(getModuleSettings).mockRejectedValueOnce(new Error("401"));
    const first = render(<Probe name="first" />);
    await waitFor(() => expect(getModuleSettings).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("first").textContent).toBe("loading");

    // Lỗi tạm thời không được chốt "student": lần mount sau phải gọi lại API.
    first.unmount();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await act(async () => {
        vi.advanceTimersByTime(6000);
      });
      vi.mocked(getModuleSettings).mockResolvedValue({ tenantId: "ACME", entityPreset: "worker" });
      render(<Probe name="second" />);
      await waitFor(() => expect(screen.getByLabelText("second").textContent).toBe("worker"));
    } finally {
      vi.useRealTimers();
    }
    expect(getModuleSettings).toHaveBeenCalledTimes(2);
  });

  it("updates every consumer from a browser event", async () => {
    vi.mocked(getModuleSettings).mockResolvedValue({ tenantId: "ACME", entityPreset: "student" });
    render(
      <>
        <Probe name="first" />
        <Probe name="second" />
      </>,
    );
    await waitFor(() => expect(screen.getByLabelText("first").textContent).toBe("student"));

    act(() => {
      window.dispatchEvent(new CustomEvent("entity-label:changed", {
        detail: { entityPreset: "worker" },
      }));
    });

    expect(screen.getByLabelText("first").textContent).toBe("worker");
    expect(screen.getByLabelText("second").textContent).toBe("worker");
  });

  it("updates every consumer from the socket listener", async () => {
    vi.mocked(getModuleSettings).mockResolvedValue({ tenantId: "ACME", entityPreset: "student" });
    render(
      <>
        <Probe name="first" />
        <Probe name="second" />
      </>,
    );
    await waitFor(() => expect(screen.getByLabelText("first").textContent).toBe("student"));

    const listener = vi.mocked(socketService.on).mock.calls
      .find(([event]) => event === "entity_preset_changed")?.[1];
    act(() => listener?.({ entityPreset: "customer" }));

    expect(screen.getByLabelText("first").textContent).toBe("customer");
    expect(screen.getByLabelText("second").textContent).toBe("customer");
    expect(socketService.on).toHaveBeenCalledTimes(1);
  });
});
