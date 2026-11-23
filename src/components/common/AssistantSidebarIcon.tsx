import { useId, type SVGProps } from "react";

export type AssistantSidebarIconName =
  | "chat" | "studio" | "notebook" | "meeting" | "assistant"
  | "project" | "tools" | "agents" | "history" | "settings";

/** Filled 20 px artwork, matching the HR and Healthcare sidebar icons in proportions, gradient, and cutouts. */
export function AssistantSidebarIcon({
  name,
  active: _active,
  className = "size-5",
  ...props
}: SVGProps<SVGSVGElement> & { name: AssistantSidebarIconName; active?: boolean }) {
  const id = useId().replace(/:/g, "");
  const main = `url(#${id})`;
  const cutout = "var(--color-surface-container-lowest)";

  const studioMaskId = `${id}-studio-cut`;
  const studioSparklePath =
    "M18.6 1.5c.3-.65 1.2-.65 1.5 0l.72 1.75c.14.34.41.61.75.75l1.75.72c.65.3.65 1.2 0 1.5l-1.75.72c-.34.14-.61.41-.75.75l-.72 1.75c-.3.65-1.2.65-1.5 0l-.72-1.75a1.4 1.4 0 0 0-.75-.75l-1.75-.72c-.65-.3-.65-1.2 0-1.5l1.75-.72c.34-.14.61-.41.75-.75l.72-1.75Z";

  const shapes = {
    // Trò chuyện: Bộ sao AI lấp lánh bo tròn (không dùng khung chat)
    chat: (
      <>
        <path d="M10.4 3.1c.4-.9 1.6-.9 2 0l1.6 3.9c.3.7.9 1.3 1.6 1.6l3.9 1.6c.9.4.9 1.6 0 2l-3.9 1.6c-.7.3-1.3.9-1.6 1.6l-1.6 3.9c-.4.9-1.6.9-2 0l-1.6-3.9c-.3-.7-.9-1.3-1.6-1.6l-3.9-1.6c-.9-.4-.9-1.6 0-2l3.9-1.6c.7-.3 1.3-.9 1.6-1.6l1.6-3.9Z" />
        <path d="M18.6 15.2c.2-.5.9-.5 1.1 0l.6 1.4c.1.3.4.5.7.7l1.4.6c.5.2.5.9 0 1.1l-1.4.6c-.3.1-.5.4-.7.7l-.6 1.4c-.2.5-.9.5-1.1 0l-.6-1.4c-.1-.3-.4-.5-.7-.7l-1.4-.6c-.5-.2-.5-.9 0-1.1l1.4-.6c.3-.1.5-.4.7-.7l.6-1.4Z" />
        <circle cx="11.4" cy="11.2" r="1.4" fill={cutout} />
      </>
    ),
    // AI Studio: Khung sáng tạo đa phương tiện bo tròn tách khoảng hở rõ với ngôi sao AI
    studio: (
      <>
        <g mask={`url(#${studioMaskId})`}>
          <rect x="2.2" y="5.8" width="16" height="15.6" rx="4" />
          <circle cx="7.4" cy="11" r="1.65" fill={cutout} />
          <path
            d="M4.8 18.2c1.5-2.3 3.1-3.3 4.2-2.2l1 .95c.65.6 1.55.5 2.1-.2l1.15-1.35c.65-.75 1.7-.55 2.2.3l.7 1.35"
            fill="none"
            stroke={cutout}
            strokeWidth="1.85"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <path d={studioSparklePath} />
      </>
    ),
    // Notebook: Cuốn sổ tay bo tròn với gáy sổ và dòng ghi chú mềm
    notebook: (
      <>
        <rect x="4.2" y="2.6" width="16.2" height="18.8" rx="3.8" />
        <path
          d="M8.5 3.4v17.2"
          fill="none"
          stroke={cutout}
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <path
          d="M11.6 8.4h5.4m-5.4 3.7h5.4m-5.4 3.7h3.4"
          fill="none"
          stroke={cutout}
          strokeWidth="1.85"
          strokeLinecap="round"
        />
        <rect x="2.6" y="6.4" width="3.2" height="2" rx="1" />
        <rect x="2.6" y="11" width="3.2" height="2" rx="1" />
        <rect x="2.6" y="15.6" width="3.2" height="2" rx="1" />
      </>
    ),
    // Ghi chép cuộc họp: Micro tròn trịa cân đối kèm chân đế mềm
    meeting: (
      <>
        <rect x="8.2" y="2.5" width="7.6" height="11.6" rx="3.8" />
        <path
          d="M5.5 10.7a6.5 6.5 0 0 0 13 0M12 17.2v3.6m-3.4 0h6.8"
          fill="none"
          stroke={main}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10.5 7.2h3m-3 2.8h3"
          fill="none"
          stroke={cutout}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </>
    ),
    // Trợ lý ERP: Robot thân thiện bo tròn mềm mại với mắt cười & ăng-ten tròn
    assistant: (
      <>
        <rect x="3" y="6" width="18" height="14.2" rx="5.2" />
        <path
          d="M12 3.4v2.8"
          fill="none"
          stroke={main}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <circle cx="12" cy="3" r="1.6" />
        <rect x="6.3" y="9.4" width="11.4" height="7.2" rx="3.4" fill={cutout} />
        <circle cx="9.6" cy="12.9" r="1.35" />
        <circle cx="14.4" cy="12.9" r="1.35" />
      </>
    ),
    // Dự án: Thư mục bo tròn 2 tầng gọn gàng
    project: (
      <>
        <path d="M2.6 7A3.2 3.2 0 0 1 5.8 3.8h3.7c.9 0 1.7.4 2.2 1.1l.8 1h5.7a3.2 3.2 0 0 1 3.2 3.2v8.1a3.2 3.2 0 0 1-3.2 3.2H5.8a3.2 3.2 0 0 1-3.2-3.2V7Z" />
        <path
          d="M6.4 10.6h11.2"
          fill="none"
          stroke={cutout}
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <path
          d="M6.4 14.4h6.4"
          fill="none"
          stroke={cutout}
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </>
    ),
    // Công cụ: Lưới 4 mô-đun bo tròn (1 ô hình thoi sáng tạo)
    tools: (
      <>
        <rect x="3" y="3" width="7.8" height="7.8" rx="2.6" />
        <rect x="3" y="13.2" width="7.8" height="7.8" rx="2.6" />
        <rect x="13.2" y="13.2" width="7.8" height="7.8" rx="2.6" />
        <rect
          x="13.6"
          y="3.4"
          width="7"
          height="7"
          rx="2.2"
          transform="rotate(45 17.1 6.9)"
        />
      </>
    ),
    // Trợ lý AI: Biểu tượng trợ lý thông minh (hồ sơ tròn + ngôi sao AI)
    agents: (
      <>
        <circle cx="9.6" cy="8.2" r="3.8" />
        <path d="M2.8 19.2c0-3.3 2.9-5.4 6.8-5.4 2.2 0 4.1.7 5.3 1.9a4.4 4.4 0 0 1 1.3 3.1v.4a1.6 1.6 0 0 1-1.6 1.6H4.4a1.6 1.6 0 0 1-1.6-1.6Z" />
        <path d="M18.3 4.2c.25-.6 1.05-.6 1.3 0l.65 1.55c.12.3.36.54.66.66l1.55.65c.6.25.6 1.05 0 1.3l-1.55.65c-.3.12-.54.36-.66.66l-.65 1.55c-.25.6-1.05.6-1.3 0l-.65-1.55a1.2 1.2 0 0 0-.66-.66l-1.55-.65c-.6-.25-.6-1.05 0-1.3l1.55-.65c.3-.12.54-.36.66-.66l.65-1.55Z" />
      </>
    ),
    // Lịch sử: Đồng hồ tròn đặc đồng nhất độ dày với các icon còn lại
    history: (
      <>
        <circle cx="12" cy="12" r="9.2" />
        <path
          d="M12 7.2v5l3.3 2"
          fill="none"
          stroke={cutout}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    // Quản trị và thiết lập: Bánh răng bo tròn mềm mại 6 cánh
    settings: (
      <>
        <path d="M9.7 3.1a2.4 2.4 0 0 1 4.6 0l.4 1.3a6.8 6.8 0 0 1 1.6.9l1.3-.3a2.4 2.4 0 0 1 2.3 4l-.9 1a6.8 6.8 0 0 1 0 1.8l.9 1a2.4 2.4 0 0 1-2.3 4l-1.3-.3a6.8 6.8 0 0 1-1.6.9l-.4 1.3a2.4 2.4 0 0 1-4.6 0l-.4-1.3a6.8 6.8 0 0 1-1.6-.9l-1.3.3a2.4 2.4 0 0 1-2.3-4l.9-1a6.8 6.8 0 0 1 0-1.8l-.9-1a2.4 2.4 0 0 1 2.3-4l1.3.3a6.8 6.8 0 0 1 1.6-.9l.4-1.3Z" />
        <circle cx="12" cy="12" r="3.1" fill={cutout} />
      </>
    ),
  };

  return (
    <svg
      {...props}
      className={className}
      viewBox="0 0 24 24"
      fill={main}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#4db2fa" />
          <stop offset="48%" stopColor="#2196f3" />
          <stop offset="100%" stopColor="#1982e6" />
        </linearGradient>
        {name === "studio" && (
          <mask id={studioMaskId}>
            <rect width="24" height="24" fill="#fff" />
            <path
              d={studioSparklePath}
              fill="#000"
              stroke="#000"
              strokeWidth="3.6"
              strokeLinejoin="round"
            />
          </mask>
        )}
      </defs>
      {shapes[name]}
    </svg>
  );
}
