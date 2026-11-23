import { buttonClass } from "../ui";

const fileInputClass =
  "block w-full cursor-pointer text-xs text-on-surface-variant file:mr-2 file:cursor-pointer file:rounded-md file:border file:border-outline-variant file:bg-surface-container file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-on-surface hover:file:bg-surface-container-high";

export default function CatalogMediaFields({
  imageUrl,
  image,
  documents,
  onImage,
  onDocuments,
}: {
  imageUrl?: string;
  image?: File;
  documents: File[];
  onImage: (file?: File) => void;
  onDocuments: (files: File[]) => void;
}) {
  return (
    <fieldset className="space-y-2.5 rounded-lg border border-outline-variant p-3">
      <legend className="px-1 text-xs font-semibold text-on-surface-variant">
        Hình ảnh & tài liệu CO/CQ
      </legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-start gap-2.5">
          {imageUrl && (
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img
                src={imageUrl}
                alt="Ảnh vật tư hiện tại"
                className="size-12 rounded-lg border border-outline-variant object-cover"
              />
            </a>
          )}
          {!imageUrl && (
            <span className="shrink-0 self-center text-xs text-on-surface-variant">
              Chưa có ảnh
            </span>
          )}
          <label className="block min-w-0 flex-1 space-y-1 text-xs font-medium text-on-surface">
            <span>Ảnh minh họa sản phẩm</span>
            <input
              aria-label="Tải ảnh lên"
              type="file"
              accept="image/png,image/jpeg"
              className={fileInputClass}
              onChange={(event) => onImage(event.target.files?.[0])}
            />
          </label>
        </div>
        <label className="block space-y-1 text-xs font-medium text-on-surface">
          <span>Chụp ảnh</span>
          <input
            aria-label="Chụp ảnh"
            type="file"
            accept="image/*"
            capture="environment"
            className={fileInputClass}
            onChange={(event) => onImage(event.target.files?.[0])}
          />
        </label>
        <p className="text-pretty text-xs text-on-surface-variant sm:col-span-3">
          Chụp ảnh trực tiếp bằng camera hoặc tải file (JPG, PNG tối đa 5MB).
        </p>
        <label className="block space-y-1 text-xs font-medium text-on-surface">
          <span>Tài liệu chứng nhận CO/CQ, HDSD</span>
          <input
            aria-label="Đính kèm tệp"
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            className={fileInputClass}
            onChange={(event) =>
              onDocuments(Array.from(event.target.files || []))
            }
          />
        </label>
      </div>
      {!image && documents.length === 0 && (
        <p className="text-xs text-on-surface-variant">
          Chưa có tệp tài liệu nào đính kèm.
        </p>
      )}
      {(image || documents.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {image && (
            <span role="status" className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-low px-2 py-1">
              Ảnh đã chọn: {image.name}
              <button
                type="button"
                className={`${buttonClass} !min-h-6 !px-2 !py-0.5 text-xs`}
                onClick={() => onImage(undefined)}
              >
                Bỏ ảnh đã chọn
              </button>
            </span>
          )}
          {documents.map((file, index) => (
            <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-low px-2 py-1">
              {file.name}
              <button
                type="button"
                className={`${buttonClass} !min-h-6 !px-2 !py-0.5 text-xs`}
                onClick={() =>
                  onDocuments(documents.filter((_, i) => i !== index))
                }
              >
                Bỏ tệp {index + 1}
              </button>
            </span>
          ))}
        </div>
      )}
    </fieldset>
  );
}
