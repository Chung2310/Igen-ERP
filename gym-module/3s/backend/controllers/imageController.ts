import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import { generateImage, type AspectRatio, type OutputFormat } from '../services/imageProvider.js';

/**
 * POST /api/images/generate
 * Body: { prompt: string, aspectRatio?: string, outputFormat?: string, seed?: number }
 * Returns: { b64Json, mediaType, cost, completionTokens }
 */
const generate = asyncHandler(async (req, res) => {
  const { prompt, aspectRatio, outputFormat, seed } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: { code: 400, message: 'Vui lòng cung cấp prompt mô tả ảnh cần tạo.' } });
  }

  const result = await generateImage({ userId: req.user!.id, taskType: 'IMAGE_GENERATION', requestKey: `${req.requestId}:image-generation` }, {
    prompt: prompt.trim(),
    aspectRatio: (aspectRatio as AspectRatio) || '1:1',
    outputFormat: (outputFormat as OutputFormat) || 'jpeg',
    seed: seed !== undefined ? Number(seed) : undefined,
  });

  return success(res, {
    message: 'Tạo ảnh AI thành công.',
    data: {
      b64Json: result.b64Json,
      mediaType: result.mediaType,
      cost: result.cost,
      completionTokens: result.completionTokens,
    },
  });
});

export { generate };
