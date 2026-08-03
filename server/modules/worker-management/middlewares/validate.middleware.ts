import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export function validate(schema: Joi.Schema, source: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false });
    if (error) {
      // Forward Joi validation error
      (error as unknown as Record<string, unknown>).isJoi = true;
      return next(error);
    }
    req[source] = value;
    next();
  };
}
