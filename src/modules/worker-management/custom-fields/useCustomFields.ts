import { useCallback, useEffect, useRef, useState } from "react";
import {
  archiveCustomField,
  createCustomField,
  deleteCustomField,
  listCustomFields,
  restoreCustomField,
  updateCustomField,
} from "./api";
import type {
  CreateFieldInput,
  FieldDefinition,
  ModuleKey,
  UpdateFieldInput,
} from "./types";

let sourceSequence = 0;

export type UseCustomFieldsResult = {
  fields: FieldDefinition[];
  archivedFields: FieldDefinition[];
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
  createField(input: CreateFieldInput): Promise<FieldDefinition>;
  updateField(id: string, input: UpdateFieldInput): Promise<FieldDefinition>;
  archiveField(id: string): Promise<void>;
  restoreField(id: string): Promise<FieldDefinition>;
  deleteField(id: string): Promise<void>;
};

function sortFields(fields: FieldDefinition[]): FieldDefinition[] {
  return [...fields].sort((left, right) => left.order - right.order);
}

function upsertDefinition(
  fields: FieldDefinition[],
  definition: FieldDefinition,
): FieldDefinition[] {
  const exists = fields.some((field) => field.id === definition.id);
  return sortFields(
    exists
      ? fields.map((field) => (field.id === definition.id ? definition : field))
      : [...fields, definition],
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Không thể tải trường tùy chỉnh. Vui lòng thử lại.";
}

export function useCustomFields(
  moduleKey: ModuleKey,
  tenantId?: string,
): UseCustomFieldsResult {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [archivedFields, setArchivedFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const refreshCounts = useRef(new Map<ModuleKey, number>());
  const currentModule = useRef(moduleKey);
  const mounted = useRef(false);
  const sourceId = useRef<string | null>(null);

  currentModule.current = moduleKey;
  if (!sourceId.current) sourceId.current = `custom-fields-${++sourceSequence}`;

  const isActiveModule = useCallback(
    (targetModule: ModuleKey) =>
      mounted.current && currentModule.current === targetModule,
    [],
  );

  const refresh = useCallback(async () => {
    const requestedModule = moduleKey;
    if (!isActiveModule(requestedModule)) return;
    const version = ++requestVersion.current;
    refreshCounts.current.set(
      requestedModule,
      (refreshCounts.current.get(requestedModule) ?? 0) + 1,
    );
    setLoading(true);
    setError(null);
    try {
      const definitions = await listCustomFields(
        requestedModule,
        true,
        tenantId,
      );
      if (
        isActiveModule(requestedModule) &&
        requestVersion.current === version
      ) {
        setFields(sortFields(definitions.filter((field) => !field.isArchived)));
        setArchivedFields(
          sortFields(definitions.filter((field) => field.isArchived)),
        );
      }
    } catch (caught) {
      if (
        isActiveModule(requestedModule) &&
        requestVersion.current === version
      ) {
        setError(errorMessage(caught));
      }
    } finally {
      const remaining = Math.max(
        0,
        (refreshCounts.current.get(requestedModule) ?? 1) - 1,
      );
      if (remaining === 0) {
        refreshCounts.current.delete(requestedModule);
      } else {
        refreshCounts.current.set(requestedModule, remaining);
      }
      if (isActiveModule(requestedModule) && remaining === 0) {
        setLoading(false);
      }
    }
  }, [isActiveModule, moduleKey, tenantId]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const onChanged = (event: Event) => {
      const detail = (
        event as CustomEvent<{ moduleKey?: ModuleKey; sourceId?: string }>
      ).detail;
      if (
        detail?.moduleKey !== moduleKey ||
        detail.sourceId === sourceId.current
      )
        return;
      void refresh();
    };
    window.addEventListener("custom-fields:changed", onChanged);
    return () => {
      mounted.current = false;
      window.removeEventListener("custom-fields:changed", onChanged);
    };
  }, [moduleKey, refresh]);

  const dispatchChanged = useCallback(
    (changedModule: ModuleKey) => {
      if (!isActiveModule(changedModule)) return;
      window.dispatchEvent(
        new CustomEvent("custom-fields:changed", {
          detail: { moduleKey: changedModule, sourceId: sourceId.current },
        }),
      );
    },
    [isActiveModule],
  );

  const mergeDefinition = useCallback((definition: FieldDefinition) => {
    if (definition.isArchived) {
      setFields((current) =>
        current.filter((field) => field.id !== definition.id),
      );
      setArchivedFields((current) => upsertDefinition(current, definition));
    } else {
      setArchivedFields((current) =>
        current.filter((field) => field.id !== definition.id),
      );
      setFields((current) => upsertDefinition(current, definition));
    }
  }, []);

  const runMutation = useCallback(
    async <T>(
      mutationModule: ModuleKey,
      mutation: () => Promise<T>,
      apply: (result: T) => void,
    ): Promise<T> => {
      ++requestVersion.current;
      if (isActiveModule(mutationModule)) setError(null);
      try {
        const result = await mutation();
        if (isActiveModule(mutationModule)) {
          ++requestVersion.current;
          apply(result);
          dispatchChanged(mutationModule);
        }
        return result;
      } catch (caught) {
        if (isActiveModule(mutationModule)) setError(errorMessage(caught));
        throw caught;
      }
    },
    [dispatchChanged, isActiveModule],
  );

  const createField = useCallback(
    async (input: CreateFieldInput) => {
      const mutationModule = moduleKey;
      return runMutation(
        mutationModule,
        () => createCustomField(mutationModule, input, tenantId),
        mergeDefinition,
      );
    },
    [mergeDefinition, moduleKey, runMutation, tenantId],
  );

  const updateField = useCallback(
    async (id: string, input: UpdateFieldInput) => {
      const mutationModule = moduleKey;
      return runMutation(
        mutationModule,
        () => updateCustomField(mutationModule, id, input, tenantId),
        mergeDefinition,
      );
    },
    [mergeDefinition, moduleKey, runMutation, tenantId],
  );

  const archiveField = useCallback(
    async (id: string) => {
      const mutationModule = moduleKey;
      await runMutation(
        mutationModule,
        () => archiveCustomField(mutationModule, id, tenantId),
        mergeDefinition,
      );
    },
    [mergeDefinition, moduleKey, runMutation, tenantId],
  );

  const restoreField = useCallback(
    async (id: string) => {
      const mutationModule = moduleKey;
      return runMutation(
        mutationModule,
        () => restoreCustomField(mutationModule, id, tenantId),
        mergeDefinition,
      );
    },
    [mergeDefinition, moduleKey, runMutation, tenantId],
  );

  const deleteField = useCallback(
    async (id: string) => {
      const mutationModule = moduleKey;
      await runMutation(
        mutationModule,
        () => deleteCustomField(mutationModule, id, tenantId),
        () => {
          setFields((current) => current.filter((field) => field.id !== id));
          setArchivedFields((current) =>
            current.filter((field) => field.id !== id),
          );
        },
      );
    },
    [moduleKey, runMutation, tenantId],
  );

  return {
    fields,
    archivedFields,
    loading,
    error,
    refresh,
    createField,
    updateField,
    archiveField,
    restoreField,
    deleteField,
  };
}
