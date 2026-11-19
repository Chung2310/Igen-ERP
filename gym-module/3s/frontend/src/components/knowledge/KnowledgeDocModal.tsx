import React, { useState, useEffect } from 'react';
import { FileText, X, Layers } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';
import type { KnowledgeDocument } from '../../types/knowledge';
import { KnowledgeTopicDropdown } from './KnowledgeTopicDropdown';
import { KNOWLEDGE_TOPICS } from './knowledgeTopics';

interface KnowledgeDocModalProps {
  isOpen: boolean;
  editingDoc: KnowledgeDocument | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const KnowledgeDocModal: React.FC<KnowledgeDocModalProps> = ({
  isOpen,
  editingDoc,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState(KNOWLEDGE_TOPICS[0].val);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingDoc) {
      setTitle(editingDoc.title || '');
      setTopic(editingDoc.topic || KNOWLEDGE_TOPICS[0].val);
      setContent(editingDoc.content || '');
    } else {
      setTitle('');
      setTopic(KNOWLEDGE_TOPICS[0].val);
      setContent('');
    }
  }, [editingDoc, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Vui lòng nhập đầy đủ tiêu đề và nội dung tài liệu.');
      return;
    }

    try {
      setSaving(true);
      if (editingDoc) {
        await api.patch(`/api/knowledge/${editingDoc._id}`, {
          title: title.trim(),
          topic,
          content: content.trim(),
        });
        toast.success('Cập nhật tài liệu tri thức thành công!');
      } else {
        await api.post('/api/knowledge', {
          title: title.trim(),
          topic,
          content: content.trim(),
        });
        toast.success('Tạo tài liệu tri thức mới thành công!');
      }
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="m-0 text-base font-extrabold text-slate-900">
                {editingDoc ? 'Chỉnh Sửa Tài Liệu Tri Thức' : 'Tạo Tài Liệu Tri Thức Mới'}
              </h3>
              <p className="m-0 text-xs text-slate-500 mt-0.5">
                {editingDoc ? 'Cập nhật tiêu đề, nội dung và chủ đề tri thức' : 'Nhập nội dung tài liệu thủ công'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1">
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tiêu đề tài liệu:
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Giới thiệu Green Ocean, Quy chuẩn tính Macro..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-xs font-semibold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 text-slate-800"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Layers size={14} className="text-sky-600" />
              Chủ đề phân loại:
            </label>
            <KnowledgeTopicDropdown
              value={topic}
              onChange={(val) => setTopic(val)}
              disabled={saving}
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nội dung tri thức:
            </label>
            <textarea
              rows={8}
              placeholder="Nhập nội dung quy chuẩn tri thức chuyên môn chi tiết..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={saving}
              className="w-full p-3 rounded-xl border border-slate-300 text-xs outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 leading-relaxed font-normal text-slate-800"
              required
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {saving ? 'Đang lưu & Tạo Vector...' : 'Lưu Tài Liệu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
