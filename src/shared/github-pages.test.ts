import { describe, expect, it } from 'vitest'
import { readExpandedAssets, readReleaseNotes, readReleasesPage } from './github-pages'

const list = `
<a href="/OpenRA/OpenRA/releases/tag/playtest-20260222" class="Link--primary">playtest-20260222</a></span>
<span class="Label Label--warning">Pre-release</span>
<relative-time datetime="2026-02-22T20:12:34Z">Feb 22</relative-time>
<a href="/OpenRA/OpenRA/releases/tag/playtest-20260222">again</a>
<a href="/OpenRA/OpenRA/releases/tag/release-20250330" class="Link--primary">release-20250330</a>
<span class="Label Label--success">Latest</span>
<relative-time datetime="2025-03-30T10:00:00Z">Mar 30</relative-time>`

const assets = `
<a href="/OpenRA/OpenRA/releases/download/release-20250330/OpenRA-release-20250330-x64-winportable.zip" rel="nofollow">
  <span class="text-bold">OpenRA-release-20250330-x64-winportable.zip</span></a>
<span class="color-fg-muted">69.7 MB</span>
<a href="/OpenRA/OpenRA/releases/download/release-20250330/OpenRA-release-20250330.dmg" rel="nofollow">x</a>
<span class="color-fg-muted">152 MB</span>
<a href="/OpenRA/OpenRA/archive/refs/tags/release-20250330.zip">Source code</a>`

const atom = `<feed><entry>
<link rel="alternate" type="text/html" href="https://github.com/OpenRA/OpenRA/releases/tag/release-20250330"/>
<title>Release 20250330</title>
<content type="html">&lt;h2&gt;Fixes&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Fixed a crash &amp;amp; a desync&lt;/li&gt;&lt;/ul&gt;</content>
</entry><entry>
<link rel="alternate" type="text/html" href="https://github.com/OpenRA/OpenRA/releases/tag/playtest-20260222"/>
<title>playtest-20260222</title><content>No content.</content></entry></feed>`

describe('GitHub public pages', () => {
  it('reads tags, dates and pre-release labels from the releases page', () => {
    expect(readReleasesPage(list, 'OpenRA', 'OpenRA')).toEqual([
      { tag: 'playtest-20260222', prerelease: true, publishedAt: '2026-02-22T20:12:34Z' },
      { tag: 'release-20250330', prerelease: false, publishedAt: '2025-03-30T10:00:00Z' }
    ])
  })

  it('reads file names, links and sizes, and skips source archives', () => {
    expect(readExpandedAssets(assets, 'OpenRA', 'OpenRA')).toEqual([
      {
        name: 'OpenRA-release-20250330-x64-winportable.zip',
        url: 'https://github.com/OpenRA/OpenRA/releases/download/release-20250330/OpenRA-release-20250330-x64-winportable.zip',
        size: Math.round(69.7 * 1024 ** 2)
      },
      {
        name: 'OpenRA-release-20250330.dmg',
        url: 'https://github.com/OpenRA/OpenRA/releases/download/release-20250330/OpenRA-release-20250330.dmg',
        size: 152 * 1024 ** 2
      }
    ])
  })

  it('turns release notes from the feed into plain lines', () => {
    const notes = readReleaseNotes(atom)
    expect(notes.get('release-20250330')).toEqual({ title: 'Release 20250330', notes: '## Fixes\n- Fixed a crash & a desync' })
    expect(notes.get('playtest-20260222')?.notes).toBe('')
  })
})
