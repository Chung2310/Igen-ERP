import { api } from './api';

export function normalizeExerciseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

export async function checkExerciseDuplicates(names: string[]): Promise<string[]> {
  const result = await api.post<{ names: string[] }>('/api/exercises/duplicate-check', { names });
  return result.data.names.map(normalizeExerciseName);
}
