import { useState } from 'react'
import { gameMark } from '../../shared/labels'
import type { Game } from '../../shared/types'

type GameIconProps = {
  game: Game
  src?: string
  size?: 'small' | 'large'
}

export function GameIcon({ game, src, size = 'small' }: GameIconProps) {
  const [failed, setFailed] = useState<string | null>(null)
  const className = size === 'large' ? 'icon icon-large' : 'icon'
  if (src && failed !== src) {
    return <img className={className} src={src} alt="" draggable={false} onError={() => setFailed(src)} />
  }
  return (
    <span className={`${className} icon-mark`} style={{ background: game.accent }} aria-hidden="true">
      {gameMark(game.name, game.mark)}
    </span>
  )
}
