import type { GymRecord } from "../../../shared/gym/types";
import type { GymApi } from "./api";
import { CustomerPhotoContent } from "./CustomerPhotoManager";

export default function ProgressPhotos({
  api,
  customerId,
  photos,
  canWrite,
  onSaved,
}: {
  api: GymApi;
  customerId: string;
  photos: GymRecord[];
  canWrite: boolean;
  onSaved: () => void;
}) {
  return (
    <CustomerPhotoContent
      api={api}
      customerId={customerId}
      canWrite={canWrite}
      onChanged={onSaved}
      extraLegacyPhotos={photos.filter((p) => !p.revision)}
    />
  );
}
