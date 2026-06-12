// Mock / Stub usage tracker to bypass Firestore dependencies in ERP

export const USD_TO_VND = 100; // 100 VNĐ = 1 Credit

export const PRICING_TABLE: Record<string, {
  costPerUnitUSD: number;
  inputCostPerUnitUSD?: number;
  unit: string;
  label: string;
  category: 'video' | 'audio' | 'image' | 'text';
  note?: string;
}> = {
  'piapi-veo31-video-audio': {
    costPerUnitUSD: 81.0,
    unit: 'seconds',
    label: 'PiAPI Veo 3.1',
    category: 'video',
  },
  'piapi-veo31-video-fast-audio': {
    costPerUnitUSD: 40.5,
    unit: 'seconds',
    label: 'PiAPI Veo 3.1 Fast',
    category: 'video',
  },
  'piapi-veo31-video-fast-no-audio': {
    costPerUnitUSD: 20.25,
    unit: 'seconds',
    label: 'PiAPI Veo 3.1 Fast Silent',
    category: 'video',
  },
  'piapi-kling': {
    costPerUnitUSD: 18.0,
    unit: 'seconds',
    label: 'PiAPI Kling',
    category: 'video',
  },
  'gemini-2.5-flash-preview-tts': {
    costPerUnitUSD: 0.1275,
    unit: 'seconds',
    label: 'iGen 2.5 Flash TTS',
    category: 'audio',
  },
  'gemini-2.5-pro-preview-tts': {
    costPerUnitUSD: 0.255,
    unit: 'seconds',
    label: 'iGen 2.5 Pro TTS',
    category: 'audio',
  },
  'eleven_flash_v1': {
    costPerUnitUSD: 0.15,
    unit: 'seconds',
    label: 'iGen ElevenLabs Flash v1',
    category: 'audio',
  },
  'eleven_v3': {
    costPerUnitUSD: 0.35,
    unit: 'seconds',
    label: 'iGen ElevenLabs v3',
    category: 'audio',
  },
  'eleven_flash_v2_5': {
    costPerUnitUSD: 0.15,
    unit: 'seconds',
    label: 'iGen ElevenLabs Flash v2.5',
    category: 'audio',
  },
  'eleven_turbo_v2_5': {
    costPerUnitUSD: 0.20,
    unit: 'seconds',
    label: 'iGen ElevenLabs Turbo v2.5',
    category: 'audio',
  },
  'eleven_multilingual_v2': {
    costPerUnitUSD: 0.30,
    unit: 'seconds',
    label: 'iGen ElevenLabs Multilingual v2',
    category: 'audio',
  },
  'eleven_turbo_v2.5': {
    costPerUnitUSD: 0.20,
    unit: 'seconds',
    label: 'iGen ElevenLabs Turbo v2.5',
    category: 'audio',
  },
  'gemini-3.1-flash-image-preview': {
    costPerUnitUSD: 27.5,
    unit: 'count',
    label: 'iGen 3.1 Flash Image',
    category: 'image',
  },
  'gemini-3-pro-image-preview': {
    costPerUnitUSD: 57,
    unit: 'count',
    label: 'iGen 3 Pro Image',
    category: 'image',
  },
  'gemini-2.5-flash-preview-image': {
    costPerUnitUSD: 13.75,
    unit: 'count',
    label: 'iGen 2.5 Flash Image',
    category: 'image',
  },
  'imagen-3.0-generate-002': {
    costPerUnitUSD: 27.5,
    unit: 'count',
    label: 'Google Imagen 3.0 Pro',
    category: 'image',
  },
  'imagen-3.0-fast-generate-002': {
    costPerUnitUSD: 13.75,
    unit: 'count',
    label: 'Google Imagen 3.0 Flash',
    category: 'image',
  },
  'nano-banana-pro': {
    costPerUnitUSD: 27.5,
    unit: 'count',
    label: 'iGen Image Pro',
    category: 'image',
  },
  'nano-banana-2': {
    costPerUnitUSD: 13.75,
    unit: 'count',
    label: 'iGen Image Flash',
    category: 'image',
  },
};

export function formatAiModelName(name: string): string {
  if (!name) return '';
  return name.replace(/-preview/g, '').toUpperCase();
}

export function estimateCost(model: string, amount: number, options?: { resolution?: string; inputAmount?: number }) {
  const pricing = PRICING_TABLE[model];
  if (!pricing) {
    return {
      costUSD: 0,
      costVND: 0,
      unit: 'unknown',
      category: 'text' as const,
      label: formatAiModelName(model),
    };
  }

  const multiplier = pricing.unit === '1k tokens' ? 1000 : 1;
  const scaledAmount = amount / multiplier;
  let costUSD = pricing.costPerUnitUSD * scaledAmount;
  const costVND = Math.round(costUSD * USD_TO_VND);

  return {
    costUSD: Math.round(costUSD * 100) / 100,
    costVND,
    unit: pricing.unit,
    category: pricing.category,
    label: formatAiModelName(pricing.label),
  };
}

export function estimateAudioDuration(text: string): number {
  return Math.max(1, Math.ceil(text.length / 13));
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

export async function recordUsage(params: any): Promise<void> {
  // Stubbed out - no database write on ERP frontend
  console.log(`[UsageTracker Stub] recordUsage stub:`, params);
  return Promise.resolve();
}
