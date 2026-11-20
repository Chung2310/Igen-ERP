import type { ClientSession } from "mongoose";
import { DepartmentModel } from "../../model/department.model";
import { SupplyError } from "./errors";

export async function assertRecipientDepartment(companyCode: string, name?: string, session?: ClientSession) {
  const department =
    name?.trim() &&
    (await DepartmentModel.findOne({ companyCode, name: name.trim(), isActive: true })
      .session(session || null)
      .select("name")
      .lean());
  if (!department)
    throw new SupplyError(
      "INVALID_RECIPIENT_DEPARTMENT",
      "Khoa/phòng nhận không tồn tại hoặc đã ngừng hoạt động. Vui lòng chọn lại từ danh sách.",
      409,
    );
  return department.name;
}
