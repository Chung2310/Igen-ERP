import React, { useState } from 'react';
import { useMealImageFallback } from '../hooks/useMealImageFallback';

export interface MealDish { id: number; title: string; image?: string | null; leftPills?: Array<{ label: string; weight: string }>; rightPills?: Array<{ label: string; val: string; highlight?: boolean }> }
interface DishImageProps { src?: string | null; alt: string }
interface MealInfographicPosterProps { titleTag?: string; subTitle?: string; timeframeText?: string; dishes?: MealDish[] }

const DishImage = ({ src, alt }: DishImageProps) => {
  const { imageSrc, failed, onImageError } = useMealImageFallback(src, alt);
  const [loadedSrc, setLoadedSrc] = useState<string>();
  const loaded = imageSrc && loadedSrc === imageSrc;
  return (
    <div className="relative h-full w-full bg-sky-50">
      {!loaded && (
        <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
          {!failed && <div className="h-7 w-7 animate-spin rounded-full border-2 border-sky-100 border-t-secondary motion-reduce:animate-none" />}
          <span>{failed ? 'Không tải được ảnh' : 'Đang tải ảnh...'}</span>
        </div>
      )}
      {imageSrc && !failed && <img
        src={imageSrc}
        alt={alt}
        onLoad={() => setLoadedSrc(imageSrc)}
        onError={onImageError}
        className={`h-full w-full object-cover transition-opacity motion-reduce:transition-none ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />}
    </div>
  );
};

const MealInfographicPoster = ({ titleTag = "Bữa Ăn Khoa Học - Dễ Chế Biến", subTitle = "Thực Đơn Dinh Dưỡng Cân Bằng", timeframeText = "Lộ Trình 1 Ngày", dishes = [] }: MealInfographicPosterProps) => {
  const defaultDishes = [
    {
      id: 1,
      title: "Bữa Trưa: Ức Gà Luộc + Cơm Gạo Lứt + Bông Cải",
      image: null,
      leftPills: [{ label: "Ức Gà Luộc", weight: "180g" }, { label: "Cơm Gạo Lứt", weight: "150g" }, { label: "Bông Cải Xanh", weight: "100g" }],
      rightPills: [{ label: "Tổng Calo", val: "520 Kcal", highlight: true }, { label: "Protein", val: "48g" }, { label: "Quy Mô Bữa", val: "3 Món Kết hợp" }]
    }
  ];

  const activeDishes = dishes && dishes.length > 0 ? dishes : defaultDishes;

  return (
    <div style={{
      background: '#fcfbfa',
      border: '2px solid #003b70',
      borderRadius: '24px',
      padding: '32px 24px',
      width: '100%',
      maxWidth: '100%',
      margin: '0 auto',
      boxShadow: '0 12px 36px rgba(0, 59, 112, 0.12)',
      fontFamily: "'Montserrat', sans-serif"
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Poster Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ display: 'inline-block', background: 'linear-gradient(135deg, #003b70, #00a4e4)', color: '#fff', borderRadius: '20px', padding: '6px 20px', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '10px' }}>
          {titleTag}
        </div>
        <h2 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.6rem)', fontWeight: 900, color: '#003b70', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 4px 0', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
          {subTitle}
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#00a4e4', fontWeight: 700, margin: 0 }}>
          {timeframeText} • 3S WELLNESS FITNESS & YOGA
        </p>
      </div>

      {/* Dishes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {activeDishes.map((dish) => (
          <div key={dish.id} style={{ background: 'linear-gradient(135deg, #f8fbff, #ffffff)', border: '1.5px solid rgba(0, 164, 228, 0.3)', borderRadius: '18px', padding: '24px 16px' }}>
            {/* Meal title badge */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <span style={{ background: 'linear-gradient(135deg, #003b70, #00a4e4)', color: '#fff', padding: '6px 20px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.02em' }}>
                {dish.title}
              </span>
            </div>

            {/* Three-column layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 190px 1fr', alignItems: 'center', gap: '12px' }}>
              {/* Left Pills */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                {dish.leftPills?.map((pill, pIdx) => (
                  <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: '#ffffff', border: '1.5px solid #00a4e4', borderRadius: '12px', padding: '7px 14px', fontSize: '0.78rem', fontWeight: 800, color: '#003b70', boxShadow: '0 2px 8px rgba(0, 164, 228, 0.12)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00a4e4', display: 'inline-block' }}></span>
                      {pill.label} <span style={{ color: '#00a4e4', fontWeight: 900 }}>({pill.weight})</span>
                    </div>
                    <svg width="28" height="14" viewBox="0 0 28 14" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M0 7H24M24 7L17 1.5M24 7L17 12.5" stroke="#00a4e4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                ))}
              </div>

              {/* Center: AI image circle */}
              <div style={{ width: '190px', height: '190px', borderRadius: '50%', overflow: 'hidden', border: '4px solid #ffffff', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)', margin: '0 auto', position: 'relative' }}>
                <DishImage src={dish.image} alt={dish.title} />
              </div>

              {/* Right Pills */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
                {dish.rightPills?.map((pill, pIdx) => (
                  <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="28" height="14" viewBox="0 0 28 14" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M28 7H4M4 7L11 1.5M4 7L11 12.5" stroke={pill.highlight ? "#003b70" : "#00a4e4"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div style={{ background: pill.highlight ? '#e0f2fe' : '#ffffff', border: pill.highlight ? '2px solid #00a4e4' : '1.5px solid #cbd5e1', borderRadius: '12px', padding: '8px 16px', fontSize: '0.85rem', fontWeight: 800, color: pill.highlight ? '#003b70' : '#1e293b', boxShadow: pill.highlight ? '0 4px 12px rgba(0, 164, 228, 0.2)' : '0 2px 8px rgba(0,0,0,0.04)', whiteSpace: 'nowrap' }}>
                      {pill.label}: <span style={{ color: pill.highlight ? '#003b70' : '#00a4e4', fontWeight: 800 }}>{pill.val}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
        *Ảnh được tạo bởi AI dựa trên thực đơn tư vấn thực tế. Ngày 1 sinh nhanh, các ngày tiếp theo tải dần.
      </div>
    </div>
  );
};

export default MealInfographicPoster;
