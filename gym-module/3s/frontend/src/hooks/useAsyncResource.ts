import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncResourceStatus = 'loading' | 'success' | 'error';

export interface AsyncResource<T> {
  data: T | null;
  error: unknown;
  status: AsyncResourceStatus;
  refresh: () => Promise<void>;
}

export function useAsyncResource<T>(loader: () => Promise<T>): AsyncResource<T> {
  const mounted = useRef(true);
  const dataRef = useRef<T | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [status, setStatus] = useState<AsyncResourceStatus>('loading');

  const refresh = useCallback(async () => {
    setError(null);
    if (dataRef.current === null) setStatus('loading');
    try {
      const nextData = await loader();
      if (!mounted.current) return;
      dataRef.current = nextData;
      setData(nextData);
      setStatus('success');
    } catch (nextError) {
      if (!mounted.current) return;
      setError(nextError);
      setStatus('error');
    }
  }, [loader]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, [refresh]);

  return { data, error, status, refresh };
}
