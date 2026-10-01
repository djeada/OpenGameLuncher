export type LaunchKind = 'install' | 'launch' | 'cancel' | 'disabled'

export function launchAction(input: {
  hasAsset: boolean
  machine: string
  selectedTag: string | null
  latestTag: string | null
  installedTag: string | null
  phase?: 'downloading' | 'extracting' | 'error' | 'done'
  percent?: number
  pending?: boolean
}): { label: string; kind: LaunchKind; secondaryLaunch: boolean } {
  const installedElsewhere = Boolean(input.installedTag && input.installedTag !== input.selectedTag)

  if (input.phase === 'downloading') {
    const percent = Math.round((input.percent ?? 0) * 100)
    return {
      label: percent > 0 ? `Downloading ${percent}%` : 'Downloading',
      kind: 'cancel',
      secondaryLaunch: Boolean(input.installedTag)
    }
  }
  if (input.phase === 'extracting') {
    return { label: 'Installing', kind: 'disabled', secondaryLaunch: Boolean(input.installedTag) }
  }
  if (input.pending && !input.hasAsset) {
    return { label: 'Loading', kind: 'disabled', secondaryLaunch: Boolean(input.installedTag) }
  }
  if (!input.hasAsset || !input.selectedTag) {
    return {
      label: `No build for ${input.machine}`,
      kind: 'disabled',
      secondaryLaunch: Boolean(input.installedTag)
    }
  }
  if (input.installedTag === input.selectedTag) {
    return { label: 'Launch', kind: 'launch', secondaryLaunch: false }
  }
  if (!input.installedTag) {
    return { label: 'Install', kind: 'install', secondaryLaunch: false }
  }
  if (input.selectedTag === input.latestTag) {
    return { label: 'Update', kind: 'install', secondaryLaunch: true }
  }
  return { label: 'Install', kind: 'install', secondaryLaunch: installedElsewhere }
}
