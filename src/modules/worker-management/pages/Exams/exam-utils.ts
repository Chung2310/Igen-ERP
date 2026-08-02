export type BusinessType = "driving" | "language" | "general";

const MOTORBIKE_LICENSE_PREFIXES = ["A1", "A2", "A3", "A4"];
const CAR_LICENSE_PREFIXES = [
  "B1",
  "B2",
  "C",
  "D",
  "E",
  "F",
  "FB",
  "FC",
  "FD",
  "FE",
];

function normalize(value?: string | null) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function getDrivingExamBucket(
  rank?: string | null,
): "motorbike" | "car" | null {
  const normalized = normalize(rank);
  if (!normalized) return null;
  if (
    MOTORBIKE_LICENSE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  )
    return "motorbike";
  if (CAR_LICENSE_PREFIXES.some((prefix) => normalized.startsWith(prefix)))
    return "car";
  return null;
}

export function getExamSegmentLabel(
  businessType: BusinessType,
  rank?: string | null,
) {
  if (businessType !== "driving") return String(rank || "").trim();
  const bucket = getDrivingExamBucket(rank);
  if (bucket === "motorbike") return "Xe máy";
  if (bucket === "car") return "Ô tô";
  return String(rank || "").trim();
}

export function isStudentEligibleForExamRank(
  businessType: BusinessType,
  examRank?: string | null,
  studentRank?: string | null,
) {
  const normalizedExamRank = normalize(examRank);
  if (!normalizedExamRank) return true;

  if (businessType !== "driving") {
    return true;
  }

  const examBucket = getDrivingExamBucket(normalizedExamRank);
  const studentBucket = getDrivingExamBucket(studentRank);

  if (!examBucket) {
    return normalize(studentRank) === normalizedExamRank;
  }

  return examBucket === studentBucket;
}
