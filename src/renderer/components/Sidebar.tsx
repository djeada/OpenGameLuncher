import type { Game, GameArt, InstallView, PlatformInfo, ProgressEvent } from '../../shared/types'
import { GameIcon } from './GameIcon'

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
  onRefresh
}: SidebarProps) {
  const active = downloads.filter((item) => item.phase !== 'done')
  const library = games.filter(
    (game) =>
      installs.some((item) => item.gameId === game.id) ||
      active.some((item) => item.gameId === game.id && item.phase !== 'error')
  )
  return (
    <aside className="rail">
      <div className="brand">
        <span className="logo" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path d="M5 3.2v9.6l8-4.8-8-4.8z" fill="currentColor" />
          </svg>
        </span>
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

      {active.length > 0 ? (
        <div className="downloads">
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
        <span title={platform.hostLabel}>v{platform.version}</span>
        <button type="button" className="icon-button" aria-label="Refresh catalog" title="Refresh catalog" onClick={onRefresh}>
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
