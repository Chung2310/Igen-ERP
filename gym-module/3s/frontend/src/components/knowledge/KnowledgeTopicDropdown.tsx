import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { KNOWLEDGE_TOPICS, type KnowledgeTopicDef } from './knowledgeTopics';

interface KnowledgeTopicDropdownProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

export const KnowledgeTopicDropdown: React.FC<KnowledgeTopicDropdownProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedTopic: KnowledgeTopicDef =
    KNOWLEDGE_TOPICS.find((t) => t.val === value) || KNOWLEDGE_TOPICS[0];

  const filteredTopics = KNOWLEDGE_TOPICS.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.label.toLowerCase().includes(q) || t.shortLabel.toLowerCase().includes(q);
  });

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* TRIGGER BUTTON (TỐI GIẢN, KHÔNG ICON, KHÔNG DESCRIPTION) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full py-2.5 px-3.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer bg-white ${
          isOpen
            ? 'border-sky-500 ring-2 ring-sky-100 shadow-xs'
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="text-xs font-semibold text-slate-800 truncate">
          {selectedTopic.label}
        </span>

        <ChevronDown
          size={16}
          className={`text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-sky-600' : ''
          }`}
        />
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* SEARCH BOX GỌN GÀNG */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm chủ đề..."
                className="w-full py-1.5 pl-8 pr-3 text-xs bg-white rounded-lg border border-slate-200 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* LIST ITEMS (THUẦN TÊN CHỦ ĐỀ) */}
          <div className="max-h-64 overflow-y-auto p-1.5 flex flex-col gap-0.5">
            {filteredTopics.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                Không tìm thấy chủ đề phù hợp
              </div>
            ) : (
              filteredTopics.map((topic) => {
                const isSelected = topic.val === value;
                return (
                  <button
                    key={topic.val}
                    type="button"
                    onClick={() => {
                      onChange(topic.val);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full py-2 px-3 rounded-lg text-left flex items-center justify-between gap-2 transition-colors cursor-pointer border-none text-xs ${
                      isSelected
                        ? 'bg-sky-50 text-sky-700 font-bold'
                        : 'bg-transparent hover:bg-slate-100 text-slate-700 font-medium'
                    }`}
                  >
                    <span className="truncate">{topic.label}</span>
                    {isSelected && <Check size={14} className="text-sky-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
