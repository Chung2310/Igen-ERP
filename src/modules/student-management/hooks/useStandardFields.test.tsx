// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../lib/api";
import { useStandardFields, type StandardFieldOverride } from "./useStandardFields";

vi.mock("../lib/api", () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);
const mountedRoots = new Set<Root>();
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

function field(label: string): StandardFieldOverride {
  return {
    key: "phone",
    label,
    isRequired: true,
    isVisible: true,
    isArchived: false,
  };
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempts = 0; attempts < 50; attempts += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    }
  }
  throw lastError;
}

function renderStandardFields(tenantId: string, preset?: "worker") {
  const container = document.createElement("div");
  const root = createRoot(container);
  mountedRoots.add(root);
  let current!: ReturnType<typeof useStandardFields>;

  function Harness({ tenant }: { tenant: string }) {
    current = useStandardFields("students", preset, tenant);
    return null;
  }

  const render = async (tenant: string) => {
    await act(async () => { root.render(<Harness tenant={tenant} />); });
  };

  return {
    get current() { return current; },
    ready: () => render(tenantId),
    rerender: render,
  };
}

beforeEach(() => {
  localStorage.clear();
  mockedApiFetch.mockReset();
});

afterEach(async () => {
  await act(async () => { mountedRoots.forEach((root) => root.unmount()); });
  mountedRoots.clear();
});

describe("useStandardFields tenant transitions", () => {
  it("uses the worker email label by default", async () => {
    mockedApiFetch.mockResolvedValue({ data: [] });
    const hook = renderStandardFields("COMPANY-A", "worker");

    await hook.ready();

    expect(hook.current.fields.find((item) => item.key === "email")?.label).toBe("Email lao động");
  });

  it("hides the previous tenant's overrides while the next tenant loads", async () => {
    const companyB = deferred<{ data: StandardFieldOverride[] }>();
    mockedApiFetch.mockImplementation((_path, options: any) =>
      options.params.tenantId === "COMPANY-A"
        ? Promise.resolve({ data: [field("Company A phone")] })
        : companyB.promise,
    );
    const hook = renderStandardFields("COMPANY-A");
    await hook.ready();
    await waitFor(() => expect(hook.current.fields.find((item) => item.key === "phone")?.label).toBe("Company A phone"));

    await hook.rerender("COMPANY-B");
    expect(hook.current.fields.find((item) => item.key === "phone")?.label).toBe("Số điện thoại");

    await act(async () => { companyB.resolve({ data: [field("Company B phone")] }); });
    await waitFor(() => expect(hook.current.fields.find((item) => item.key === "phone")?.label).toBe("Company B phone"));
  });
});
