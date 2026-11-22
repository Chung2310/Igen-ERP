import { buttonClass } from "../ui";
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
    <fieldset className="space-y-3 rounded-lg border border-outline-variant p-3">
      <legend className="px-1 text-sm font-medium">
        Hình ảnh & tài liệu đính kèm
      </legend>
      {imageUrl && (
        <a href={imageUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={imageUrl}
            alt="Ảnh vật tư hiện tại"
            className="size-24 rounded-lg object-cover"
          />
        </a>
      )}
      <label className="block space-y-1 text-sm">
        Ảnh minh họa (PNG/JPEG, tối đa 3 MB)
        <input
          aria-label="Tải ảnh vật tư"
          type="file"
          accept="image/png,image/jpeg"
          className="block w-full"
          onChange={(event) => onImage(event.target.files?.[0])}
        />
      </label>
      <label className="block space-y-1 text-sm">
        Chụp ảnh vật tư
        <input
          aria-label="Chụp ảnh vật tư"
          type="file"
          accept="image/*"
          capture="environment"
          className="block w-full"
          onChange={(event) => onImage(event.target.files?.[0])}
        />
      </label>
      {image && (
        <p role="status" className="text-sm">
          Ảnh đã chọn: {image.name}{" "}
          <button
            type="button"
            className={buttonClass}
            onClick={() => onImage(undefined)}
          >
            Bỏ ảnh đã chọn
          </button>
        </p>
      )}
      <label className="block space-y-1 text-sm">
        Tài liệu (PDF/PNG/JPEG, tối đa 3 MB/tệp)
        <input
          aria-label="Tải tài liệu vật tư"
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg"
          className="block w-full"
          onChange={(event) =>
            onDocuments(Array.from(event.target.files || []))
          }
        />
      </label>
      <ul className="space-y-1 text-sm">
        {documents.map((file, index) => (
          <li key={`${file.name}-${index}`}>
            {file.name}{" "}
            <button
              type="button"
              className={buttonClass}
              onClick={() =>
                onDocuments(documents.filter((_, i) => i !== index))
              }
            >
              Bỏ tệp {index + 1}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
