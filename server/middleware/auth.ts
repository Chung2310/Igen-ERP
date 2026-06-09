import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    companyCode?: string;
  };
}

/**
 * Middleware yêu cầu đăng nhập bằng Access Token
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "error",
      message: "Yêu cầu đăng nhập. Không tìm thấy mã xác thực.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || "your_jwt_access_secret_key"
    ) as any;

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      companyCode: decoded.companyCode,
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      status: "error",
      message: "Mã xác thực không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
    });
  }
}
