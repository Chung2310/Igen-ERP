import { generateImage } from './imageProvider.js';
import type { AiBillingContext } from './creditTypes.js';

export interface MealImageResult {
  buffer: Buffer;
  contentType: string;
}

export async function getMealImage(context: AiBillingContext, prompt: string, seed: string): Promise<MealImageResult> {
  const numericSeed = Number(seed);
  const image = await generateImage(context, {
    prompt,
    aspectRatio: '1:1',
    seed: Number.isSafeInteger(numericSeed) && numericSeed >= 0 ? numericSeed : undefined,
  });
  return { buffer: Buffer.from(image.b64Json, 'base64'), contentType: image.mediaType };
}
