import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FeatureKey, FeatureState } from '../types/api';
import { api } from './api';

interface FeatureContextValue {
  features: FeatureState;
  loading: boolean;
  error: unknown;
  isEnabled: (feature: FeatureKey) => boolean;
}

interface FeaturesProviderProps {
  children: ReactNode;
  initialFeatures?: FeatureState;
}

const FeatureContext = createContext<FeatureContextValue | null>(null);
let cachedFeatures: FeatureState | null = null;
let pendingFeatures: Promise<FeatureState> | null = null;

function loadFeatures(): Promise<FeatureState> {
  if (cachedFeatures) return Promise.resolve(cachedFeatures);
  pendingFeatures ??= api.get<FeatureState>('/api/features/me').then(({ data }) => {
    cachedFeatures = data;
    return data;
  }).finally(() => { pendingFeatures = null; });
  return pendingFeatures;
}

export function FeaturesProvider({ children, initialFeatures }: FeaturesProviderProps) {
  const [features, setFeatures] = useState<FeatureState>(initialFeatures ?? cachedFeatures ?? {});
  const [loading, setLoading] = useState(initialFeatures === undefined && cachedFeatures === null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (initialFeatures !== undefined || cachedFeatures !== null) return;
    let active = true;
    loadFeatures().then((nextFeatures) => {
      if (active) setFeatures(nextFeatures);
    }).catch((nextError: unknown) => {
      if (active) setError(nextError);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [initialFeatures]);

  const value = useMemo<FeatureContextValue>(() => ({
    features,
    loading,
    error,
    isEnabled: (feature) => features[feature] === true,
  }), [error, features, loading]);

  return createElement(FeatureContext.Provider, { value }, children);
}

export function useFeatures(): FeatureContextValue {
  const value = useContext(FeatureContext);
  if (!value) throw new Error('useFeatures phải được dùng bên trong FeaturesProvider.');
  return value;
}
