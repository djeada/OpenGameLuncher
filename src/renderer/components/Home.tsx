import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Game, GameArt, InstallView, ProgressEvent } from '../../shared/types'
import { Cover } from './Cover'
import { GameIcon } from './GameIcon'
import { isBetaTrack } from './TrackPicker'

type HomeProps = {
  games: Game[]
  art: Record<string, GameArt>
  installs: InstallView[]
  downloads: Record<string, ProgressEvent>
  actionError?: string | null
  onOpen: (gameId: string) => void
  onLaunch: (gameId: string, channelId: string) => void
  onPlayWeb: (gameId: string) => void
}

const INSTALLED = 'In library'
const BROWSER = 'Browser'
const STANDALONE = 'Standalone'
const NEEDS_ORIGINAL = 'Needs original'

function latestInstall(installs: InstallView[], gameId: string): InstallView | undefined {
  return installs
    .filter((item) => item.gameId === gameId)
    .sort((left, right) => right.installedAt.localeCompare(left.installedAt))[0]
}

function isWebGame(game: Game): boolean {
  return game.channels.length === 0 && Boolean(game.web)
}

function fold(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function startsWord(text: string, word: string): boolean {
  return text.startsWith(word) || text.includes(` ${word}`) || text.includes(`-${word}`)
}

// Name hits rank above tag hits, which rank above tagline hits. Every word has to match somewhere.
// Words under three letters only match the start of a word, so "t" does not match every tagline.
function searchScore(game: Game, query: string): number {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return 1
  const name = fold(game.name)
  const tags = fold((game.tags ?? []).join(' '))
  const tagline = fold(`${game.tagline} ${game.requires?.name ?? ''}`)
  const compact = (text: string) => text.replace(/[^a-z0-9]/g, '')
  if (compact(name).startsWith(compact(words.join('')))) return 20
  let score = 0
  for (const word of words) {
    const short = word.length < 3
    const hit = (text: string) => (short ? startsWord(text, word) : text.includes(word))
    if (name.startsWith(word)) score += 4
    else if (hit(name)) score += 3
    else if (hit(tags)) score += 2
    else if (hit(tagline)) score += 1
    else return 0
  }
  return score
}

export function Home({ games, art, installs, downloads, actionError, onOpen, onLaunch, onPlayWeb }: HomeProps) {
  const [featured, setFeatured] = useState(0)
  const [paused, setPaused] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const installedIds = new Set(installs.map((item) => item.gameId))
  const installed = games.filter((game) => installedIds.has(game.id))
  const filtering = query.trim() !== '' || filter !== null

  const filters = useMemo(() => {
    const tags = [...new Set(games.flatMap((game) => game.tags ?? []))].sort((left, right) => left.localeCompare(right))
    const needsOriginal = games.some((game) => game.requires)
    return [
      INSTALLED,
      ...(games.some(isWebGame) ? [BROWSER] : []),
      ...(needsOriginal ? [STANDALONE, NEEDS_ORIGINAL] : []),
      ...tags
    ]
  }, [games])

  const spotlight = useMemo(() => pickSpotlight(games), [games])

  const results = games
    .filter((game) => {
      if (filter === INSTALLED) return installedIds.has(game.id)
      if (filter === BROWSER) return isWebGame(game)
      if (filter === STANDALONE) return !game.requires
      if (filter === NEEDS_ORIGINAL) return Boolean(game.requires)
      if (filter) return game.tags?.includes(filter) ?? false
      return true
    })
    .map((game) => ({ game, score: searchScore(game, query) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.game)

  useEffect(() => {
    if (paused || filtering || spotlight.length < 2) return
    const timer = window.setInterval(() => setFeatured((current) => (current + 1) % spotlight.length), 7000)
    return () => window.clearInterval(timer)
  }, [paused, filtering, spotlight.length])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = document.activeElement instanceof HTMLInputElement
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const hero = spotlight[featured % spotlight.length] ?? games[0]
  if (!hero) return null
  const heroInstall = latestInstall(installs, hero.id)

  function play(game: Game) {
    const install = latestInstall(installs, game.id)
    if (isWebGame(game)) onPlayWeb(game.id)
    else if (install) onLaunch(game.id, install.channelId)
    else onOpen(game.id)
  }

  return (
    <section className={filtering ? 'home home-filtering' : 'home'}>
      <div className="home-top">
        <label className="search">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search games"
            value={query}
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuery('')
                setFilter(null)
                event.currentTarget.blur()
              }
              if (event.key === 'Enter' && results[0]) onOpen(results[0].id)
            }}
          />
          {query ? (
            <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path d="m3 3 6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </label>
      </div>

      {filtering ? null : (
        <header
          className="feature"
          style={{ '--accent': hero.accent } as CSSProperties}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {spotlight.map((game, index) => (
            <Cover
              key={game.id}
              src={art[game.id]?.cover}
              accent={game.accent}
              className={index === featured % spotlight.length ? 'feature-art active' : 'feature-art'}
            />
          ))}
          <div className="hero-shade" />
          <div className="feature-body">
            <span className="eyebrow">Featured</span>
            <h1>{hero.name}</h1>
            <p>{hero.tagline}</p>
            <div className="feature-actions">
              {heroInstall || isWebGame(hero) ? (
                <button type="button" className="primary-button" onClick={() => play(hero)}>
                  <PlayIcon />
                  Play
                </button>
              ) : (
                <button type="button" className="primary-button" onClick={() => onOpen(hero.id)}>
                  Install
                </button>
              )}
              <button type="button" className="ghost-button" onClick={() => onOpen(hero.id)}>
                View details
              </button>
            </div>
          </div>
          {spotlight.length > 1 ? (
            <div className="dots" role="tablist" aria-label="Featured game">
              {spotlight.map((game, index) => (
                <button
                  key={game.id}
                  type="button"
                  role="tab"
                  aria-label={game.name}
                  aria-selected={index === featured % spotlight.length}
                  onClick={() => setFeatured(index)}
                />
              ))}
            </div>
          ) : null}
        </header>
      )}

      {actionError ? <p className="page-error">{actionError}</p> : null}

      {!filtering && installed.length > 0 ? (
        <section className="block">
          <h3 className="block-title">Jump back in</h3>
          <div className="recent">
            {installed.map((game) => {
              const install = latestInstall(installs, game.id)
              return (
                <div key={game.id} className="recent-card">
                  <button type="button" className="recent-open" onClick={() => onOpen(game.id)}>
                    <GameIcon game={game} src={art[game.id]?.icon} />
                    <span className="card-copy">
                      <strong>{game.name}</strong>
                      <small>{install?.tag}</small>
                    </span>
                  </button>
                  <button type="button" className="play-chip" aria-label={`Play ${game.name}`} onClick={() => play(game)}>
                    <PlayIcon />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="block">
        <div className="block-head">
          <h3 className="block-title">
            {filtering ? `${results.length} ${results.length === 1 ? 'game' : 'games'}` : 'All games'}
          </h3>
          <div className="filters" role="group" aria-label="Filter">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                className="filter"
                aria-pressed={filter === item}
                onClick={() => setFilter(filter === item ? null : item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {results.length === 0 ? (
          <div className="empty">
            <strong>No games match{query.trim() ? ` “${query.trim()}”` : ''}</strong>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setQuery('')
                setFilter(null)
              }}
            >
              Show all games
            </button>
          </div>
        ) : (
          <div className="grid">
            {results.map((game) => {
              const download = Object.values(downloads).find(
                (item) => item.gameId === game.id && item.phase !== 'done' && item.phase !== 'error'
              )
              const percent =
                download && download.total > 0 ? Math.round((download.received / download.total) * 100) : 0
              return (
                <button key={game.id} type="button" className="card" onClick={() => onOpen(game.id)}>
                  <Cover src={art[game.id]?.cover} accent={game.accent} className="card-art" />
                  <span className="card-foot">
                    <GameIcon game={game} src={art[game.id]?.icon} />
                    <span className="card-copy">
                      <strong>{game.name}</strong>
                      <small>{game.tagline}</small>
                    </span>
                  </span>
                  <span className="card-chips">
                    {installedIds.has(game.id) && !isWebGame(game) ? <span className="chip chip-ok">Installed</span> : null}
                    {isWebGame(game) ? <span className="chip chip-web">Browser</span> : null}
                    {game.requires ? (
                      <span className="chip chip-req" title={`Needs ${game.requires.name}`}>
                        Needs original
                      </span>
                    ) : null}
                    {game.channels.some(isBetaTrack) ? <span className="chip chip-beta">Beta</span> : null}
                  </span>
                  {download ? (
                    <span className="card-bar">
                      <span style={{ width: download.phase === 'extracting' ? '100%' : `${percent}%` }} />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}

const SPOTLIGHT_SIZE = 5

// The banner shows a handful of games with real cover art, and a different handful each day.
function pickSpotlight(games: Game[]): Game[] {
  const withArt = games.filter((game) => game.cover)
  const pool = withArt.length > 0 ? withArt : games
  if (pool.length <= SPOTLIGHT_SIZE) return pool
  const day = Math.floor(Date.now() / 86_400_000)
  const start = (day * SPOTLIGHT_SIZE) % pool.length
  return Array.from({ length: SPOTLIGHT_SIZE }, (_, index) => pool[(start + index) % pool.length] as Game)
}

function PlayIcon() {
  return (
    <svg className="play" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 1.8v8.4l7-4.2-7-4.2z" fill="currentColor" />
    </svg>
  )
}
