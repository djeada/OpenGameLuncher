type LaunchButtonProps = {
  label: string
  kind: 'install' | 'launch' | 'cancel' | 'disabled'
  progress?: number
  onClick: () => void
}

export function LaunchButton({ label, kind, progress, onClick }: LaunchButtonProps) {
  const disabled = kind === 'disabled'
  return (
    <button
      className={kind === 'launch' ? 'launch launch-ready' : kind === 'cancel' ? 'launch launch-cancel' : 'launch'}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      {kind === 'cancel' && progress !== undefined && progress > 0 ? (
        <span className="launch-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      ) : null}
      <span className="launch-label">
        {kind === 'launch' ? <PlayIcon /> : null}
        {kind === 'launch' ? 'Play' : label}
      </span>
    </button>
  )
}

function PlayIcon() {
  return (
    <svg className="play" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 1.8v8.4l7-4.2-7-4.2z" fill="currentColor" />
    </svg>
  )
}
