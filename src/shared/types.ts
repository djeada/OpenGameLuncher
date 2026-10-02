export type PlatformId = 'darwin' | 'win32' | 'linux'
export type ArchId = 'arm64' | 'x64' | 'ia32'
export type PrereleaseFilter = 'exclude' | 'only' | 'include'
export type ArchiveKind = 'zip' | 'tar.gz' | 'tar.xz' | 'dmg' | 'file'
export type CdnKind = 'openttd'

export type AssetRule = {
  include: string[]
  exclude?: string[]
  prefer?: string[]
  arch?: Partial<Record<ArchId, string[]>>
}

export type LaunchSpec = {
  app?: string
  binary?: string
  args?: string[]
}

// An engine the game file runs inside, such as LÖVE for .love files. Shared between games.
export type RuntimeSpec = {
  owner: string
  repo: string
  tag: string
  asset: AssetRule
  archive: ArchiveKind
  launch?: LaunchSpec
}

export type PlatformBuild = {
  asset: AssetRule
  archive: ArchiveKind
  launch?: LaunchSpec
  runtime?: RuntimeSpec
}

export type GithubSource = {
  type: 'github-releases'
  owner: string
  repo: string
  prerelease?: PrereleaseFilter
  cdn?: CdnKind
}

// A free itch.io page. OGL reads the uploads listed on it; the version comes from the file name.
export type ItchSource = {
  type: 'itch'
  page: string
}

export type GameChannel = {
  id: string
  label: string
  description?: string
  source: GithubSource | ItchSource
}

export type OriginalGame = {
  name: string
  url?: string
}

export type Game = {
  id: string
  name: string
  mark?: string
  tagline: string
  website?: string
  note?: string
  accent: string
  cover?: string
  icon?: string
  screenshots?: string[]
  tags?: string[]
  web?: { url: string }
  requires?: OriginalGame
  channels: GameChannel[]
  platforms: Partial<Record<PlatformId, PlatformBuild>>
}

export type BuildAsset = {
  name: string
  url: string
  size: number
}

export type GameBuild = {
  tag: string
  title: string
  publishedAt: string
  prerelease: boolean
  notes: string
  asset: BuildAsset
}

export type GameArt = {
  cover?: string
  icon?: string
  screenshots: string[]
}

export type PlatformInfo = {
  platform: string
  arch: string
  version: string
  hostLabel: string
}

export type CatalogSource = 'remote' | 'cache' | 'bundled'

export type CatalogSnapshot = {
  games: Game[]
  source: CatalogSource
  error?: string
}

export type InstallView = {
  gameId: string
  channelId: string
  tag: string
  installedAt: string
  autoUpdate: boolean
}

export type DownloadPhase = 'downloading' | 'extracting' | 'error' | 'done'

export type ProgressEvent = {
  gameId: string
  channelId: string
  tag: string
  gameName: string
  phase: DownloadPhase
  received: number
  total: number
  message?: string
}

export type LauncherUpdate =
  | { state: 'dev' }
  | { state: 'unconfigured' }
  | { state: 'checking' }
  | { state: 'none'; version: string }
  // manual: this build cannot install the update itself, so the player downloads it.
  | { state: 'available'; version: string; manual?: boolean }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  // version: the update is known, so the player can still download it by hand.
  | { state: 'error'; message: string; version?: string }

export type OglConfig = {
  repository: {
    owner: string
    name: string
  }
  catalog: {
    branch: string
    directory: string
  }
}
