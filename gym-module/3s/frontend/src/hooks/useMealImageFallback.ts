import { useEffect, useState } from 'react';
import { api } from '../services/api';

/** Generate one Gemini replacement for a missing or broken poster image. */
export function useMealImageFallback(src: string | null | undefined, mealName: string) {
  const [brokenSource, setBrokenSource] = useState<string>();
  const [replacement, setReplacement] = useState<{ key: string; url: string }>();
  const [failedKey, setFailedKey] = useState<string>();
  const key = JSON.stringify([src, mealName]);
  const needsReplacement = !src || brokenSource === key;
  const imageSrc = needsReplacement ? (replacement?.key === key ? replacement.url : undefined) : src;

  useEffect(() => {
    if (!needsReplacement) return;
    const controller = new AbortController();
    api.post<{ imageUrl: string }>('/api/images/meal-image', {
      mealName,
      items: [mealName],
      aspectRatio: '1:1',
      forceRegenerate: true,
    }, { signal: controller.signal }).then(({ data }) => {
      if (!data.imageUrl) throw new Error('Missing meal image');
      if (!controller.signal.aborted) setReplacement({ key, url: data.imageUrl });
    }).catch(() => {
      if (!controller.signal.aborted) setFailedKey(key);
    });
    return () => controller.abort();
  }, [key, mealName, needsReplacement]);

  return {
    imageSrc,
    failed: failedKey === key,
    onImageError: () => {
      if (needsReplacement) setFailedKey(key);
      else setBrokenSource(key);
    },
  };
}
