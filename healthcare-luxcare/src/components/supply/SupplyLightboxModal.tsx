import React from "react";

interface Props {
  imageUrl: string | null;
  onClose: () => void;
}

export const SupplyLightboxModal: React.FC<Props> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200"
    >
      <img
        src={imageUrl}
        alt="Product zoomed"
        className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
      />
    </div>
  );
};
