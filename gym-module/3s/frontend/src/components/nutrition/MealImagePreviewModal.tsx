import { Download, X } from 'lucide-react';

interface MealImagePreviewModalProps {
  previewImage: { url: string; title: string } | null;
  onClose: () => void;
}

export default function MealImagePreviewModal({ previewImage, onClose }: MealImagePreviewModalProps) {
  if (!previewImage) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          maxWidth: '800px',
          maxHeight: '90vh',
          background: '#0f172a',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#1e293b' }}>
          <strong style={{ color: '#ffffff', fontSize: '0.9rem' }}>{previewImage.title}</strong>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a
              href={previewImage.url}
              download={`meal_${Date.now()}.jpg`}
              style={{
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem',
                textDecoration: 'none',
                padding: '4px 8px',
                background: 'rgba(56, 189, 248, 0.1)',
                borderRadius: '6px',
              }}
            >
              <Download size={13} /> Tải ảnh
            </a>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <img
          src={previewImage.url}
          alt={previewImage.title}
          style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block' }}
        />
      </div>
    </div>
  );
}
