import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
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

  /**
   * Cập nhật thông tin tài khoản người dùng
   */
  async updateProfile(id: string, updateData: any): Promise<IUser | null> {
    return await UserModel.findByIdAndUpdate(id, { $set: updateData }, { new: true }).select("-password");
  },

  /**
   * Thay đổi mật khẩu người dùng
   */
  async changePassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await UserModel.findByIdAndUpdate(id, { $set: { password: hashedPassword } });
  },

  /**
   * Đăng ký doanh nghiệp mới và tài khoản admin tương ứng
   */
  async registerCompanyAndAdmin(data: any): Promise<any> {
    const { companyName, companyCode, ownerName, ownerEmail, ownerPassword } = data;
    const normalizedCode = companyCode.toUpperCase().trim();
    const emailLower = ownerEmail.toLowerCase().trim();

    // 1. Kiểm tra mã doanh nghiệp
    const existingCompany = await CompanyModel.findOne({ code: normalizedCode });
    if (existingCompany) {
      throw new Error(`Mã doanh nghiệp "${normalizedCode}" đã tồn tại trên hệ thống.`);
    }

    // 2. Kiểm tra email admin
    const existingUser = await UserModel.findOne({ email: emailLower });
    if (existingUser) {
      throw new Error(`Địa chỉ email "${emailLower}" đã được sử dụng cho một tài khoản khác.`);
    }

    // 3. Tạo doanh nghiệp
    const newCompany = new CompanyModel({
      code: normalizedCode,
      name: companyName.trim(),
      ownerEmail: emailLower,
      createdAt: new Date()
    });
    await newCompany.save();

    // 4. Tạo tài khoản admin của doanh nghiệp đó
    const hashedPassword = await bcrypt.hash(ownerPassword, 10);
    const adminUser = new UserModel({
      email: emailLower,
      password: hashedPassword,
      displayName: ownerName.trim(),
      role: "admin",
      createdAt: new Date(),
      companyCode: normalizedCode,
      companyName: companyName.trim(),
      jobTitle: "Chief Executive Officer (CEO)",
      department: "Ban Giám Đốc",
      division: "Ban Giám Đốc",
      level: 1,
      status: "offline",
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerName.trim())}&background=random&color=fff`
    });

    await adminUser.save();
    return { company: newCompany, admin: adminUser };
  },

  /**
   * Đăng ký người dùng mới cho doanh nghiệp
   */
  async registerUserForCompany(data: any): Promise<IUser> {
    const {
      displayName,
      email,
      password,
      role,
      companyCode,
      companyName,
      parentId,
      level,
      department,
      division,
      phone,
    } = data;

    const emailLower = email.toLowerCase().trim();
    const existingUser = await UserModel.findOne({ email: emailLower });
    if (existingUser) {
      throw new Error(`Địa chỉ email "${emailLower}" đã được sử dụng cho một tài khoản khác.`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new UserModel({
      email: emailLower,
      password: hashedPassword,
      displayName: displayName.trim(),
      role,
      companyCode: companyCode?.toUpperCase().trim(),
      companyName: companyName?.trim(),
      parentId: parentId || undefined,
      level: level || (role === "admin" ? 1 : (role === "manager" ? 3 : 4)),
      department: department || (role === "admin" ? "Ban Giám Đốc" : (role === "manager" ? "Quản lý" : "Nhân sự")),
      division: division || (role === "admin" ? "Ban Giám Đốc" : (role === "manager" ? "Quản lý" : "Nhân sự")),
      jobTitle: role === "admin" ? "Chief Executive Officer (CEO)" : (role === "manager" ? "Quản lý phòng ban" : "Nhân viên"),
      phone: phone || "Chưa cập nhật",
      createdAt: new Date(),
      status: "offline",
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName.trim())}&background=random&color=fff`
    });

    return await newUser.save();
  }
};
