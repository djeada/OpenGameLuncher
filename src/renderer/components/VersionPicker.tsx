import type { GameBuild } from '../../shared/types'

type VersionPickerProps = {
  builds: GameBuild[]
  loading: boolean
  error?: string
  selectedTag: string | null
  emptyLabel: string
  onSelect: (tag: string) => void
}

export function VersionPicker({
  builds,
  loading,
  error,
  selectedTag,
  emptyLabel,
  onSelect
}: VersionPickerProps) {
  if (loading && builds.length === 0) return <div className="skeleton" aria-busy="true" />
  if (error) return <p className="error-copy">{error}</p>
  if (builds.length === 0) return <p className="muted-copy">{emptyLabel}</p>

  const selected = builds.find((build) => build.tag === selectedTag) ?? builds[0]
  return (
    <select
        className="select"
        value={selected?.tag ?? ''}
        aria-label="Version"
        onChange={(event) => onSelect(event.target.value)}
      >
        {builds.map((build, index) => (
          <option key={build.tag} value={build.tag}>
            {build.tag}
            {index === 0 ? ' · Latest' : ''}
          </option>
        ))}
    </select>
  )
}
