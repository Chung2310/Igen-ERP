import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { IUser } from "../interface/user.interface";
import { ICompany } from "../interface/company.interface";

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
   * Lấy danh sách người dùng theo bộ lọc, tự động seed cấu trúc sơ đồ mẫu nếu doanh nghiệp mới trống
   */
  async getUsers(filter: { companyCode?: string } = {}): Promise<IUser[]> {
    let users = await UserModel.find(filter).select("-password").sort({ createdAt: -1 });

    // Tự động seed sơ đồ tổ chức mẫu nếu cấu hình SEED_MOCK_USERS=true và có <= 1 thành viên
    if (process.env.SEED_MOCK_USERS === "true" && filter.companyCode && filter.companyCode !== "SYSTEM" && users.length <= 1) {
      const companyCode = filter.companyCode;
      let ceo = users.find(u => u.role === "admin" || u.role === "superadmin");
      if (!ceo) {
        ceo = users[0];
      }

      if (ceo) {
        const companyName = ceo.companyName || companyCode;

        // 1. Cập nhật CEO gốc
        await UserModel.findByIdAndUpdate(ceo._id, {
          $set: {
            jobTitle: "Chief Executive Officer (CEO)",
            department: "Ban Giám Đốc",
            division: "Ban Giám Đốc",
            phone: ceo.phone || "0901234567",
            photoURL: ceo.photoURL || "👨‍💼",
            level: 1,
            status: "online"
          }
        });

        // 2. Danh sách nhân sự mẫu
        const mockEmployees = [
          { email: `hai.nl@${companyCode.toLowerCase()}.vn`, displayName: "Nguyễn Lê Hải", jobTitle: "Chief Operations Officer (COO)", department: "Ban Giám Đốc", phone: "0901112223", photoURL: "👨‍💻", level: 2, parentId: ceo._id.toString(), role: "admin", division: "Khối Vận Hành", status: "online" },
          { email: `anh.tm@${companyCode.toLowerCase()}.vn`, displayName: "Trần Mai Anh", jobTitle: "Chief CMO", department: "Ban Giám Đốc", phone: "0903334445", photoURL: "👩‍💼", level: 2, parentId: ceo._id.toString(), role: "admin", division: "Khối Marketing", status: "online" },
          { email: `huy.hg@${companyCode.toLowerCase()}.vn`, displayName: "Hoàng Gia Huy", jobTitle: "Trưởng phòng Kho vận", department: "Phòng Kho Vận", phone: "0905556667", photoURL: "📦", level: 3, role: "user", division: "Khối Vận Hành", status: "online" },
          { email: `tuan.lq@${companyCode.toLowerCase()}.vn`, displayName: "Lưu Quốc Tuấn", jobTitle: "Trưởng phòng Marketing", department: "Phòng Marketing", phone: "0907778889", photoURL: "📣", level: 3, role: "user", division: "Khối Marketing", status: "offline" },
          { email: `vy.nb@${companyCode.toLowerCase()}.vn`, displayName: "Nguyễn Bích Vy", jobTitle: "Trưởng phòng Sales CRM", department: "Phòng Sales", phone: "0908889990", photoURL: "👩‍💻", level: 3, role: "user", division: "Khối Sales", status: "online" },
          { email: `sang.ln@${companyCode.toLowerCase()}.vn`, displayName: "Lê Ngọc Sang", jobTitle: "Chuyên viên Vận chuyển", department: "Phòng Kho Vận", phone: "0909990001", photoURL: "🚛", level: 4, role: "user", division: "Khối Vận Hành", status: "offline" },
          { email: `nam.pd@${companyCode.toLowerCase()}.vn`, displayName: "Phan Đình Nam", jobTitle: "AI Copywriter Specialist", department: "Phòng Marketing", phone: "0909990002", photoURL: "💡", level: 4, role: "user", division: "Khối Marketing", status: "online" },
          { email: `linh.vt@${companyCode.toLowerCase()}.vn`, displayName: "Vũ Thùy Linh", jobTitle: "Chăm sóc khách hàng VIP", department: "Phòng Sales", phone: "0909990003", photoURL: "👩‍⚕️", level: 4, role: "user", division: "Khối Sales", status: "online" }
        ];

        // Tạo COO & CMO
        const createdUsers: Record<string, string> = {};
        
        const coo = new UserModel({
          ...mockEmployees[0],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10)
        });
        await coo.save();
        createdUsers["MOCK_hai"] = coo._id.toString();

        const cmo = new UserModel({
          ...mockEmployees[1],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10)
        });
        await cmo.save();
        createdUsers["MOCK_anh"] = cmo._id.toString();

        // Tạo các phòng ban
        const lpKv = new UserModel({
          ...mockEmployees[2],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
          parentId: createdUsers["MOCK_hai"]
        });
        await lpKv.save();
        createdUsers["MOCK_huy"] = lpKv._id.toString();

        const lpMkt = new UserModel({
          ...mockEmployees[3],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
          parentId: createdUsers["MOCK_anh"]
        });
        await lpMkt.save();
        createdUsers["MOCK_tuan"] = lpMkt._id.toString();

        const lpSales = new UserModel({
          ...mockEmployees[4],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
          parentId: createdUsers["MOCK_hai"]
        });
        await lpSales.save();
        createdUsers["MOCK_vy"] = lpSales._id.toString();

        // Tạo cấp dưới trực thuộc
        const cvVc = new UserModel({
          ...mockEmployees[5],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
          parentId: createdUsers["MOCK_huy"]
        });
        await cvVc.save();

        const aiCopy = new UserModel({
          ...mockEmployees[6],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
          parentId: createdUsers["MOCK_tuan"]
        });
        await aiCopy.save();

        const csKh = new UserModel({
          ...mockEmployees[7],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
          parentId: createdUsers["MOCK_vy"]
        });
        await csKh.save();

        users = await UserModel.find(filter).select("-password").sort({ createdAt: -1 });
      }
    }

    return users;
  },

  /**
   * Lấy danh sách tất cả doanh nghiệp
   */
  async getAllCompanies(): Promise<ICompany[]> {
    return await CompanyModel.find({}).sort({ createdAt: -1 });
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
  },

  /**
   * Cập nhật thông tin chi tiết một nhân sự (Admin/Superadmin)
   */
  async updateUser(userId: string, updateData: any, callerCompanyCode: string, callerRole: string): Promise<IUser | null> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    if (callerRole !== "superadmin") {
      if (user.companyCode !== callerCompanyCode) {
        throw new Error("Bạn không có quyền chỉnh sửa nhân sự của doanh nghiệp khác.");
      }
      if (user.role === "superadmin") {
        throw new Error("Không thể chỉnh sửa tài khoản Superadmin.");
      }
    }

    if (updateData.role && callerRole !== "superadmin") {
      if (updateData.role === "superadmin" || updateData.role === "admin") {
        throw new Error("Bạn không có quyền gán vai trò Admin hoặc Superadmin.");
      }
    }

    return await UserModel.findByIdAndUpdate(userId, { $set: updateData }, { new: true }).select("-password");
  },

  /**
   * Cập nhật hàng loạt thông tin nhân sự (ví dụ: kéo thả thay đổi sơ đồ)
   */
  async bulkUpdateUsers(updates: any[], callerCompanyCode: string, callerRole: string): Promise<void> {
    for (const update of updates) {
      const { id, ...data } = update;
      const user = await UserModel.findById(id);
      if (!user) continue;

      if (callerRole !== "superadmin") {
        if (user.companyCode !== callerCompanyCode) {
          throw new Error("Bạn không có quyền chỉnh sửa nhân sự của doanh nghiệp khác.");
        }
        if (user.role === "superadmin") {
          throw new Error("Không thể chỉnh sửa tài khoản Superadmin.");
        }
      }

      await UserModel.findByIdAndUpdate(id, { $set: data });
    }
  },

  /**
   * Xóa nhân sự và điều chuyển cấp dưới trực thuộc
   */
  async deleteUser(userId: string, callerCompanyCode: string, callerRole: string): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    if (callerRole !== "superadmin") {
      if (user.companyCode !== callerCompanyCode) {
        throw new Error("Bạn không có quyền xóa nhân sự của doanh nghiệp khác.");
      }
      if (user.role === "superadmin" || user.role === "admin") {
        throw new Error("Không thể xóa tài khoản Quản trị viên.");
      }
    }

    const parentId = user.parentId || null;
    let parentLevel = 1;
    if (parentId) {
      const parentUser = await UserModel.findById(parentId);
      parentLevel = parentUser?.level || 1;
    }

    // Cập nhật tất cả cấp dưới trực thuộc của nhân sự bị xóa
    const children = await UserModel.find({ parentId: userId });
    for (const child of children) {
      child.parentId = parentId || undefined;
      child.level = parentLevel + 1;
      await child.save();
    }

    await UserModel.findByIdAndDelete(userId);
  }
};
