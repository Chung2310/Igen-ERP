export function formatAiModelName(name: string): string {
  if (!name) return '';
  return name.replace(/-preview/g, '').toUpperCase();
}

export function estimateAudioDuration(text: string): number {
  return Math.max(1, Math.ceil(text.length / 13));
}
