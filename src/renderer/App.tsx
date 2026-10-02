import { useEffect, useState } from 'react'
import { supportsPlatform } from '../shared/labels'
import { modSupport } from '../shared/mods'
import type {
  CatalogSnapshot,
  GameArt,
  GameBuild,
  InstallView,
  LauncherUpdate,
  PlatformInfo,
  ProgressEvent
} from '../shared/types'
import { GameStage } from './components/GameStage'
import { Splash } from './components/Splash'
import { Home } from './components/Home'
import { ModBrowser } from './components/ModBrowser'
import { Sidebar } from './components/Sidebar'

type BuildState = {
  loading: boolean
  items: GameBuild[]
  error?: string
}

const selectedKey = 'ogl.selected'
const homeId = 'home'

function downloadKey(gameId: string, channelId: string): string {
  return `${gameId}:${channelId}`
}

export function App() {
  const [platform, setPlatform] = useState<PlatformInfo | null>(null)
  const [snapshot, setSnapshot] = useState<CatalogSnapshot | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [channelByGame, setChannelByGame] = useState<Record<string, string>>({})
  const [builds, setBuilds] = useState<Record<string, BuildState>>({})
  const [selectedTag, setSelectedTag] = useState<Record<string, string>>({})
  const [installs, setInstalls] = useState<InstallView[]>([])
  const [autoUpdate, setAutoUpdate] = useState<Record<string, boolean>>({})
  const [downloads, setDownloads] = useState<Record<string, ProgressEvent>>({})
  const [launcherUpdate, setLauncherUpdate] = useState<LauncherUpdate>({ state: 'checking' })
  const [actionError, setActionError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkNote, setCheckNote] = useState<string | null>(null)
  const [art, setArt] = useState<Record<string, GameArt>>({})
  const [modsOpen, setModsOpen] = useState(false)

  useEffect(() => {
    if (!checkNote) return
    const timer = setTimeout(() => setCheckNote(null), 4000)
    return () => clearTimeout(timer)
  }, [checkNote])

  useEffect(() => {
    const offCatalog = window.ogl.onCatalog((next) => setSnapshot(next))
    const offDownload = window.ogl.onDownload((event) => {
      const key = downloadKey(event.gameId, event.channelId)
      if (event.phase === 'done') {
        setDownloads((current) => {
          const next = { ...current }
          delete next[key]
          return next
        })
        void window.ogl.getInstalls().then(setInstalls)
        return
      }
      setDownloads((current) => ({ ...current, [key]: event }))
      if (event.phase === 'error' && event.message) setActionError(event.message)
    })
    const offUpdate = window.ogl.onLauncherUpdate(setLauncherUpdate)

    void (async () => {
      const [info, catalog, installed, update] = await Promise.all([
        window.ogl.getPlatform(),
        window.ogl.getCatalog(),
        window.ogl.getInstalls(),
        window.ogl.getLauncherUpdate()
      ])
      setPlatform(info)
      setSnapshot(catalog)
      setInstalls(installed)
      setLauncherUpdate(update)
      const stored = localStorage.getItem(selectedKey)
      const visible = catalog.games.filter((game) => supportsPlatform(game, info.platform))
      setSelectedId(visible.some((game) => game.id === stored) ? stored : homeId)
    })()

    return () => {
      offCatalog()
      offDownload()
      offUpdate()
    }
  }, [])

  const visible = (snapshot?.games ?? []).filter((game) => (platform ? supportsPlatform(game, platform.platform) : false))
  const selected = visible.find((game) => game.id === selectedId) ?? null
  const channelId = selected
    ? channelByGame[selected.id] && selected.channels.some((channel) => channel.id === channelByGame[selected.id])
      ? channelByGame[selected.id]
      : installs.find((item) => item.gameId === selected.id)?.channelId &&
          selected.channels.some(
            (channel) => channel.id === installs.find((item) => item.gameId === selected.id)?.channelId
          )
        ? installs.find((item) => item.gameId === selected.id)?.channelId
        : selected.channels[0]?.id
    : undefined
  const buildKey = selected && channelId ? downloadKey(selected.id, channelId) : ''
  const buildState = buildKey ? builds[buildKey] : undefined
  // Browser games sit in the library under the 'web' channel once played.
  const libraryChannel = channelId ?? (selected?.web ? 'web' : undefined)
  const mods = selected ? modSupport(selected.id) : undefined
  const currentInstall = installs.find((item) => item.gameId === selected?.id && item.channelId === libraryChannel)

  useEffect(() => {
    if (!selected || !channelId) return
    const key = downloadKey(selected.id, channelId)
    let cancel = false
    setBuilds((current) => ({
      ...current,
      [key]: { loading: true, items: current[key]?.items ?? [] }
    }))
    window.ogl
      .getBuilds(selected.id, channelId)
      .then((items) => {
        if (cancel) return
        setBuilds((current) => ({ ...current, [key]: { loading: false, items } }))
        setSelectedTag((current) => {
          if (current[key] && items.some((item) => item.tag === current[key])) return current
          return { ...current, [key]: items[0]?.tag ?? '' }
        })
      })
      .catch((error: unknown) => {
        if (cancel) return
        const message = errorText(error, 'Could not load builds')
        setBuilds((current) => ({ ...current, [key]: { loading: false, items: [], error: message } }))
      })
    return () => {
      cancel = true
    }
  }, [selected, channelId])

  const gameIds = visible.map((game) => game.id).join(',')
  useEffect(() => {
    for (const id of gameIds ? gameIds.split(',') : []) {
      window.ogl
        .getArt(id)
        .then((next) => setArt((current) => ({ ...current, [id]: next })))
        .catch(() => undefined)
    }
  }, [gameIds, snapshot])

  function chooseGame(id: string) {
    setSelectedId(id)
    setModsOpen(false)
    setActionError(null)
    localStorage.setItem(selectedKey, id)
  }

  // Reloads the catalog and asks GitHub for a newer OGL, then says what it found.
  async function refresh() {
    if (checking) return
    setChecking(true)
    setCheckNote(null)
    const started = Date.now()
    try {
      const [next, update] = await Promise.all([window.ogl.refreshCatalog(), window.ogl.checkLauncherUpdate()])
      setSnapshot(next)
      setLauncherUpdate(update)
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, 700 - (Date.now() - started))))
      setCheckNote(next.error ? 'Check failed' : checkResult(update))
    } catch {
      setCheckNote('Check failed')
    } finally {
      setChecking(false)
    }
  }

  async function installSelected() {
    if (!selected || !channelId || !buildKey) return
    const tag = selectedTag[buildKey]
    if (!tag) return
    setActionError(null)
    try {
      await window.ogl.install(selected.id, channelId, tag)
      setInstalls(await window.ogl.getInstalls())
    } catch (error) {
      const message = errorText(error, 'Install failed')
      if (message !== 'Download cancelled') setActionError(message)
    }
  }

  async function launch(gameId = selected?.id, channel = currentInstall?.channelId) {
    if (!gameId || !channel) return
    setActionError(null)
    try {
      await window.ogl.launch(gameId, channel)
    } catch (error) {
      setActionError(errorText(error, 'Launch failed'))
    }
  }

  async function uninstall() {
    if (!selected || !libraryChannel) return
    setActionError(null)
    try {
      await window.ogl.uninstall(selected.id, libraryChannel)
    } catch (error) {
      setActionError(errorText(error, 'Uninstall failed'))
    }
    setInstalls(await window.ogl.getInstalls())
  }

  async function playWeb(gameId: string) {
    setActionError(null)
    try {
      await window.ogl.playWeb(gameId)
    } catch (error) {
      setActionError(errorText(error, 'Could not open the game'))
    }
    setInstalls(await window.ogl.getInstalls())
  }

  return (
    <div className={platform?.platform === 'darwin' ? 'shell mac' : 'shell'}>
      {platform?.platform === 'darwin' ? <div className="drag" /> : null}
      <Splash ready={Boolean(platform && snapshot)} />
      {platform && snapshot ? (
        <Sidebar
          platform={platform}
          games={visible}
          selectedId={selected?.id ?? null}
          art={art}
          installs={installs}
          downloads={Object.values(downloads)}
          catalogError={snapshot.error}
          onSelect={chooseGame}
          onHome={() => chooseGame(homeId)}
          onCancel={(gameId, id) => void window.ogl.cancelInstall(gameId, id)}
          onRefresh={() => void refresh()}
          launcherUpdate={launcherUpdate}
          checking={checking}
          checkNote={checkNote}
          onUpdateDownload={() => {
            window.ogl
              .downloadLauncherUpdate()
              .catch((error: unknown) => setLauncherUpdate({ state: 'error', message: errorText(error, 'Could not update OGL') }))
          }}
          onUpdateInstall={() => void window.ogl.installLauncherUpdate()}
        />
      ) : (
        <aside className="rail" />
      )}
      <main className="main" key={selected?.id ?? homeId}>
        {platform && selected && (channelId || selected.web) ? (
          <GameStage
            game={selected}
            art={art[selected.id]}
            platform={platform}
            channelId={channelId ?? ''}
            builds={buildState?.items ?? []}
            buildsLoading={buildState?.loading ?? true}
            buildsError={buildState?.error}
            selectedTag={buildKey ? selectedTag[buildKey] || null : null}
            install={currentInstall}
            installedChannels={installs.filter((item) => item.gameId === selected.id).map((item) => item.channelId)}
            download={downloads[buildKey]}
            actionError={actionError}
            autoUpdate={autoUpdate[buildKey] ?? currentInstall?.autoUpdate ?? true}
            mods={mods}
            onOpenMods={() => setModsOpen(true)}
            onChannel={(id) => {
              setActionError(null)
              setChannelByGame((current) => ({ ...current, [selected.id]: id }))
            }}
            onSelectTag={(tag) => setSelectedTag((current) => ({ ...current, [buildKey]: tag }))}
            onInstall={() => void installSelected()}
            onLaunch={() => void launch()}
            onCancel={() => channelId && void window.ogl.cancelInstall(selected.id, channelId)}
            onAutoUpdate={(enabled) => {
              setAutoUpdate((current) => ({ ...current, [buildKey]: enabled }))
              if (channelId) void window.ogl.setAutoUpdate(selected.id, channelId, enabled)
            }}
            onUninstall={() => void uninstall()}
            onShowInstall={() => channelId && void window.ogl.showInstall(selected.id, channelId)}
            onShowLog={() => {
              if (!channelId) return
              window.ogl
                .showLog(selected.id, channelId)
                .catch((error: unknown) => setActionError(errorText(error, 'Could not open the log')))
            }}
            onPlayWeb={() => void playWeb(selected.id)}
            onOpenLink={(url) => void window.ogl.openExternal(url)}
            onOpenWebsite={() => {
              if (selected.website) void window.ogl.openExternal(selected.website)
            }}
          />
        ) : platform && snapshot && visible.length > 0 ? (
          <Home
            games={visible}
            art={art}
            installs={installs}
            downloads={downloads}
            actionError={actionError}
            onOpen={chooseGame}
            onLaunch={(gameId, channel) => void launch(gameId, channel)}
            onPlayWeb={(gameId) => void playWeb(gameId)}
          />
        ) : (
          <div className="waiting">
            <h1>OGL</h1>
            <p>{platform && snapshot ? `No games for ${platform.hostLabel}.` : 'Loading the library.'}</p>
          </div>
        )}
      </main>
      {selected && mods && modsOpen ? <ModBrowser game={selected} support={mods} onClose={() => setModsOpen(false)} /> : null}
    </div>
  )
}

// Electron wraps errors from the main process as "Error invoking remote method '…': Error: …".
function errorText(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback
  return message.replace(/^Error invoking remote method '[^']+': (?:[A-Za-z]*Error: )?/, '') || fallback
}

function checkResult(update: LauncherUpdate): string {
  if (update.state === 'available' || update.state === 'downloading' || update.state === 'ready') {
    return `OGL ${update.version} found`
  }
  if (update.state === 'error') return 'Check failed'
  return 'Up to date'
}
