export const VIDEO_MODEL_OPTIONS = [
  { value: 'piapi-veo31-video-audio', label: 'PiAPI Veo 3.1', desc: 'Chat luong cao, co audio' },
  { value: 'piapi-veo31-video-fast-audio', label: 'PiAPI Veo 3.1 Fast', desc: 'Toi uu toc do, co audio' },
  { value: 'piapi-veo31-video-fast-no-audio', label: 'PiAPI Veo 3.1 Fast Silent', desc: 'Nhanh hon, khong tao audio' },
  { value: 'piapi-kling', label: 'PiAPI Kling', desc: 'Phuong an fallback on dinh' },
] as const;

export const VIDEO_DURATION_OPTIONS = [
  { value: '4', label: '4 giay' },
  { value: '6', label: '6 giay' },
  { value: '8', label: '8 giay' },
] as const;

export const VIDEO_QUALITY_OPTIONS = [
  { value: '1080p', label: '1080p (Full HD)' },
  { value: '720p', label: '720p (HD)' },
] as const;
