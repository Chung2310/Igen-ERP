import { useState, type ChangeEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { errorMessage } from '../../types';
import { useToast } from '../ui/ToastProvider';

export interface ExerciseVideo {
  title: string;
  url: string;
  source: 'UPLOAD' | 'LINK';
}

interface ExerciseVideoFieldsProps {
  videos: ExerciseVideo[];
  onChange: (videos: ExerciseVideo[]) => void;
  onUploadingChange: (uploading: boolean) => void;
}

const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export default function ExerciseVideoFields({ videos, onChange, onUploadingChange }: ExerciseVideoFieldsProps) {
  const toast = useToast();
  const [uploadingIndexes, setUploadingIndexes] = useState<number[]>([]);

  const setUploading = (index: number, uploading: boolean) => {
    setUploadingIndexes((current) => {
      const next = uploading ? [...new Set([...current, index])] : current.filter((item) => item !== index);
      onUploadingChange(next.length > 0);
      return next;
    });
  };
  const update = (index: number, patch: Partial<ExerciseVideo>) => onChange(videos.map((video, itemIndex) => itemIndex === index ? { ...video, ...patch } : video));
  const remove = (index: number) => {
    setUploadingIndexes((current) => {
      const next = current.filter((item) => item !== index).map((item) => item > index ? item - 1 : item);
      onUploadingChange(next.length > 0);
      return next;
    });
    onChange(videos.filter((_, itemIndex) => itemIndex !== index));
  };
  const upload = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!VIDEO_TYPES.includes(file.type)) { toast.error('Chỉ hỗ trợ video MP4, WebM hoặc MOV.'); event.target.value = ''; return; }
    if (file.size > MAX_VIDEO_SIZE) { toast.error('Video không được vượt quá 100 MB.'); event.target.value = ''; return; }
    const formData = new FormData();
    formData.append('video', file);
    setUploading(index, true);
    try {
      const result = await api.upload<{ url: string; publicId: string }>('/api/upload/video', formData);
      update(index, { url: result.data.url });
      toast.success(result.message);
    } catch (error) {
      update(index, { url: '' });
      toast.error(errorMessage(error));
    } finally {
      setUploading(index, false);
    }
  };

  return <section className="exercise-form-section exercise-form-videos" aria-labelledby="exercise-form-videos">
    <div className="exercise-form-section-heading exercise-video-heading">
      <div><strong>Video hướng dẫn</strong></div>
      <button type="button" className="button button-secondary" disabled={videos.length >= 20} onClick={() => onChange([...videos, { title: '', url: '', source: 'LINK' }])}><Plus size={16} /> Thêm video</button>
    </div>
    <span id="exercise-form-videos" className="sr-only">Video hướng dẫn</span>
    {videos.map((video, index) => <article className="exercise-video-item" key={index}>
      <div className="module-field-grid">
        <label className="module-field"><span>Tiêu đề video {index + 1}</span><input aria-label={`Tiêu đề video ${index + 1}`} placeholder="Ví dụ: Kỹ thuật chuẩn" maxLength={120} value={video.title} onChange={(event) => update(index, { title: event.target.value })} required /></label>
        <label className="module-field"><span>Nguồn video {index + 1}</span><select aria-label={`Nguồn video ${index + 1}`} value={video.source} onChange={(event) => update(index, { source: event.target.value as ExerciseVideo['source'], url: '' })}><option value="LINK">Điền liên kết</option><option value="UPLOAD">Tải video lên</option></select></label>
        {video.source === 'LINK'
          ? <label className="module-field exercise-video-wide"><span>Link video {index + 1}</span><input aria-label={`Link video ${index + 1}`} type="url" placeholder="https://youtube.com/..." value={video.url} onChange={(event) => update(index, { url: event.target.value })} required /></label>
          : <label className="module-field exercise-video-wide"><span>Tệp video {index + 1}</span><input aria-label={`Tệp video ${index + 1}`} type="file" accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime" onChange={(event) => void upload(index, event)} required={!video.url} />{uploadingIndexes.includes(index) && <small className="exercise-upload-state">Đang tải video...</small>}{video.url && <a className="exercise-video-link" href={video.url} target="_blank" rel="noopener noreferrer">Xem video đã tải</a>}</label>}
      </div>
      <button type="button" className="exercise-video-remove" onClick={() => remove(index)}><Trash2 size={15} aria-hidden="true" /> Xóa video</button>
    </article>)}
  </section>;
}
