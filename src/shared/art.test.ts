import { describe, expect, it } from 'vitest'
import { readPageArt, resolveArt } from './art'
import type { Game } from './types'

const game = {
  id: 'demo',
  name: 'Demo',
  channels: [{ id: 'release', label: 'Release', source: { type: 'github-releases', owner: 'Demo', repo: 'demo' } }]
} as Game

describe('game art', () => {
  it('reads og:image and the touch icon from a website', () => {
    const html = `<head>
      <meta content="/img/shot.png" property="og:image">
      <link rel="apple-touch-icon" href="https://demo.org/icon.png?a=1&amp;b=2">
    </head>`
    expect(readPageArt(html, 'https://demo.org/')).toEqual({
      image: 'https://demo.org/img/shot.png',
      icon: 'https://demo.org/icon.png?a=1&b=2'
    })
  })

  it('ignores images that are not https', () => {
    expect(readPageArt('<meta property="og:image" content="http://demo.org/a.png">', 'https://demo.org').image).toBeUndefined()
  })

  it('prefers catalog art, then the website, then the GitHub owner', () => {
    expect(resolveArt({ ...game, cover: 'https://a/c.png' }, { image: 'https://b/i.png' }).cover).toBe('https://a/c.png')
    expect(resolveArt(game, { image: 'https://b/i.png' }).cover).toBe('https://b/i.png')
    expect(resolveArt(game, null).icon).toBe('https://github.com/Demo.png?size=256')
    expect(resolveArt({ ...game, screenshots: ['https://s/1.png'] }, null).cover).toBe('https://s/1.png')
  })
})
