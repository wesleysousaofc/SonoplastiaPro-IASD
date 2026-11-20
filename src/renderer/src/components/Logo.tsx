export function Logo({ size = 34 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="spa-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14c9a3" />
          <stop offset="1" stopColor="#4ade80" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="#0f1a2e" />
      <rect x="1.5" y="1.5" width="61" height="61" rx="16.5" fill="none" stroke="url(#spa-g)" strokeWidth="3" />
      <path d="M26 20 L26 44 L45 32 Z" fill="url(#spa-g)" />
      <rect x="12" y="26" width="4" height="12" rx="2" fill="#7dd3fc" />
      <rect x="18" y="22" width="4" height="20" rx="2" fill="#7dd3fc" opacity=".8" />
    </svg>
  )
}
