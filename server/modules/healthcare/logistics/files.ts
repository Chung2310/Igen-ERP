import { Router, type RequestHandler } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { requirePermission } from "../../../middleware/auth";
import { route } from "./http";
import { collection, scope, atomic, base } from "./store";
import {
  input,
  equipmentInput,
  supplyInput,
  attachmentInput,
} from "./validation";
import { ValidationError } from "../../../errors/app-error";
import type {
  Equipment,
  Supply,
} from "../../../../shared/healthcare-logistics";
import { cloudinaryService } from "../../../service/cloudinary.service";
import { find, replace } from "./store";
import { listSupplies } from "./supply-read";

export const filesRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
});
const columns = {
  equipment: [
    "quantity",
    "imageUrl",
    "purchaseDay",
    "usageStartDay",
    "riskClassification",
    "inspectionCycleMonths",
    "nextInspectionDay",
    "code",
    "name",
    "category",
    "manufacturer",
    "modelNumber",
    "serialNumber",
    "originCountry",
    "location",
    "notes",
  ],
  supplies: [
    "code",
    "name",
    "category",
    "unit",
    "minQuantity",
    "requiresExpiry",
    "notes",
  ],
};
for (const kind of ["equipment", "supplies"] as const) {
  filesRouter.post(
    `/files/${kind}/:id/attachment`,
    requirePermission("healthcare:manage") as RequestHandler,
    upload.single("file"),
    route(async (req, res, db, actor) => {
      const record = await find(db, kind, actor, String(req.params.id));
      const file = req.file;
      if (
        !file ||
        (req.body?.image !== "true" &&
          req.body?.report !== "true" &&
          record.documents.length >= 30)
      )
        throw new ValidationError(
          "VALIDATION_FAILED",
          "Chọn tệp tối đa 3 MB, mỗi bản ghi tối đa 30 tài liệu.",
        );
      const signature = file.buffer.subarray(0, 8).toString("hex");
      const mime = signature.startsWith("25504446")
        ? "application/pdf"
        : signature.startsWith("89504e470d0a1a0a")
          ? "image/png"
          : signature.startsWith("ffd8ff")
            ? "image/jpeg"
            : "";
      if (!mime)
        throw new ValidationError(
          "VALIDATION_FAILED",
          "Chỉ nhận tài liệu PDF, ảnh PNG hoặc JPEG.",
        );
      const image = req.body?.image === "true";
      const report = req.body?.report === "true";
      let metadata:
        | {
            name: string;
            type?: string;
            number?: string;
            authority?: string;
            issuedDay?: string;
            expiryDay?: string;
            notes?: string;
          }
        | undefined;
      if (req.body?.metadata) {
        try {
          metadata = input(
            attachmentInput,
            JSON.parse(String(req.body.metadata)),
          );
        } catch {
          throw new ValidationError(
            "VALIDATION_FAILED",
            "Thông tin hồ sơ đính kèm chưa hợp lệ.",
          );
        }
      }
      if (image && mime === "application/pdf")
        throw new ValidationError(
          "VALIDATION_FAILED",
          "Ảnh đại diện phải là PNG hoặc JPEG.",
        );
      const asset = await cloudinaryService.uploadMediaAsset(
        `data:${mime};base64,${file.buffer.toString("base64")}`,
        `healthcare/${actor.companyCode}/${actor.branchId}/${kind}/${record._id}`,
      );
      try {
        const result = await replace(
          db,
          kind,
          actor,
          {
            ...record,
            ...(image ? { imageUrl: asset.secureUrl } : {}),
            ...(report && kind === "equipment"
              ? { lastInspectionReportUrl: asset.secureUrl }
              : {}),
            documents:
              image || report
                ? record.documents
                : [
                    ...record.documents,
                    {
                      ...metadata,
                      name: metadata?.name || file.originalname.slice(0, 200),
                      url: asset.secureUrl,
                    },
                  ],
          },
          record.revision,
        );
        res.json({ documents: result.documents, revision: result.revision });
      } catch (error) {
        await cloudinaryService
          .deletePublicMedia(asset.publicId, asset.resourceType)
          .catch(() => undefined);
        throw error;
      }
    }),
  );
  filesRouter.get(
    `/files/${kind}/export`,
    requirePermission("healthcare:read") as RequestHandler,
    route(async (req, res, db, actor) => {
      const rows =
        req.query.template === "true"
          ? []
          : kind === "supplies"
            ? (
                await listSupplies(db, actor, {
                  page: 1,
                  pageSize: 10001,
                  q: "",
                  active: "all",
                })
              ).items
            : await db
                .collection(`healthcare_${kind}`)
                .find({ ...scope(actor), deletedAt: { $exists: false } })
                .limit(10001)
                .toArray();
      if (rows.length > 10000)
        throw new ValidationError(
          "VALIDATION_FAILED",
          "Chỉ xuất tối đa 10.000 bản ghi mỗi lần.",
        );
      const sheet = XLSX.utils.json_to_sheet(
        rows.map((row) =>
          Object.fromEntries(
            [
              ...columns[kind],
              ...(kind === "supplies" ? ["quantity", "stockValue"] : []),
            ].map((key) => [
              key,
              key === "quantity" && kind === "equipment" ? 1 : (row[key] ?? ""),
            ]),
          ),
        ),
        { header: columns[kind] },
      );
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Danh sach");
      res
        .type(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .attachment(`${kind}.xlsx`)
        .send(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
    }),
  );
  filesRouter.post(
    `/files/${kind}/import`,
    requirePermission("healthcare:manage") as RequestHandler,
    upload.single("file"),
    route(async (req, res, db, actor) => {
      if (!req.file || !/\.(xlsx|csv)$/i.test(req.file.originalname))
        throw new ValidationError(
          "VALIDATION_FAILED",
          "Chọn file XLSX hoặc CSV.",
        );
      const book = XLSX.read(req.file.buffer, {
        type: "buffer",
        sheetRows: 502,
      });
      const sheet = book.Sheets[book.SheetNames[0]];
      if (!sheet)
        throw new ValidationError(
          "VALIDATION_FAILED",
          "File không có trang dữ liệu.",
        );
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      if (!raw.length || raw.length > 500)
        throw new ValidationError(
          "VALIDATION_FAILED",
          "Mỗi lần nhập từ 1 đến 500 dòng.",
        );
      const rows = raw.flatMap((row, index) => {
        try {
          const count = kind === "equipment" ? Number(row.quantity || 1) : 1;
          if (!Number.isInteger(count) || count < 1 || count > 500)
            throw new Error("quantity");
          const data = input<Equipment & Supply>(
            kind === "equipment" ? equipmentInput : supplyInput,
            Object.fromEntries(
              Object.entries(row).filter(
                ([key, value]) =>
                  key !== "quantity" &&
                  columns[kind].includes(key) &&
                  value !== "",
              ),
            ),
          );
          return Array.from({ length: count }, (_, i) => ({
            ...data,
            code:
              count === 1
                ? data.code
                : `${data.code}-${String(i + 1).padStart(3, "0")}`,
          }));
        } catch {
          throw new ValidationError(
            "VALIDATION_FAILED",
            `Dòng ${index + 2} chưa hợp lệ. Kiểm tra mã, tên và đơn vị.`,
            {
              fields: [String(index + 2)],
            },
          );
        }
      });
      if (rows.length > 500)
        throw new ValidationError(
          "VALIDATION_FAILED",
          "Tổng số thiết bị sau khi tách số lượng không được vượt 500.",
        );
      await atomic(async (session) => {
        for (const row of rows)
          await collection(db, kind).insertOne(
            { ...row, ...base(actor) },
            { session },
          );
      });
      res.status(201).json({ imported: rows.length });
    }),
  );
}
filesRouter.get(
  "/files/documents/export",
  requirePermission("healthcare:read") as RequestHandler,
  route(async (_req, res, db, actor) => {
    const docs = await collection(db, "supply_documents")
      .find(scope(actor))
      .limit(10001)
      .toArray();
    if (docs.length > 10000)
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Chỉ xuất tối đa 10.000 phiếu mỗi lần.",
      );
    const [supplies, warehouses] = await Promise.all([
      collection(db, "supplies").find(scope(actor)).toArray(),
      db.collection("warehouses").find(scope(actor)).toArray(),
    ]);
    const names = new Map(supplies.map((x) => [x._id, x])),
      stores = new Map(warehouses.map((x) => [String(x._id), x.name]));
    const rows = docs.flatMap((doc) =>
      doc.lines.map((line) => ({
        Ngày: doc.createdAt,
        Loại: doc.type,
        "Trạng thái": doc.status,
        Kho: stores.get(doc.warehouseId) || "",
        "Mã vật tư": names.get(line.supplyId)?.code || "",
        "Vật tư": names.get(line.supplyId)?.name || "",
        "Số lượng": line.quantity,
        "Đơn vị": line.unit || names.get(line.supplyId)?.unit || "",
        Lô: line.lot,
        "Hạn dùng": line.expiryDay,
        "Giá trị khai báo": line.value,
        "Lý do": doc.reason,
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(rows),
      "Nhap xuat kho",
    );
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment("nhap-xuat-kho.xlsx")
      .send(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
  }),
);
