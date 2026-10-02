import { type CSSProperties, useId } from 'react'

// The OGL mark. Size is the edge length in pixels; everything else scales from it.
export function Logo({ size = 22 }: { size?: number }) {
  const id = useId()
  const fill = `${id}-fill`
  const inset = `${id}-inset`

  return (
    <span className="logo" style={{ '--logo-size': `${size}px` } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <defs>
          <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#cfdcff" />
          </linearGradient>
          <filter id={inset} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.9" floodColor="#0a1f66" floodOpacity="0.45" result="lifted" />
            <feOffset in="SourceAlpha" dy="1.3" />
            <feGaussianBlur stdDeviation="0.9" result="shifted" />
            <feComposite in="SourceAlpha" in2="shifted" operator="out" result="edge" />
            <feFlood floodColor="#1b3fae" floodOpacity="0.6" />
            <feComposite in2="edge" operator="in" result="innerShadow" />
            <feMerge>
              <feMergeNode in="lifted" />
              <feMergeNode in="innerShadow" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M9.2 6.4v11.2L18.4 12 9.2 6.4z"
          fill={`url(#${fill})`}
          stroke={`url(#${fill})`}
          strokeWidth="2.2"
          strokeLinejoin="round"
          filter={`url(#${inset})`}
        />
      </svg>
    </span>
  )
}
