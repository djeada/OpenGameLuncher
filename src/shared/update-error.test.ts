import { describe, expect, it } from 'vitest'
import { describeUpdateError } from './update-error'

describe('describeUpdateError', () => {
  it('offers a manual download when macOS rejects the signature', () => {
    const failure = describeUpdateError(
      'Code signature at URL file:///Users/me/Library/Caches/dev.ogl.launcher.ShipIt/update.sAMKEm2/OGL.app/ did not pass validation: code failed to satisfy specified code requirement(s)'
    )
    expect(failure.manual).toBe(true)
    expect(failure.message).not.toContain('file://')
  })

  it('names the connection when GitHub cannot be reached', () => {
    const failure = describeUpdateError('net::ERR_INTERNET_DISCONNECTED')
    expect(failure.manual).toBe(false)
    expect(failure.message).toContain('internet')
  })

  it('never passes the raw text through', () => {
    expect(describeUpdateError('ENOENT: /some/path').message).not.toContain('ENOENT')
  })
})
