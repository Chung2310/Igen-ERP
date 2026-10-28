import type { Student } from '../types';

const entries = new Map<string, { at: number; students: Student[] }>();
export function readStudentListCache(key: string) {
  const value = entries.get(key);
  if (!value || Date.now() - value.at >= 30000) { entries.delete(key); return undefined; }
  return value.students;
}
export function writeStudentListCache(key: string, students: Student[]) {
  entries.delete(key);
  entries.set(key, { at: Date.now(), students });
  if (entries.size > 8) entries.delete(entries.keys().next().value!);
}
export function clearStudentListCache() { entries.clear(); }
if (typeof window !== 'undefined') {
  window.addEventListener('student-mutation', clearStudentListCache);
  window.addEventListener('unauthorized', clearStudentListCache);
}
