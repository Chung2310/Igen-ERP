import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";
import { IUser } from "../interface/user.interface";

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || "your_jwt_access_secret_key";
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || "your_jwt_refresh_secret_key";

export const authService = {
  /**
   * Tạo bộ đôi Access Token và Refresh Token
   */
  generateTokens(user: IUser) {
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      companyCode: user.companyCode,
    };

    const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: "7d" });

    return { accessToken, refreshToken };
  },

  /**
   * Đăng ký tài khoản người dùng mới
   */
  async register(data: any): Promise<IUser> {
    const emailLower = data.email.toLowerCase().trim();
    const existingUser = await UserModel.findOne({ email: emailLower });
    
    if (existingUser) {
      throw new Error("Email này đã được đăng ký sử dụng.");
    }

    let hashedPassword = undefined;
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 10);
    }

    const newUser = new UserModel({
      ...data,
      email: emailLower,
      password: hashedPassword,
    });

    return await newUser.save();
  },

  /**
   * Đăng nhập tài khoản
   */
  async login(email: string, password?: string) {
    const emailLower = email.toLowerCase().trim();
    const user = await UserModel.findOne({ email: emailLower });

    if (!user) {
      throw new Error("Tài khoản hoặc mật khẩu không chính xác.");
    }

    if (user.password && password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new Error("Tài khoản hoặc mật khẩu không chính xác.");
      }
    } else if (user.password && !password) {
      throw new Error("Yêu cầu mật khẩu để đăng nhập.");
    }

    const tokens = this.generateTokens(user);
    return { user, ...tokens };
  },

  /**
   * Làm mới Access Token từ Refresh Token
   */
  async refresh(token: string) {
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as any;
      const user = await UserModel.findById(decoded.id);

      if (!user) {
        throw new Error("Không tìm thấy thông tin tài khoản.");
      }

      const payload = {
        id: user._id,
        email: user.email,
        role: user.role,
        companyCode: user.companyCode,
      };

      const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
      return { accessToken };
    } catch (error) {
      throw new Error("Mã làm mới (Refresh Token) đã hết hạn hoặc không hợp lệ.");
    }
  },

  /**
   * Lấy thông tin tài khoản hiện tại
   */
  async getMe(id: string): Promise<IUser | null> {
    return await UserModel.findById(id).select("-password");
  },
};
