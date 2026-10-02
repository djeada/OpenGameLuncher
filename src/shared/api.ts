import type {
  CatalogSnapshot,
  GameArt,
  GameBuild,
  InstallView,
  InstalledMod,
  LauncherUpdate,
  Mod,
  ModProgress,
  PlatformInfo,
  ProgressEvent
} from './types'

export type OglApi = {
  getPlatform(): Promise<PlatformInfo>
  getCatalog(): Promise<CatalogSnapshot>
  refreshCatalog(): Promise<CatalogSnapshot>
  onCatalog(listener: (snapshot: CatalogSnapshot) => void): () => void
  getBuilds(gameId: string, channelId: string): Promise<GameBuild[]>
  getArt(gameId: string): Promise<GameArt>
  getInstalls(): Promise<InstallView[]>
  setAutoUpdate(gameId: string, channelId: string, enabled: boolean): Promise<void>
  install(gameId: string, channelId: string, tag: string): Promise<void>
  launch(gameId: string, channelId: string): Promise<void>
  cancelInstall(gameId: string, channelId: string): Promise<void>
  uninstall(gameId: string, channelId: string): Promise<void>
  playWeb(gameId: string): Promise<void>
  showInstall(gameId: string, channelId: string): Promise<void>
  showLog(gameId: string, channelId: string): Promise<void>
  onDownload(listener: (event: ProgressEvent) => void): () => void
  getMods(gameId: string): Promise<Mod[]>
  getInstalledMods(gameId: string): Promise<InstalledMod[]>
  installMod(gameId: string, modId: string): Promise<void>
  uninstallMod(gameId: string, modId: string): Promise<void>
  showMods(gameId: string): Promise<void>
  onModProgress(listener: (event: ModProgress) => void): () => void
  getLauncherUpdate(): Promise<LauncherUpdate>
  checkLauncherUpdate(): Promise<LauncherUpdate>
  downloadLauncherUpdate(): Promise<void>
  installLauncherUpdate(): Promise<void>
  onLauncherUpdate(listener: (update: LauncherUpdate) => void): () => void
  openExternal(url: string): Promise<void>
}
