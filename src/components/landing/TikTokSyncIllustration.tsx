export function TikTokSyncIllustration() {
  return (
    <div className="landing-tiktok-illustration relative overflow-hidden rounded-[28px] border border-sky-100 bg-gradient-to-br from-[#e9f8ff] via-white to-[#e8f5ff] p-3 sm:p-5 shadow-[0_22px_55px_-35px_rgba(0,139,205,0.38)]">
      <svg viewBox="0 0 620 420" className="block w-full" role="img" aria-label="Minh họa đơn hàng TikTok Shop chuyển sang iGen ERP và cập nhật hàng còn bán">
        <defs>
          <linearGradient id="tiktokSyncBlue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#00ADFC" />
            <stop offset="1" stopColor="#1682EC" />
          </linearGradient>
          <filter id="tiktokSyncShadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#0579b6" floodOpacity="0.13" />
          </filter>
        </defs>

        <circle cx="100" cy="42" r="88" fill="#d7f3ff" opacity="0.55" />
        <circle cx="565" cy="370" r="105" fill="#d9eaff" opacity="0.62" />
        <path d="M270 193 H350" stroke="#a9dbf5" strokeWidth="4" strokeLinecap="round" strokeDasharray="7 10" />
        <path d="M338 181 L353 193 L338 205" fill="none" stroke="#00ADFC" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="310" cy="193" r="9" fill="#00ADFC" className="landing-tiktok-flow-dot" />
        <circle cx="310" cy="193" r="16" fill="#00ADFC" opacity="0.15" className="landing-tiktok-flow-halo" />

        <g className="landing-tiktok-card landing-tiktok-card--shop" filter="url(#tiktokSyncShadow)">
          <rect x="30" y="62" width="237" height="284" rx="22" fill="white" stroke="#d5eaf6" strokeWidth="2" />
          <rect x="30" y="62" width="237" height="64" rx="22" fill="#172139" />
          <path d="M30 106 H267 V127 H30 Z" fill="#172139" />
          <rect x="48" y="78" width="38" height="38" rx="11" fill="#263751" />
          <path d="M58 91 H76 L74 106 H60 Z M63 91 V87 A4 4 0 0 1 71 87 V91" fill="none" stroke="#67ddf7" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="98" y="102" fill="white" fontSize="20" fontWeight="700">TikTok Shop</text>
          <text x="49" y="154" fill="#42546c" fontSize="14" fontWeight="600">Đơn hàng mới</text>
          <rect x="48" y="170" width="200" height="68" rx="13" fill="#f3faff" />
          <rect x="60" y="181" width="46" height="46" rx="10" fill="#d8efff" />
          <path d="M72 196 H94 L91 215 H75 Z M78 196 V192 A5 5 0 0 1 88 192 V196" fill="#49b7ef" />
          <rect x="118" y="184" width="103" height="8" rx="4" fill="#7596b5" />
          <rect x="118" y="202" width="76" height="7" rx="3.5" fill="#c1d4e4" />
          <rect x="118" y="217" width="51" height="7" rx="3.5" fill="#d5e5ee" />
          <rect x="48" y="248" width="200" height="68" rx="13" fill="#f8fbff" stroke="#e5f0f8" />
          <rect x="60" y="259" width="46" height="46" rx="10" fill="#e6e5ff" />
          <path d="M72 278 L84 271 L96 278 V291 H72 Z" fill="#9c9bf4" />
          <rect x="118" y="264" width="91" height="8" rx="4" fill="#7596b5" />
          <rect x="118" y="282" width="66" height="7" rx="3.5" fill="#c1d4e4" />
          <rect x="118" y="297" width="80" height="7" rx="3.5" fill="#d5e5ee" />
        </g>

        <g className="landing-tiktok-card landing-tiktok-card--erp" filter="url(#tiktokSyncShadow)">
          <rect x="353" y="62" width="237" height="284" rx="22" fill="white" stroke="#c8eafa" strokeWidth="2" />
          <rect x="353" y="62" width="237" height="64" rx="22" fill="url(#tiktokSyncBlue)" />
          <path d="M353 106 H590 V127 H353 Z" fill="#168be9" />
          <rect x="371" y="78" width="38" height="38" rx="11" fill="white" opacity="0.2" />
          <path d="M380 91 H400 M380 98 H396 M380 105 H392" stroke="white" strokeWidth="3" strokeLinecap="round" />
          <text x="420" y="102" fill="white" fontSize="20" fontWeight="700">iGen ERP</text>
          <text x="372" y="154" fill="#42546c" fontSize="14" fontWeight="600">Bán hàng tập trung</text>
          <rect x="372" y="170" width="199" height="67" rx="13" fill="#eff9ff" />
          <circle cx="397" cy="203" r="16" fill="#00ADFC" />
          <path d="M390 203 L395 208 L405 197" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <text x="424" y="197" fill="#264562" fontSize="12" fontWeight="600">Đã nhận đơn</text>
          <rect x="424" y="207" width="99" height="7" rx="3.5" fill="#b9d4e7" />
          <rect x="372" y="248" width="199" height="68" rx="13" fill="#f4fbff" stroke="#d9eef9" />
          <rect x="385" y="263" width="32" height="33" rx="8" fill="#c8f3e5" />
          <path d="M392 275 L401 270 L410 275 V288 H392 Z M401 270 V288" fill="none" stroke="#19a981" strokeWidth="2" strokeLinejoin="round" />
          <text x="428" y="276" fill="#264562" fontSize="12" fontWeight="600">Hàng còn bán</text>
          <rect x="428" y="287" width="95" height="7" rx="3.5" fill="#b9d4e7" />
        </g>

        <rect x="215" y="358" width="190" height="39" rx="19.5" fill="white" stroke="#bce6fa" strokeWidth="2" />
        <circle cx="238" cy="377.5" r="7" fill="#21bd96" />
        <text x="255" y="383" fill="#2e627f" fontSize="13" fontWeight="600">Đồng bộ bán hàng</text>
      </svg>
    </div>
  );
}
