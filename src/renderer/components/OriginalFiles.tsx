import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { formatBytes } from '../../shared/labels'
import { isSteamCode, isSteamName } from '../../shared/originals'
import type { Game, OriginalProgress } from '../../shared/types'

type OriginalFilesProps = {
  game: Game
  onClose: () => void
}

const STATUS: Record<OriginalProgress['phase'], string> = {
  preparing: 'Getting SteamCMD ready',
  'signing-in': 'Signing in to Steam',
  code: 'Steam sent you a Steam Guard code',
  confirm: 'Confirm the sign-in in the Steam app on your phone',
  checking: 'Checking the files',
  downloading: 'Downloading'
}

export function OriginalFiles({ game, onClose }: OriginalFilesProps) {
  const original = game.requires?.name ?? 'the original game'
  const [installed, setInstalled] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [progress, setProgress] = useState<OriginalProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    let cancel = false
    window.ogl.getOriginal(game.id).then(
      (state) => {
        if (cancel) return
        setInstalled(state.installed)
        setUsername((current) => current || state.username)
      },
      (problem: unknown) => !cancel && setError(errorText(problem))
    )
    const off = window.ogl.onOriginalProgress((event) => event.gameId === game.id && setProgress(event))
    return () => {
      cancel = true
      off()
    }
  }, [game.id])

  // While SteamCMD runs the window stays, so the player sees a code prompt or an error.
  const close = () => !busy && onClose()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const name = username.trim()
  const nameOk = isSteamName(name)

  async function download(event: FormEvent) {
    event.preventDefault()
    if (!nameOk || busy) return
    setBusy(true)
    setError(null)
    setNote(null)
    setProgress(null)
    try {
      await window.ogl.fetchOriginal(game.id, name, password)
      setInstalled(true)
    } catch (problem) {
      const message = errorText(problem)
      if (message !== 'Cancelled') setError(message)
    } finally {
      setPassword('')
      setCode('')
      setBusy(false)
      setProgress(null)
    }
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault()
    if (!isSteamCode(code.trim())) return
    try {
      await window.ogl.sendOriginalCode(code.trim())
      setCode('')
      setProgress((current) => (current ? { ...current, phase: 'signing-in' } : current))
    } catch (problem) {
      setError(errorText(problem))
    }
  }

  async function terminal() {
    setError(null)
    setNote(null)
    try {
      await window.ogl.signInOriginal(name)
      setNote('Sign in there, then press Download here.')
    } catch (problem) {
      setError(errorText(problem))
    }
  }

  const percent = progress && progress.total > 0 ? progress.received / progress.total : 0

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Original files from Steam" onClick={close}>
      <div className="original" style={{ '--accent': game.accent } as CSSProperties} onClick={(event) => event.stopPropagation()}>
        <header className="mods-head">
          <div className="mods-title">
            <h2>Original files from Steam</h2>
            <span>{original}</span>
          </div>
          <button
            type="button"
            className="icon-button original-help-button"
            aria-label="How this works"
            aria-expanded={help}
            onClick={() => setHelp(!help)}
          >
            ?
          </button>
          <button type="button" className="icon-button" aria-label="Close" disabled={busy} onClick={close}>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="original-body">
          {busy ? (
            <div className="original-run">
              <strong>{STATUS[progress?.phase ?? 'preparing']}</strong>
              {progress?.phase === 'downloading' ? (
                <>
                  <div className="bar">
                    <span style={{ width: `${Math.round(percent * 100)}%` }} />
                  </div>
                  <small className="muted-copy">
                    {formatBytes(progress.received)} of {formatBytes(progress.total)}
                  </small>
                </>
              ) : progress?.phase === 'code' ? (
                <form className="original-code" onSubmit={(event) => void sendCode(event)}>
                  <input
                    className="field"
                    value={code}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Code from the email or the Steam app"
                    onChange={(event) => setCode(event.target.value)}
                  />
                  <button type="submit" className="primary-button" disabled={!isSteamCode(code.trim())}>
                    Continue
                  </button>
                </form>
              ) : (
                <div className="bar bar-waiting">
                  <span />
                </div>
              )}
              <button type="button" className="ghost-button" onClick={() => void window.ogl.cancelOriginal()}>
                Cancel
              </button>
            </div>
          ) : (
            <>
              {help ? (
                <ul className="original-help">
                  <li>
                    Steam only has {original} for Windows, so the Steam app will not download it on a Mac. SteamCMD,
                    Valve's command-line tool, can.
                  </li>
                  <li>You need to own the game on Steam.</li>
                  <li>
                    OGL runs SteamCMD in the background and hands it your password. OGL does not keep the password;
                    SteamCMD remembers the sign-in on this Mac.
                  </li>
                  <li>
                    Sign in via Terminal if you would rather type the password into SteamCMD yourself. Afterwards press
                    Download with the password left empty.
                  </li>
                </ul>
              ) : null}
              {installed ? (
                <p className="original-done">
                  Downloaded. {game.name} uses these files.
                  <button type="button" className="link-button" onClick={() => void window.ogl.showOriginal(game.id)}>
                    Show in Finder
                  </button>
                </p>
              ) : null}

              <form className="original-form" onSubmit={(event) => void download(event)}>
                <label>
                  Steam account name
                  <input
                    className="field"
                    value={username}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </label>
                <label>
                  Password
                  <input
                    className="field"
                    type="password"
                    value={password}
                    autoComplete="off"
                    placeholder={installed ? 'Empty if signed in' : ''}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <button type="submit" className="primary-button" disabled={!nameOk}>
                  {installed ? 'Download again' : 'Download'}
                </button>
              </form>

              <div className="original-terminal">
                <code>steamcmd +login {nameOk ? name : 'your-name'} +quit</code>
                <button type="button" className="ghost-button" disabled={!nameOk} onClick={() => void terminal()}>
                  Sign in via Terminal
                </button>
              </div>
              {note ? <p className="muted-copy">{note}</p> : null}
            </>
          )}
          {error ? <p className="error-copy">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return message.replace(/^Error invoking remote method '[^']+': (?:[A-Za-z]*Error: )?/, '') || 'Something went wrong'
}
