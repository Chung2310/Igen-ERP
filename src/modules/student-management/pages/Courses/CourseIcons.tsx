type CourseIconName = 'duration' | 'fee' | 'learners' | 'batches';

export function CourseIcon({ name, className = 'size-4' }: { name: CourseIconName; className?: string }) {
  const artwork = {
    duration: <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18M7.5 14h2M14.5 14h2M7.5 17h2" />
    </>,
    fee: <>
      <rect x="2.5" y="6" width="19" height="13" rx="2" />
      <path d="M2.5 10h19M7 15h2M16 14.5h2.5" />
    </>,
    learners: <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2M16 5.5a3 3 0 0 1 0 5.5M17 13a5 5 0 0 1 3.5 4.8V20" />
    </>,
    batches: <>
      <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3ZM3 12l9 4.5 9-4.5M3 16l9 4.5 9-4.5" />
    </>,
  }[name];

  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{artwork}</svg>;
}
