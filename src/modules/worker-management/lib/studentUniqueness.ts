import { Student } from "../types";

type UniqueField = "email" | "phone" | "idCard";

const FIELD_LABELS: Record<UniqueField, string> = {
  email: "Email",
  phone: "Số điện thoại",
  idCard: "CCCD/CMND",
};

function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeDigits(value?: string) {
  return value?.replace(/\D/g, "") ?? "";
}

function normalizeValue(field: UniqueField, value?: string) {
  return field === "email" ? normalizeEmail(value) : normalizeDigits(value);
}

export function findDuplicateStudentField(
  students: Student[],
  values: Partial<Record<UniqueField, string>>,
  excludeStudentId?: string,
  businessType: string = "driving",
) {
  const fieldsToCheck: UniqueField[] = ["email", "phone", "idCard"];

  for (const field of fieldsToCheck) {
    const normalizedInput = normalizeValue(field, values[field]);
    if (!normalizedInput) continue;

    const duplicatedStudent = students.find((student) => {
      if (excludeStudentId && student.id === excludeStudentId) return false;
      return normalizeValue(field, student[field]) === normalizedInput;
    });

    if (duplicatedStudent) {
      return {
        field,
        label: FIELD_LABELS[field],
        student: duplicatedStudent,
      };
    }
  }

  return null;
}
