import { useEffect, useState } from 'react'
import { Logo } from './Logo'

const minimumMs = 1100
const leaveMs = 450

// Covers the window until the library is ready, then fades out.
export function Splash({ ready }: { ready: boolean }) {
  const [held, setHeld] = useState(true)
  const [gone, setGone] = useState(false)
  const leaving = ready && !held

  useEffect(() => {
    const timer = setTimeout(() => setHeld(false), minimumMs)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => setGone(true), leaveMs)
    return () => clearTimeout(timer)
  }, [leaving])

  if (gone) return null

  return (
    <div className={leaving ? 'splash leaving' : 'splash'} role="status" aria-label="Loading OGL">
      <div className="splash-glow" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="splash-center">
        <span className="splash-logo">
          <Logo size={76} />
        </span>
        <strong>OGL</strong>
        <p>Loading the library</p>
        <span className="splash-bar" aria-hidden="true" />
      </div>
    </div>
  )
}
