type CourseIconName = 'duration' | 'fee' | 'learners' | 'batches' | 'pause' | 'play' | 'view' | 'edit' | 'delete';

export function CourseIcon({ name, className = 'h-4 w-4' }: { name: CourseIconName; className?: string }) {
  const artwork = {
    duration: <>
      <rect x="3" y="4" width="18" height="17" rx="4" fill="#FFE0C2" />
      <path d="M3 9h18V8a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1Z" fill="#FF985D" />
      <path d="M8 3v3M16 3v3" stroke="#C85A38" strokeWidth="2" strokeLinecap="round" />
      <rect x="7" y="12" width="4" height="3" rx="1" fill="#FF985D" />
      <rect x="13" y="12" width="4" height="3" rx="1" fill="#FFC46E" />
      <rect x="7" y="17" width="4" height="2" rx="1" fill="#FFC46E" />
    </>,
    fee: <>
      <rect x="3" y="6" width="17" height="13" rx="3" fill="#9AE9CA" />
      <path d="M3 10h17v6H3z" fill="#36C99A" />
      <circle cx="11.5" cy="13" r="3.2" fill="#FFF1AB" />
      <path d="M10.5 12h1.5a1 1 0 0 1 0 2h-1.5M11.5 11v4" stroke="#B6821E" strokeWidth="1" strokeLinecap="round" />
      <path d="M6 4h12" stroke="#45B98E" strokeWidth="2" strokeLinecap="round" />
    </>,
    learners: <>
      <circle cx="9" cy="8" r="3.3" fill="#AA84F7" />
      <circle cx="17" cy="9" r="2.7" fill="#FFB780" />
      <path d="M3 19v-2.3A4.7 4.7 0 0 1 7.7 12h2.6a4.7 4.7 0 0 1 4.7 4.7V19H3Z" fill="#8664E8" />
      <path d="M16 13h1.1A3.9 3.9 0 0 1 21 16.9V19h-4.5v-2.3a6 6 0 0 0-.5-2.4V13Z" fill="#FF9F72" />
      <path d="M6.5 16.5h5" stroke="#E6DFFF" strokeWidth="1.5" strokeLinecap="round" />
    </>,
    batches: <>
      <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" fill="#8CDAFF" />
      <path d="m3 11 9 4.5 9-4.5" fill="none" stroke="#56BEEB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m3 15 9 4.5 9-4.5" fill="none" stroke="#9275E8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 7.5 3 1.5 3-1.5" fill="none" stroke="#FFF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </>,
    pause: <>
      <rect x="2" y="2" width="20" height="20" rx="7" fill="#FFF0C8" />
      <rect x="7" y="6" width="3.5" height="12" rx="1.5" fill="#EF9D22" />
      <rect x="13.5" y="6" width="3.5" height="12" rx="1.5" fill="#F7BC57" />
    </>,
    play: <>
      <rect x="2" y="2" width="20" height="20" rx="7" fill="#D6F8D6" />
      <path d="M9 6.5a1 1 0 0 1 1.5-.86l8 5.5a1 1 0 0 1 0 1.72l-8 5.5A1 1 0 0 1 9 17.5v-11Z" fill="#31B86E" />
      <path d="m11 9 4 3-4 3" fill="none" stroke="#80DE9F" strokeWidth="1.2" strokeLinecap="round" />
    </>,
    view: <>
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" fill="#DCCBFF" stroke="#9976E9" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3.7" fill="#9B78EB" />
      <circle cx="12" cy="12" r="1.6" fill="#FFF" />
      <circle cx="13" cy="11" r=".75" fill="#FFBC66" />
    </>,
    edit: <>
      <rect x="3" y="3" width="14" height="17" rx="3" fill="#FFE7C8" />
      <path d="M6 8h8M6 11h5" stroke="#E9AA58" strokeWidth="1.6" strokeLinecap="round" />
      <path d="m10 18 7.8-8 2.4 2.4-7.8 8-3 .6.6-3Z" fill="#FF9A54" stroke="#D56B3C" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="m17.8 10 1-1a1.7 1.7 0 0 1 2.4 2.4l-1 1" fill="#FFD27C" />
    </>,
    delete: <>
      <rect x="5" y="7" width="14" height="14" rx="3" fill="#FFC5CB" />
      <path d="M4 7h16M9 4h6" stroke="#E96777" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" stroke="#D94D65" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5" fill="none" stroke="#E96777" strokeWidth="1.4" />
    </>,
  }[name];

  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">{artwork}</svg>;
}
