import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Bọc một handler async để mọi lỗi ném ra (kể cả promise rejection) đều được
 * chuyển tới `apiErrorHandler` thay vì biến thành unhandled rejection hoặc
 * bị controller tự nuốt và trả về status/thông báo lỗi thô.
 */
export function asyncHandler<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => unknown,
): RequestHandler {
  return (req, res, next) => {
    try {
      const result = handler(req as unknown as Req, res, next);
      if (result instanceof Promise) result.catch(next);
    } catch (error) {
      next(error);
    }
  };
}

type HandlerMap = Record<string, (req: any, res: Response, next: NextFunction) => unknown>;

/**
 * Bọc toàn bộ handler của một controller object bằng {@link asyncHandler}.
 */
export function wrapController<T extends HandlerMap>(controller: T): { [K in keyof T]: RequestHandler } {
  const wrapped = {} as { [K in keyof T]: RequestHandler };
  for (const key of Object.keys(controller) as (keyof T)[]) {
    wrapped[key] = asyncHandler(controller[key] as any);
  }
  return wrapped;
}
