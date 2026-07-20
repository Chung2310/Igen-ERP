// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../lib/api";
import {
  archiveCustomField,
  createCustomField,
  listCustomFields,
  restoreCustomField,
  updateCustomField,
} from "./api";
import type { FieldDefinition } from "./types";
import { useCustomFields } from "./useCustomFields";

vi.mock("../lib/api", () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mountedRoots = new Set<Root>();

const field = (id: string, order: number, overrides: Partial<FieldDefinition> = {}): FieldDefinition => ({
  id,
  tenantId: "IGEN",
  moduleKey: "students",
  key: `field${id}`,
  label: `Field ${id}`,
  type: "text",
  isVisible: true,
  isRequired: false,
  isArchived: false,
  order,
  createdBy: "admin",
  updatedBy: "admin",
  createdAt: "2026-07-18T00:00:00.000Z",
  updatedAt: "2026-07-18T00:00:00.000Z",
  ...overrides,
});

const response = <T,>(data: T) => ({ success: true, data });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
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

function renderHook<Result, Props>(hook: (props: Props) => Result, initialProps: Props) {
  const container = document.createElement("div");
  const root: Root = createRoot(container);
  mountedRoots.add(root);
  let current!: Result;

  function Harness({ props }: { props: Props }) {
    current = hook(props);
    return null;
  }

  const render = async (props: Props) => {
    await act(async () => { root.render(<Harness props={props} />); });
  };

  return {
    get result() { return { current }; },
    rerender: render,
    unmount: async () => {
      await act(async () => { root.unmount(); });
      mountedRoots.delete(root);
    },
    ready: () => render(initialProps),
  };
}

beforeEach(() => {
  mockedApiFetch.mockReset();
});

afterEach(async () => {
  await act(async () => {
    mountedRoots.forEach((root) => root.unmount());
  });
  mountedRoots.clear();
});

describe("custom field API", () => {
  it("uses the student-management base path and sends exact mutation requests", async () => {
    mockedApiFetch
      .mockResolvedValueOnce(response([field("1", 1)]))
      .mockResolvedValueOnce(response(field("2", 2)))
      .mockResolvedValueOnce(response(field("2", 3, { label: "Renamed" })))
      .mockResolvedValueOnce(response(field("2", 3, { isArchived: true, isVisible: false })))
      .mockResolvedValueOnce(response(field("2", 3)));

    await expect(listCustomFields("students")).resolves.toEqual([field("1", 1)]);
    await createCustomField("students", { label: "New field", type: "text" });
    await updateCustomField("students", "2", { label: "Renamed", order: 3 });
    await archiveCustomField("students", "2");
    await restoreCustomField("students", "2");

    expect(mockedApiFetch).toHaveBeenNthCalledWith(1, "/student-management/custom-fields/students");
    expect(mockedApiFetch).toHaveBeenNthCalledWith(2, "/student-management/custom-fields/students", {
      method: "POST",
      body: JSON.stringify({ label: "New field", type: "text" }),
    });
    expect(mockedApiFetch).toHaveBeenNthCalledWith(3, "/student-management/custom-fields/students/2", {
      method: "PATCH",
      body: JSON.stringify({ label: "Renamed", order: 3 }),
    });
    expect(mockedApiFetch).toHaveBeenNthCalledWith(4, "/student-management/custom-fields/students/2/archive", { method: "POST" });
    expect(mockedApiFetch).toHaveBeenNthCalledWith(5, "/student-management/custom-fields/students/2/restore", { method: "POST" });
  });

  it("requests archived definitions only when explicitly asked", async () => {
    mockedApiFetch.mockResolvedValue(response([]));
    await listCustomFields("courses", true);
    expect(mockedApiFetch).toHaveBeenCalledWith("/student-management/custom-fields/courses", {
      params: { includeArchived: true },
    });
  });

  it("rejects invalid file-size limits before making a request", async () => {
    await expect(createCustomField("students", {
      label: "Upload",
      type: "file",
      validation: { maxSizeMb: 0.5 } as never,
    })).rejects.toThrow(/1.*100/);
    await expect(updateCustomField("students", "2", {
      validation: { maxSizeMb: 101 } as never,
    })).rejects.toThrow(/1.*100/);
    expect(mockedApiFetch).not.toHaveBeenCalled();
  });

  it("accepts boundary file-size limits", async () => {
    mockedApiFetch.mockResolvedValue(response(field("1", 1)));
    await createCustomField("students", {
      label: "Upload",
      type: "file",
      validation: { maxSizeMb: 1 } as never,
    });
    await updateCustomField("students", "1", {
      validation: { maxSizeMb: 100 } as never,
    });
    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
  });
});

describe("useCustomFields", () => {
  it("requests archived definitions and splits active/archived fields in order on mount", async () => {
    mockedApiFetch.mockResolvedValue(response([field("late", 20), field("archived", 5, { isArchived: true }), field("early", 1)]));

    const hook = renderHook(() => useCustomFields("students"), undefined);
    await hook.ready();

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.fields.map((item) => item.id)).toEqual(["early", "late"]);
    expect(hook.result.current.archivedFields.map((item) => item.id)).toEqual(["archived"]);
    expect(mockedApiFetch).toHaveBeenCalledWith("/student-management/custom-fields/students", { params: { includeArchived: true } });
  });

  it("ignores an old module response after the module changes", async () => {
    const students = deferred<ReturnType<typeof response<FieldDefinition[]>>>();
    const courses = deferred<ReturnType<typeof response<FieldDefinition[]>>>();
    mockedApiFetch.mockReturnValueOnce(students.promise).mockReturnValueOnce(courses.promise);

    const hook = renderHook(({ moduleKey }: { moduleKey: "students" | "courses" }) => useCustomFields(moduleKey), { moduleKey: "students" });
    await hook.ready();
    await hook.rerender({ moduleKey: "courses" });
    courses.resolve(response([field("course", 1, { moduleKey: "courses" })]));
    await waitFor(() => expect(hook.result.current.fields.map((item) => item.id)).toEqual(["course"]));
    students.resolve(response([field("student", 1)]));
    await act(async () => { await Promise.resolve(); });

    expect(hook.result.current.fields.map((item) => item.id)).toEqual(["course"]);
  });

  it("updates local state, sorts it, and emits a change after mutations", async () => {
    const initial = field("existing", 2);
    const created = field("created", 1);
    const updated = field("existing", 3, { label: "Updated" });
    const archived = field("created", 1, { isArchived: true, isVisible: false });
    const restored = field("created", 0);
    mockedApiFetch
      .mockResolvedValueOnce(response([initial]))
      .mockResolvedValueOnce(response(created))
      .mockResolvedValueOnce(response(updated))
      .mockResolvedValueOnce(response(archived))
      .mockResolvedValueOnce(response(restored));
    const changeListener = vi.fn();
    window.addEventListener("custom-fields:changed", changeListener);

    const hook = renderHook(() => useCustomFields("students"), undefined);
    await hook.ready();
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => { await hook.result.current.createField({ label: "Created", type: "text" }); });
    expect(hook.result.current.fields.map((item) => item.id)).toEqual(["created", "existing"]);
    await act(async () => { await hook.result.current.updateField("existing", { label: "Updated", order: 3 }); });
    expect(hook.result.current.fields.map((item) => item.label)).toEqual(["Field created", "Updated"]);
    await act(async () => { await hook.result.current.archiveField("created"); });
    expect(hook.result.current.fields.map((item) => item.id)).toEqual(["existing"]);
    expect(hook.result.current.archivedFields.map((item) => item.id)).toEqual(["created"]);
    await act(async () => { await hook.result.current.restoreField("created"); });
    expect(hook.result.current.fields.map((item) => item.id)).toEqual(["created", "existing"]);
    expect(hook.result.current.archivedFields).toEqual([]);
    expect(changeListener).toHaveBeenCalledTimes(4);
    expect((changeListener.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ moduleKey: "students", sourceId: expect.any(String) });

    await hook.unmount();
    window.removeEventListener("custom-fields:changed", changeListener);
  });

  it("refreshes peer hook instances without a duplicate self-fetch", async () => {
    const created = field("created", 1);
    mockedApiFetch
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response(created))
      .mockResolvedValueOnce(response([created]));
    const first = renderHook(() => useCustomFields("students"), undefined);
    const second = renderHook(() => useCustomFields("students"), undefined);
    await first.ready();
    await second.ready();
    await waitFor(() => expect(first.result.current.loading || second.result.current.loading).toBe(false));

    await act(async () => { await first.result.current.createField({ label: "Created", type: "text" }); });
    await act(async () => { await Promise.resolve(); });
    expect(second.result.current.fields.map((item) => item.id)).toEqual(["created"]);
    expect(mockedApiFetch).toHaveBeenCalledTimes(4);
  });

  it("ignores an event re-dispatched with its own stable source id", async () => {
    mockedApiFetch
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response(field("created", 1)));
    const events: CustomEvent[] = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    window.addEventListener("custom-fields:changed", listener);
    const hook = renderHook(() => useCustomFields("students"), undefined);
    await hook.ready();
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => { await hook.result.current.createField({ label: "Created", type: "text" }); });

    window.dispatchEvent(new CustomEvent("custom-fields:changed", { detail: events[0].detail }));
    await act(async () => { await Promise.resolve(); });
    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
    window.removeEventListener("custom-fields:changed", listener);
  });

  it("does not apply or broadcast a delayed mutation after switching modules", async () => {
    const create = deferred<ReturnType<typeof response<FieldDefinition>>>();
    mockedApiFetch
      .mockResolvedValueOnce(response([]))
      .mockReturnValueOnce(create.promise)
      .mockResolvedValueOnce(response([field("course", 1, { moduleKey: "courses" })]));
    const events = vi.fn();
    window.addEventListener("custom-fields:changed", events);
    const hook = renderHook(({ moduleKey }: { moduleKey: "students" | "courses" }) => useCustomFields(moduleKey), { moduleKey: "students" });
    await hook.ready();
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    const pending = hook.result.current.createField({ label: "Late", type: "text" });
    await hook.rerender({ moduleKey: "courses" });
    await waitFor(() => expect(hook.result.current.fields.map((item) => item.id)).toEqual(["course"]));
    create.resolve(response(field("late", 2)));
    await expect(pending).resolves.toMatchObject({ id: "late" });
    expect(hook.result.current.fields.map((item) => item.id)).toEqual(["course"]);
    expect(hook.result.current.error).toBeNull();
    expect(events).not.toHaveBeenCalled();
    window.removeEventListener("custom-fields:changed", events);
  });

  it("prevents a refresh started before a mutation from overwriting mutation state", async () => {
    const refresh = deferred<ReturnType<typeof response<FieldDefinition[]>>>();
    mockedApiFetch
      .mockResolvedValueOnce(response([field("initial", 1)]))
      .mockReturnValueOnce(refresh.promise)
      .mockResolvedValueOnce(response(field("created", 2)));
    const hook = renderHook(() => useCustomFields("students"), undefined);
    await hook.ready();
    await waitFor(() => expect(hook.result.current.fields.map((item) => item.id)).toEqual(["initial"]));
    let pendingRefresh!: Promise<void>;
    await act(async () => {
      pendingRefresh = hook.result.current.refresh();
      await Promise.resolve();
    });
    await act(async () => { await hook.result.current.createField({ label: "Created", type: "text" }); });
    refresh.resolve(response([field("stale", 1)]));
    await act(async () => { await pendingRefresh; });
    expect(hook.result.current.fields.map((item) => item.id)).toEqual(["initial", "created"]);
    expect(hook.result.current.loading).toBe(false);
  });

  it("keeps loading true until every overlapping current-module refresh settles", async () => {
    const first = deferred<ReturnType<typeof response<FieldDefinition[]>>>();
    const second = deferred<ReturnType<typeof response<FieldDefinition[]>>>();
    mockedApiFetch
      .mockResolvedValueOnce(response([]))
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const hook = renderHook(() => useCustomFields("students"), undefined);
    await hook.ready();
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    let firstRefresh!: Promise<void>;
    let secondRefresh!: Promise<void>;
    await act(async () => {
      firstRefresh = hook.result.current.refresh();
      secondRefresh = hook.result.current.refresh();
      await Promise.resolve();
    });
    expect(hook.result.current.loading).toBe(true);
    first.resolve(response([field("first", 1)]));
    await act(async () => { await firstRefresh; });
    expect(hook.result.current.loading).toBe(true);
    second.resolve(response([field("second", 2)]));
    await act(async () => { await secondRefresh; });
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.fields.map((item) => item.id)).toEqual(["second"]);
  });

  it("prevents a refresh started while a mutation is pending from overwriting its success", async () => {
    const mutation = deferred<ReturnType<typeof response<FieldDefinition>>>();
    const refresh = deferred<ReturnType<typeof response<FieldDefinition[]>>>();
    mockedApiFetch
      .mockResolvedValueOnce(response([field("initial", 1)]))
      .mockReturnValueOnce(mutation.promise)
      .mockReturnValueOnce(refresh.promise);
    const hook = renderHook(() => useCustomFields("students"), undefined);
    await hook.ready();
    await waitFor(() => expect(hook.result.current.fields.map((item) => item.id)).toEqual(["initial"]));

    let pendingMutation!: Promise<FieldDefinition>;
    await act(async () => {
      pendingMutation = hook.result.current.createField({ label: "Created", type: "text" });
      await Promise.resolve();
    });
    const pendingRefresh = hook.result.current.refresh();
    mutation.resolve(response(field("created", 2)));
    await act(async () => { await pendingMutation; });
    refresh.resolve(response([field("stale", 1)]));
    await act(async () => { await pendingRefresh; });

    expect(hook.result.current.fields.map((item) => item.id)).toEqual(["initial", "created"]);
  });

  it("applies a refresh started after a mutation succeeds", async () => {
    mockedApiFetch
      .mockResolvedValueOnce(response([field("initial", 1)]))
      .mockResolvedValueOnce(response(field("created", 2)))
      .mockResolvedValueOnce(response([field("server", 1)]));
    const hook = renderHook(() => useCustomFields("students"), undefined);
    await hook.ready();
    await waitFor(() => expect(hook.result.current.fields.map((item) => item.id)).toEqual(["initial"]));
    await act(async () => { await hook.result.current.createField({ label: "Created", type: "text" }); });
    await act(async () => { await hook.result.current.refresh(); });

    expect(hook.result.current.fields.map((item) => item.id)).toEqual(["server"]);
  });

  it("does not refresh a peer that has switched modules, but accepts its new-module events", async () => {
    const created = field("created", 1);
    const course = field("course", 1, { moduleKey: "courses" });
    mockedApiFetch
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response(created))
      .mockResolvedValueOnce(response([course]));
    const first = renderHook(() => useCustomFields("students"), undefined);
    const second = renderHook(({ moduleKey }: { moduleKey: "students" | "courses" }) => useCustomFields(moduleKey), { moduleKey: "students" });
    await first.ready();
    await second.ready();
    await second.rerender({ moduleKey: "courses" });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    await act(async () => { await first.result.current.createField({ label: "Created", type: "text" }); });
    expect(mockedApiFetch).toHaveBeenCalledTimes(4);
    window.dispatchEvent(new CustomEvent("custom-fields:changed", { detail: { moduleKey: "courses", sourceId: "other" } }));
    await waitFor(() => expect(second.result.current.fields.map((item) => item.id)).toEqual(["course"]));
  });

  it("does not update an unmounted hook from a delayed mutation", async () => {
    const create = deferred<ReturnType<typeof response<FieldDefinition>>>();
    mockedApiFetch.mockResolvedValueOnce(response([])).mockReturnValueOnce(create.promise);
    const events = vi.fn();
    window.addEventListener("custom-fields:changed", events);
    const hook = renderHook(() => useCustomFields("students"), undefined);
    await hook.ready();
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    const pending = hook.result.current.createField({ label: "Late", type: "text" });
    await hook.unmount();
    create.resolve(response(field("late", 1)));
    await expect(pending).resolves.toMatchObject({ id: "late" });
    expect(events).not.toHaveBeenCalled();
    window.removeEventListener("custom-fields:changed", events);
  });

  it("surfaces readable errors while preserving rejected mutation promises", async () => {
    mockedApiFetch.mockRejectedValueOnce(new Error("Could not load fields"));
    const hook = renderHook(() => useCustomFields("students"), undefined);
    await hook.ready();
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.error).toBe("Could not load fields");

    mockedApiFetch.mockRejectedValueOnce(new Error("Duplicate field"));
    let mutationError: unknown;
    await act(async () => {
      try {
        await hook.result.current.createField({ label: "Duplicate", type: "text" });
      } catch (caught) {
        mutationError = caught;
      }
    });
    expect(mutationError).toBeInstanceOf(Error);
    expect((mutationError as Error).message).toBe("Duplicate field");
    expect(hook.result.current.error).toBe("Duplicate field");
  });
});
