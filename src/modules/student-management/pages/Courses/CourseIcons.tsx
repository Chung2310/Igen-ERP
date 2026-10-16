type CourseIconName = 'duration' | 'fee' | 'learners' | 'batches';

export function CourseIcon({ name, className = 'h-4 w-4' }: { name: CourseIconName; className?: string }) {
  const artwork = {
    duration: <>
      <rect x="3" y="4" width="18" height="17" rx="4" fill="#D9F3FF" />
      <path d="M3 9h18V8a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1Z" fill="#00ADFC" />
      <path d="M8 3v3M16 3v3" stroke="#007EB8" strokeWidth="2" strokeLinecap="round" />
      <rect x="7" y="12" width="4" height="3" rx="1" fill="#55C9FF" />
      <rect x="13" y="12" width="4" height="3" rx="1" fill="#9DE2FF" />
      <rect x="7" y="17" width="4" height="2" rx="1" fill="#9DE2FF" />
    </>,
    fee: <>
      <rect x="3" y="6" width="17" height="13" rx="3" fill="#BCEBFF" />
      <path d="M3 10h17v6H3z" fill="#55C9FF" />
      <circle cx="11.5" cy="13" r="3.2" fill="#E8F8FF" />
      <path d="M10.5 12h1.5a1 1 0 0 1 0 2h-1.5M11.5 11v4" stroke="#007EB8" strokeWidth="1" strokeLinecap="round" />
      <path d="M6 4h12" stroke="#00ADFC" strokeWidth="2" strokeLinecap="round" />
    </>,
    learners: <>
      <circle cx="9" cy="8" r="3.3" fill="#55C9FF" />
      <circle cx="17" cy="9" r="2.7" fill="#A9E5FF" />
      <path d="M3 19v-2.3A4.7 4.7 0 0 1 7.7 12h2.6a4.7 4.7 0 0 1 4.7 4.7V19H3Z" fill="#00ADFC" />
      <path d="M16 13h1.1A3.9 3.9 0 0 1 21 16.9V19h-4.5v-2.3a6 6 0 0 0-.5-2.4V13Z" fill="#86D9FF" />
      <path d="M6.5 16.5h5" stroke="#E8F8FF" strokeWidth="1.5" strokeLinecap="round" />
    </>,
    batches: <>
      <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" fill="#55C9FF" />
      <path d="m3 11 9 4.5 9-4.5" fill="none" stroke="#00ADFC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m3 15 9 4.5 9-4.5" fill="none" stroke="#8DDCFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 7.5 3 1.5 3-1.5" fill="none" stroke="#FFF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </>,
  }[name];

  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">{artwork}</svg>;
}
