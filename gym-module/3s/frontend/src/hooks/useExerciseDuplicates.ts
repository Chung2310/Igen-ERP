import { useEffect, useState } from 'react';
import { checkExerciseDuplicates, normalizeExerciseName } from '../services/exerciseDuplicates';
import { errorMessage, type ExerciseDuplicateCheckResult } from '../types';

export function useExerciseDuplicates(names: string[], active: boolean) {
  const key = JSON.stringify(names.map(normalizeExerciseName));
  const [result, setResult] = useState<ExerciseDuplicateCheckResult | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError('');
    if (!active) return;
    const timer = setTimeout(() => {
      void checkExerciseDuplicates(JSON.parse(key) as string[]).then((duplicates) => {
        if (!cancelled) setResult({ key, names: duplicates });
      }).catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause));
      });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, active, attempt]);

  const ready = active && result?.key === key;
  const existing = new Set(ready ? result.names : []);
  const seen = new Set<string>();
  const reasons = names.map((name) => {
    const normalized = normalizeExerciseName(name);
    const repeated = seen.has(normalized);
    if (normalized) seen.add(normalized);
    if (existing.has(normalized)) return 'Đã có trong thư viện';
    if (repeated) return 'Trùng với bài khác trong danh sách';
    return '';
  });

  return { ready, reasons, error, retry: () => setAttempt((value) => value + 1) };
}
