import { useEffect, useState, type CSSProperties } from 'react'
import { launchAction } from '../../shared/action'
import { formatBytes, machinePhrase } from '../../shared/labels'
import type {
  Game,
  GameArt,
  GameBuild,
  InstallView,
  ModSupport,
  OriginalGame,
  PlatformInfo,
  ProgressEvent
} from '../../shared/types'
import { Cover } from './Cover'
import { GameIcon } from './GameIcon'
import { LaunchButton } from './LaunchButton'
import { ReleaseNotes } from './ReleaseNotes'
import { TrackPicker } from './TrackPicker'
import { VersionPicker } from './VersionPicker'

type GameStageProps = {
  game: Game
  art?: GameArt
  platform: PlatformInfo
  channelId: string
  builds: GameBuild[]
  buildsLoading: boolean
  buildsError?: string
  selectedTag: string | null
  install?: InstallView
  installedChannels: string[]
  download?: ProgressEvent
  actionError?: string | null
  autoUpdate: boolean
  mods?: ModSupport
  onOpenMods: () => void
  onChannel: (channelId: string) => void
  onSelectTag: (tag: string) => void
  onInstall: () => void
  onLaunch: () => void
  onCancel: () => void
  onAutoUpdate: (enabled: boolean) => void
  onOpenWebsite: () => void
  onOpenLink: (url: string) => void
  onUninstall: () => void
  onShowInstall: () => void
  onShowLog: () => void
  onPlayWeb: () => void
}

export function GameStage({
  game,
  art,
  platform,
  channelId,
  builds,
  buildsLoading,
  buildsError,
  selectedTag,
  install,
  installedChannels,
  download,
  actionError,
  autoUpdate,
  mods,
  onOpenMods,
  onChannel,
  onSelectTag,
  onInstall,
  onLaunch,
  onCancel,
  onAutoUpdate,
  onOpenWebsite,
  onOpenLink,
  onUninstall,
  onShowInstall,
  onShowLog,
  onPlayWeb
}: GameStageProps) {
  const [shot, setShot] = useState<number | null>(null)
  const channel = game.channels.find((item) => item.id === channelId) ?? game.channels[0]
  const selected = builds.find((build) => build.tag === selectedTag) ?? null
  const latest = builds[0] ?? null
  const percent = download && download.total > 0 ? download.received / download.total : 0
  const isWeb = game.channels.length === 0 && Boolean(game.web)
  const nativeAction = launchAction({
    hasAsset: Boolean(selected),
    machine: machinePhrase(platform.platform),
    selectedTag,
    latestTag: latest?.tag ?? null,
    installedTag: install?.tag ?? null,
    phase: download && download.phase !== 'done' ? download.phase : undefined,
    percent,
    pending: buildsLoading && !selected
  })
  const action = isWeb ? { label: 'Play', kind: 'launch' as const, secondaryLaunch: false } : nativeAction
  const screenshots = art?.screenshots ?? []

  return (
    <section className="page" style={{ '--accent': game.accent } as CSSProperties}>
      <header className="hero">
        <Cover src={art?.cover} accent={game.accent} className="hero-art" />
        <div className="hero-shade" />
        <div className="hero-body">
          <GameIcon game={game} src={art?.icon} size="large" />
          <div className="hero-copy">
            <h1>{game.name}</h1>
            <p>{game.tagline}</p>
            {game.requires || game.note ? (
              <div className="hero-meta">
                {game.requires ? <RequiresTag requires={game.requires} onOpen={onOpenLink} /> : null}
                {game.note ? <span className="hero-note">{game.note}</span> : null}
              </div>
            ) : null}
          </div>
          <div className="hero-action">
            {isWeb ? <span className="hero-hint">Plays in its own window</span> : null}
            {action.kind === 'install' && selected ? (
              <span className="hero-hint">
                {selected.tag}
                {selected.asset.size > 0 ? ` · ${formatBytes(selected.asset.size)}` : ''}
              </span>
            ) : null}
            <div className="hero-buttons">
              <LaunchButton
                label={action.label}
                kind={action.kind}
                progress={percent}
                onClick={() => {
                  if (isWeb) onPlayWeb()
                  else if (action.kind === 'launch') onLaunch()
                  else if (action.kind === 'cancel') onCancel()
                  else if (action.kind === 'install') onInstall()
                }}
              />
              <GameMenu
                platform={platform.platform}
                web={isWeb}
                installed={Boolean(install)}
                busy={Boolean(download && download.phase !== 'done' && download.phase !== 'error')}
                website={game.website}
                onWebsite={onOpenWebsite}
                onShow={onShowInstall}
                onShowLog={onShowLog}
                onUninstall={onUninstall}
              />
            </div>
            {action.secondaryLaunch && install ? (
              <button type="button" className="ghost-button" onClick={onLaunch}>
                Play {install.tag}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {actionError ? <p className="page-error">{actionError}</p> : null}

      <div className={isWeb ? 'page-body page-body-web' : 'page-body'}>
        <div className="page-main">
          {screenshots.length > 0 ? (
            <section className="block">
              <h3 className="block-title">Screenshots</h3>
              <div className="shots">
                {screenshots.map((src, index) => (
                  <button key={src} type="button" className="shot" onClick={() => setShot(index)}>
                    <Cover src={src} accent={game.accent} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {isWeb ? null : (
            <section className="block">
              <h3 className="block-title">
                {selected ? `What's new in ${selected.tag}` : "What's new"}
                {selected?.prerelease ? <span className="chip chip-beta">Pre-release</span> : null}
              </h3>
              {selected ? (
                <ReleaseNotes text={selected.notes} />
              ) : buildsLoading ? (
                <div className="skeleton skeleton-tall" />
              ) : (
                <p className="muted-copy">Pick a version to see its notes.</p>
              )}
            </section>
          )}
        </div>

        {isWeb ? null : (
          <aside className="panel">
            {game.channels.length > 1 ? (
              <TrackPicker
                channels={game.channels}
                channelId={channel?.id ?? channelId}
                installedChannels={installedChannels}
                onChange={onChannel}
              />
            ) : null}
            <VersionPicker
              builds={builds}
              loading={buildsLoading}
              error={buildsError}
              selectedTag={selectedTag}
              emptyLabel={
                channel ? `No ${channel.label.toLowerCase()} builds for ${machinePhrase(platform.platform)}.` : 'No builds.'
              }
              onSelect={onSelectTag}
            />
            <label className="switch-row">
              Auto-update
              <input
                type="checkbox"
                className="switch"
                checked={autoUpdate}
                onChange={(event) => onAutoUpdate(event.target.checked)}
              />
            </label>
            {mods ? (
              <button type="button" className="panel-link" onClick={onOpenMods}>
                {mods.label}
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="m4.5 3 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            ) : null}
          </aside>
        )}
      </div>

      {shot !== null && screenshots[shot] ? (
        <Lightbox images={screenshots} index={shot} onChange={setShot} onClose={() => setShot(null)} />
      ) : null}
    </section>
  )
}

function RequiresTag({ requires, onOpen }: { requires: OriginalGame; onOpen: (url: string) => void }) {
  const label = `Needs ${requires.name}`
  if (!requires.url) return <span className="requires">{label}</span>
  const url = requires.url
  return (
    <button
      type="button"
      className="requires"
      title={`You need your own copy of ${requires.name}. Opens ${new URL(url).hostname}.`}
      onClick={() => onOpen(url)}
    >
      {label}
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </button>
  )
}

function GameMenu({
  platform,
  web,
  installed,
  busy,
  website,
  onWebsite,
  onShow,
  onShowLog,
  onUninstall
}: {
  platform: string
  web: boolean
  installed: boolean
  busy: boolean
  website?: string
  onWebsite: () => void
  onShow: () => void
  onShowLog: () => void
  onUninstall: () => void
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const folder = platform === 'darwin' ? 'Show in Finder' : platform === 'win32' ? 'Show in Explorer' : 'Open folder'

  useEffect(() => {
    if (!open) return
    const close = () => {
      setOpen(false)
      setConfirming(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close()
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!installed && !website) return null
  return (
    <div className="menu-wrap" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="menu-button"
        aria-label="More"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open)
          setConfirming(false)
        }}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="3.5" cy="8" r="1.3" fill="currentColor" />
          <circle cx="8" cy="8" r="1.3" fill="currentColor" />
          <circle cx="12.5" cy="8" r="1.3" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <div className="menu" role="menu">
          {website ? (
            <button type="button" role="menuitem" onClick={() => (onWebsite(), setOpen(false))}>
              Website
            </button>
          ) : null}
          {installed ? (
            <>
              {web ? null : (
                <>
                  <button type="button" role="menuitem" onClick={() => (onShow(), setOpen(false))}>
                    {folder}
                  </button>
                  <button type="button" role="menuitem" onClick={() => (onShowLog(), setOpen(false))}>
                    Show last launch log
                  </button>
                </>
              )}
              <hr />
              <button
                type="button"
                role="menuitem"
                className="menu-danger"
                disabled={busy}
                onClick={() => {
                  if (!confirming && !web) return setConfirming(true)
                  onUninstall()
                  setOpen(false)
                  setConfirming(false)
                }}
              >
                {web ? 'Remove from library' : confirming ? 'Click again to uninstall' : 'Uninstall'}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Lightbox({
  images,
  index,
  onChange,
  onClose
}: {
  images: string[]
  index: number
  onChange: (index: number) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onChange((index + 1) % images.length)
      if (event.key === 'ArrowLeft') onChange((index - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [images.length, index, onChange, onClose])

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <img src={images[index]} alt="" onClick={(event) => event.stopPropagation()} />
      {images.length > 1 ? (
        <span className="lightbox-count">
          {index + 1} / {images.length}
        </span>
      ) : null}
    </div>
  )
}
