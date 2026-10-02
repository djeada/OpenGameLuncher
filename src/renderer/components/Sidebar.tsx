import type { Game, GameArt, InstallView, LauncherUpdate, PlatformInfo, ProgressEvent } from '../../shared/types'
import { GameIcon } from './GameIcon'
import { Logo } from './Logo'

type SidebarProps = {
  platform: PlatformInfo
  games: Game[]
  selectedId: string | null
  art: Record<string, GameArt>
  installs: InstallView[]
  downloads: ProgressEvent[]
  catalogError?: string
  onSelect: (id: string) => void
  onHome: () => void
  onCancel: (gameId: string, channelId: string) => void
  onRefresh: () => void
  launcherUpdate: LauncherUpdate
  checking: boolean
  checkNote: string | null
  onUpdateDownload: () => void
  onUpdateInstall: () => void
}

export function Sidebar({
  platform,
  games,
  selectedId,
  art,
  installs,
  downloads,
  catalogError,
  onSelect,
  onHome,
  onCancel,
  onRefresh,
  launcherUpdate,
  checking,
  checkNote,
  onUpdateDownload,
  onUpdateInstall
}: SidebarProps) {
  const active = downloads.filter((item) => item.phase !== 'done')
  const library = games.filter(
    (game) =>
      installs.some((item) => item.gameId === game.id) ||
      active.some((item) => item.gameId === game.id && item.phase !== 'error')
  )
  const showsUpdate =
    launcherUpdate.state === 'available' ||
    launcherUpdate.state === 'downloading' ||
    launcherUpdate.state === 'ready' ||
    launcherUpdate.state === 'error'
  return (
    <aside className="rail">
      <div className="brand">
        <Logo />
        <strong>OGL</strong>
      </div>

      <nav className="rail-nav">
        <button type="button" className="nav-item" aria-current={selectedId === null ? 'page' : undefined} onClick={onHome}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.5 7.2 8 2.8l5.5 4.4V13a.5.5 0 0 1-.5.5H9.8V10H6.2v3.5H3a.5.5 0 0 1-.5-.5z" fill="currentColor" />
          </svg>
          Home
        </button>
      </nav>

      <p className="rail-label">Library</p>
      <div className="rail-scroll">
        {library.map((game) => {
          const installed = installs.find((item) => item.gameId === game.id)
          const downloading = active.some((item) => item.gameId === game.id && item.phase !== 'error')
          return (
            <button
              key={game.id}
              type="button"
              className="game"
              aria-current={game.id === selectedId ? 'page' : undefined}
              onClick={() => onSelect(game.id)}
            >
              <GameIcon game={game} src={art[game.id]?.icon} />
              <span className="game-copy">
                <span className="game-name">{game.name}</span>
                <span className="game-version">
                  {downloading ? 'Installing…' : installed?.tag}
                </span>
              </span>
              {installed && !downloading ? <span className="dot" title="Installed" /> : null}
            </button>
          )
        })}
        {library.length === 0 ? (
          <p className="rail-empty">Games you install show up here.</p>
        ) : null}
      </div>

      {active.length > 0 || showsUpdate ? (
        <div className="downloads">
          {showsUpdate ? (
            <div className="download">
              <div className="download-top">
                <span className="download-name">
                  <Logo size={16} />
                  OGL
                </span>
                {launcherUpdate.state === 'available' ? (
                  <button type="button" className="small-button" onClick={onUpdateDownload}>
                    {launcherUpdate.manual ? 'Download' : 'Update'}
                  </button>
                ) : launcherUpdate.state === 'ready' ? (
                  <button type="button" className="small-button" onClick={onUpdateInstall}>
                    Restart
                  </button>
                ) : launcherUpdate.state === 'error' && launcherUpdate.version ? (
                  <button type="button" className="small-button" onClick={onUpdateDownload}>
                    Download
                  </button>
                ) : (
                  <small>{launcherUpdate.state === 'error' ? 'Update failed' : 'Updating'}</small>
                )}
              </div>
              {launcherUpdate.state === 'downloading' ? (
                <div className="bar">
                  <span style={{ width: `${Math.round(launcherUpdate.percent)}%` }} />
                </div>
              ) : null}
              <small>
                {launcherUpdate.state === 'available'
                  ? `${launcherUpdate.version} is available`
                  : launcherUpdate.state === 'downloading'
                    ? `${launcherUpdate.version} · ${Math.round(launcherUpdate.percent)}%`
                    : launcherUpdate.state === 'ready'
                      ? `${launcherUpdate.version} is ready to install`
                      : launcherUpdate.message}
              </small>
            </div>
          ) : null}
          {active.map((item) => {
            const percent = item.total > 0 ? Math.min(100, Math.round((item.received / item.total) * 100)) : 0
            return (
              <div key={`${item.gameId}:${item.channelId}`} className="download">
                <div className="download-top">
                  <span>{item.gameName}</span>
                  {item.phase === 'downloading' ? (
                    <button type="button" className="text-button" onClick={() => onCancel(item.gameId, item.channelId)}>
                      Cancel
                    </button>
                  ) : (
                    <small>{item.phase === 'error' ? 'Failed' : 'Installing'}</small>
                  )}
                </div>
                <div className="bar">
                  <span style={{ width: item.phase === 'extracting' ? '100%' : `${percent}%` }} />
                </div>
                <small>
                  {item.phase === 'error' ? item.message : item.phase === 'downloading' ? `${item.tag} · ${percent}%` : item.tag}
                </small>
              </div>
            )
          })}
        </div>
      ) : null}

      {catalogError ? <p className="rail-error">{catalogError}</p> : null}
      <footer className="rail-foot">
        <span title={platform.hostLabel} role="status">
          {checking ? 'Checking for updates…' : (checkNote ?? `v${platform.version}`)}
        </span>
        <button
          type="button"
          className={checking ? 'icon-button spinning' : 'icon-button'}
          aria-label="Check for updates"
          title="Check for updates"
          disabled={checking}
          onClick={onRefresh}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M13 8a5 5 0 1 1-1.46-3.54M13 2.5V5h-2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </footer>
    </aside>
  )
}
