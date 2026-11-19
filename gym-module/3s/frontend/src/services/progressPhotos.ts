import type { WorkoutProgressPhotoDraft, WorkoutProgressPhotoInput } from '../types';
import { api } from './api';

interface UploadedProgressImage {
  url: string;
  publicId: string;
}

export async function uploadWorkoutProgressPhotos(drafts: WorkoutProgressPhotoDraft[]): Promise<WorkoutProgressPhotoInput[]> {
  if (drafts.length === 0) return [];

  const formData = new FormData();
  for (const draft of drafts) formData.append('images', draft.file);
  const result = await api.upload<UploadedProgressImage[]>('/api/upload/images', formData);

  return result.data.map((image, index) => ({
    photoUrl: image.url,
    angle: drafts[index]?.angle || 'OTHER',
  }));
}
