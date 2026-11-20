import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { FeatureKey } from '../models/FeatureFlag.js';
import { isEnabled } from '../services/featureFlagService.js';

function requireFeature(key: FeatureKey): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.user || !(await isEnabled(key, req.user))) {
        return next(new AppError({ status: 403, code: ERROR_CODES.FEATURE_DISABLED, message: 'Tính năng này chưa được mở cho tài khoản của bạn.' }));
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export { requireFeature };
