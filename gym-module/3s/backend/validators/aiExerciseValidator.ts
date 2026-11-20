import Joi from 'joi';
import type { RequestValidationSchema } from '../middlewares/validate.js';
import { commonMessages } from './commonValidator.js';

const quantityWords: Record<string, number> = {
  mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5,
  sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10,
};

function normalizeVietnamese(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function exerciseQuantityFromPrompt(prompt: string): number {
  const normalized = normalizeVietnamese(prompt);
  const match = normalized.match(/\b(\d{1,3}|mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)\s+bai(?:\s+tap)?\b/);
  if (!match) return 1;
  return /^\d+$/.test(match[1]) ? Number(match[1]) : quantityWords[match[1]];
}

export const exerciseGenerationRequestSchema: RequestValidationSchema = {
  body: Joi.object({
    prompt: Joi.string().trim().min(3).max(1000).required(),
  }).custom((value, helpers) => {
    const quantity = exerciseQuantityFromPrompt(value.prompt);
    if (quantity < 1 || quantity > 10) return helpers.message({ custom: 'Prompt chỉ được yêu cầu từ 1 đến 10 bài tập.' });
    return { ...value, quantity };
  }).messages({ ...commonMessages, custom: '{{#message}}' }),
};
