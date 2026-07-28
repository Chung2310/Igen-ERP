// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getModuleSettings } from "../api/moduleSettings.api";
import { socketService } from "../../../services/socketService";
import { useEntityLabel } from "./useEntityLabel";
import { resetEntityPresetStoreForTests } from "./entityPresetStore";

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

  afterEach(cleanup);

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
