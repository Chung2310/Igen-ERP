import React from 'react';
import { StyledSelect } from '../../../../../components/common/StyledSelect';
import { VIDEO_DURATION_OPTIONS, VIDEO_MODEL_OPTIONS, VIDEO_QUALITY_OPTIONS } from './video-generation.constants';

interface VeoSettingsPanelProps {
  videoModel: string;
  videoAspectRatio: string;
  videoDuration: string;
  videoQuality: string;
  onVideoModelChange: (value: string) => void;
  onAspectRatioChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onQualityChange: (value: string) => void;
}

const ASPECT_RATIO_OPTIONS = [
  { value: '16:9', label: '16:9 · Ngang' },
  { value: '9:16', label: '9:16 · Dọc' },
];

export function VeoSettingsPanel(props: VeoSettingsPanelProps) {
  const {
    videoModel,
    videoAspectRatio,
    videoDuration,
    videoQuality,
    onVideoModelChange,
    onAspectRatioChange,
    onDurationChange,
    onQualityChange,
  } = props;

  return (
    <div className="flex flex-col gap-3.5 border-t border-outline-variant pt-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-surface">Mô hình tạo video</span>
        <StyledSelect
          appearance="erp"
          ariaLabel="Mô hình tạo video"
          value={videoModel}
          onChange={onVideoModelChange}
          options={[...VIDEO_MODEL_OPTIONS]}
          className="h-10 rounded-md"
          menuClassName="rounded-md [&_[role=option]]:rounded-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-surface">Khung hình</span>
          <StyledSelect
            appearance="erp"
            ariaLabel="Khung hình"
            value={videoAspectRatio}
            onChange={onAspectRatioChange}
            options={ASPECT_RATIO_OPTIONS}
            className="h-10 rounded-md"
            menuClassName="rounded-md [&_[role=option]]:rounded-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-on-surface">Thời lượng</span>
          <StyledSelect
            appearance="erp"
            ariaLabel="Thời lượng"
            value={videoDuration}
            onChange={onDurationChange}
            options={[...VIDEO_DURATION_OPTIONS]}
            className="h-10 rounded-md"
            menuClassName="rounded-md [&_[role=option]]:rounded-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-on-surface">Độ phân giải</span>
        <div role="group" aria-label="Độ phân giải" className="grid grid-cols-2 gap-2">
          {VIDEO_QUALITY_OPTIONS.map((option) => {
            const isSelected = videoQuality === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onQualityChange(option.value)}
                className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium tabular-nums transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                {option.value}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
