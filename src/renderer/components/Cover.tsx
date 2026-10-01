import { useState } from 'react'

type CoverProps = {
  src?: string
  accent: string
  className?: string
}

export function Cover({ src, accent, className = '' }: CoverProps) {
  const [loaded, setLoaded] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const usable = src && failed !== src
  return (
    <span className={`cover ${className}`} style={{ background: `linear-gradient(135deg, ${accent}, #0b0e14 80%)` }}>
      {usable ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className={loaded === src ? 'cover-img loaded' : 'cover-img'}
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
        />
      ) : null}
    </span>
  )
}
