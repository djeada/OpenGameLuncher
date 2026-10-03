import type { GameChannel } from '../../shared/types'

type TrackPickerProps = {
  channels: GameChannel[]
  channelId: string
  installedChannels: string[]
  onChange: (channelId: string) => void
}

export function isBetaTrack(channel: GameChannel): boolean {
  return channel.source.type !== 'itch' && (channel.source.prerelease === 'include' || channel.source.prerelease === 'only')
}

export function TrackPicker({ channels, channelId, installedChannels, onChange }: TrackPickerProps) {
  return (
    <div className="tracks" role="radiogroup" aria-label="Track">
      {channels.map((channel) => {
        const active = channel.id === channelId
        return (
          <button
            key={channel.id}
            type="button"
            role="radio"
            aria-checked={active}
            className="track"
            title={channel.description}
            onClick={() => onChange(channel.id)}
          >
            {channel.label}
            {isBetaTrack(channel) ? <span className="chip chip-beta">Beta</span> : null}
            {installedChannels.includes(channel.id) ? <span className="dot" /> : null}
          </button>
        )
      })}
    </div>
  )
}
