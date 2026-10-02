import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { formatBytes, formatDate } from '../../shared/labels'
import type { Game, InstalledMod, Mod, ModProgress, ModSupport } from '../../shared/types'

type ModBrowserProps = {
  game: Game
  support: ModSupport
  onClose: () => void
}

type Sort = 'recent' | 'name'

const PAGE = 80
const ALL = 'All'
const POPULAR = 'Popular'

export function ModBrowser({ game, support, onClose }: ModBrowserProps) {
  const [mods, setMods] = useState<Mod[] | null>(null)
  const [installed, setInstalled] = useState<InstalledMod[]>([])
  const [progress, setProgress] = useState<Record<string, ModProgress>>({})
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(support.popular?.length ? POPULAR : ALL)
  const [onlyInstalled, setOnlyInstalled] = useState(false)
  const [chosenSort, setSort] = useState<Sort>('recent')
  const [shown, setShown] = useState(PAGE)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    const fail = (problem: unknown) => !cancel && setError(errorText(problem))
    window.ogl.getMods(game.id).then((next) => !cancel && setMods(next), fail)
    window.ogl.getInstalledMods(game.id).then((next) => !cancel && setInstalled(next), fail)
    const off = window.ogl.onModProgress((event) => {
      if (event.gameId !== game.id) return
      setProgress((current) => {
        if (event.phase === 'downloading') return { ...current, [event.modId]: event }
        const next = { ...current }
        delete next[event.modId]
        return next
      })
    })
    return () => {
      cancel = true
      off()
    }
  }, [game.id])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const states = useMemo(() => new Map(installed.map((item) => [item.id, item])), [installed])
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const mod of mods ?? []) counts.set(mod.category, (counts.get(mod.category) ?? 0) + 1)
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).map(([name]) => name)
  }, [mods])

  // Some lists carry no dates, and then only the name can order them.
  const dated = useMemo(() => (mods ?? []).some((mod) => mod.updatedAt), [mods])
  const sort: Sort = dated ? chosenSort : 'name'
  const rank = useMemo(() => new Map((support.popular ?? []).map((id, index) => [id, index])), [support.popular])

  // Popular is a starting point: a search or the Installed tab looks through everything.
  const popular = category === POPULAR && !onlyInstalled && query.trim() === ''
  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const list = (mods ?? []).filter((mod) => {
      if (onlyInstalled && !states.has(mod.id)) return false
      if (popular && !rank.has(mod.id)) return false
      if (category !== ALL && category !== POPULAR && mod.category !== category) return false
      if (words.length === 0) return true
      const haystack = `${mod.name} ${mod.authors.join(' ')} ${mod.description}`.toLowerCase()
      return words.every((word) => haystack.includes(word))
    })
    if (popular) return list.sort((left, right) => (rank.get(left.id) ?? 0) - (rank.get(right.id) ?? 0))
    const bySort = (left: Mod, right: Mod) =>
      sort === 'name' ? left.name.localeCompare(right.name) : right.updatedAt.localeCompare(left.updatedAt)
    if (words.length === 0) return list.sort(bySort)
    // A search lists the well-known sets first, so "trains" finds Iron Horse before a niche add-on.
    const last = rank.size
    return list.sort((left, right) => (rank.get(left.id) ?? last) - (rank.get(right.id) ?? last) || bySort(left, right))
  }, [mods, query, category, onlyInstalled, sort, states, popular, rank])

  useEffect(() => setShown(PAGE), [query, category, onlyInstalled, sort])

  const open = matches.find((mod) => mod.id === openId) ?? matches[0] ?? null

  async function run(action: 'install' | 'uninstall', mod: Mod) {
    setError(null)
    try {
      if (action === 'install') await window.ogl.installMod(game.id, mod.id)
      else await window.ogl.uninstallMod(game.id, mod.id)
    } catch (problem) {
      setError(`${mod.name}: ${errorText(problem)}`)
    }
    setInstalled(await window.ogl.getInstalledMods(game.id).catch(() => installed))
  }

  function action(mod: Mod, roomy: boolean) {
    const active = progress[mod.id]
    const state = states.get(mod.id)
    if (active) {
      const percent = active.total > 0 ? Math.round((active.received / active.total) * 100) : 0
      return (
        <button type="button" className="mod-action" disabled>
          {percent > 0 ? `${percent}%` : 'Starting'}
        </button>
      )
    }
    if (!state) {
      return (
        <button type="button" className="mod-action mod-install" onClick={() => void run('install', mod)}>
          Install
        </button>
      )
    }
    return (
      <>
        {state.outdated ? (
          <button type="button" className="mod-action mod-install" onClick={() => void run('install', mod)}>
            Update
          </button>
        ) : null}
        {roomy || !state.outdated ? (
          <button type="button" className="mod-action mod-remove" onClick={() => void run('uninstall', mod)}>
            <span>Installed</span>
            <span>Uninstall</span>
          </button>
        ) : null}
      </>
    )
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={support.label} onClick={onClose}>
      <div className="mods" style={{ '--accent': game.accent } as CSSProperties} onClick={(event) => event.stopPropagation()}>
        <header className="mods-head">
          <div className="mods-title">
            <h2>{support.label}</h2>
            <span>
              {game.name}
              {mods ? ` · ${mods.length.toLocaleString()} available` : ''}
            </span>
          </div>
          <label className="search mods-search">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder={`Search ${support.label}`}
              value={query}
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="mods-bar">
          <div className="tracks">
            <button type="button" className="track" role="radio" aria-checked={!onlyInstalled} onClick={() => setOnlyInstalled(false)}>
              Browse
            </button>
            <button type="button" className="track" role="radio" aria-checked={onlyInstalled} onClick={() => setOnlyInstalled(true)}>
              Installed
              {installed.length > 0 ? <span className="chip chip-ok">{installed.length}</span> : null}
            </button>
          </div>
          <div className="filters">
            {[...(rank.size > 0 ? [POPULAR] : []), ALL, ...(categories.length > 1 ? categories : [])].map((name) => (
              <button key={name} type="button" className="filter" aria-pressed={category === name} onClick={() => setCategory(name)}>
                {name}
              </button>
            ))}
          </div>
          <select className="select mods-sort" value={sort} disabled={popular || !dated} aria-label="Sort" onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="recent">Newest</option>
            <option value="name">Name</option>
          </select>
        </div>

        {error ? <p className="page-error mods-error">{error}</p> : null}

        <div className="mods-body">
          <div className="mods-list">
            {mods === null && !error ? (
              Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton mod-skeleton" />)
            ) : mods === null ? null : matches.length === 0 ? (
              <p className="muted-copy mods-empty">
                {onlyInstalled && installed.length === 0 ? `No ${support.label} installed yet.` : 'Nothing matches.'}
              </p>
            ) : (
              <>
                {matches.slice(0, shown).map((mod) => (
                  <div
                    key={mod.id}
                    className="mod"
                    aria-current={open?.id === mod.id ? 'true' : undefined}
                    onClick={() => setOpenId(mod.id)}
                  >
                    <ModGlyph mod={mod} />
                    <span className="mod-copy">
                      <strong>{mod.name}</strong>
                      <small>
                        {[categories.length > 1 ? mod.category : '', mod.authors[0] ?? 'Unknown', mod.size > 0 ? formatBytes(mod.size) : mod.version]
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    </span>
                    <span className="mod-actions" onClick={(event) => event.stopPropagation()}>
                      {action(mod, false)}
                    </span>
                  </div>
                ))}
                {matches.length > shown ? (
                  <button type="button" className="ghost-button mods-more" onClick={() => setShown(shown + PAGE)}>
                    Show more ({(matches.length - shown).toLocaleString()} left)
                  </button>
                ) : null}
              </>
            )}
          </div>

          <aside className="mods-detail">
            {open ? (
              <>
                {open.image ? <ModPicture key={open.image} src={open.image} /> : null}
                <span className="eyebrow">{open.category}</span>
                <h3>{open.name}</h3>
                <p className="mods-by">{open.authors.join(', ') || 'Unknown author'}</p>
                <div className="mod-actions">{action(open, true)}</div>
                <p className="mods-text">{open.description || 'No description.'}</p>
                <dl className="mods-facts">
                  {open.version ? (
                    <>
                      <dt>Version</dt>
                      <dd>{open.version}</dd>
                    </>
                  ) : null}
                  {open.updatedAt ? (
                    <>
                      <dt>Updated</dt>
                      <dd>{formatDate(open.updatedAt)}</dd>
                    </>
                  ) : null}
                  {open.size > 0 ? (
                    <>
                      <dt>Size</dt>
                      <dd>{formatBytes(open.size)}</dd>
                    </>
                  ) : null}
                  {open.license ? (
                    <>
                      <dt>License</dt>
                      <dd>{open.license}</dd>
                    </>
                  ) : null}
                </dl>
                {open.tags.length > 0 ? (
                  <div className="mods-tags">
                    {open.tags.map((tag) => (
                      <span key={tag} className="chip chip-req">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {open.url ? (
                  <button type="button" className="link-button" onClick={() => open.url && void window.ogl.openExternal(open.url)}>
                    {new URL(open.url).hostname}
                    <svg viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  </button>
                ) : null}
              </>
            ) : null}
          </aside>
        </div>

        <footer className="mods-foot">
          <span>{support.hint}</span>
          <button type="button" className="text-button" onClick={() => void window.ogl.showMods(game.id).catch(() => undefined)}>
            Open folder
          </button>
        </footer>
      </div>
    </div>
  )
}

// The set's own picture when it has one, otherwise its category's initials.
function ModGlyph({ mod }: { mod: Mod }) {
  const [failed, setFailed] = useState(false)
  const picture = mod.icon ?? mod.image
  return (
    <span className="mod-glyph" style={{ '--hue': hue(mod.category) } as CSSProperties}>
      {picture && !failed ? (
        <img src={picture} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} />
      ) : (
        mod.category.slice(0, 2)
      )}
    </span>
  )
}

function ModPicture({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return <img className="mods-picture" src={src} alt="" draggable={false} onError={() => setFailed(true)} />
}

// A steady colour per category, so a list can be scanned by kind.
function hue(category: string): number {
  let total = 0
  for (const letter of category) total = (total * 31 + letter.charCodeAt(0)) % 360
  return total
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return message.replace(/^Error invoking remote method '[^']+': (?:[A-Za-z]*Error: )?/, '') || 'Something went wrong'
}
