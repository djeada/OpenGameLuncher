import { describe, expect, it } from 'vitest'
import {
  isSteamName,
  originalSource,
  readIniValue,
  readSteamOutput,
  readYamlValue,
  setIniValue,
  setYamlValue,
  signInScript,
  steamArgs
} from './originals'

describe('original files', () => {
  it('are offered on a Mac only, for the listed games', () => {
    expect(originalSource('openloco', 'darwin')?.appId).toBe(356430)
    expect(originalSource('openloco', 'win32')).toBeUndefined()
    expect(originalSource('openttd', 'darwin')).toBeUndefined()
    expect(originalSource('constructor', 'darwin')).toBeUndefined()
  })

  it('asks SteamCMD for the Windows files, folder before sign-in', () => {
    expect(steamArgs(356430, '/data/originals/openloco', 'player')).toEqual([
      '+@sSteamCmdForcePlatformType', 'windows', '+force_install_dir', '/data/originals/openloco',
      '+login', 'player', '+app_update', '356430', 'validate', '+quit'
    ])
  })

  it('refuses account names that could change the Terminal script', () => {
    expect(isSteamName('some_player42')).toBe(true)
    for (const name of ['', 'a', 'two words', "x'; rm -rf ~", 'name+quit', '$(id)']) expect(isSteamName(name)).toBe(false)
    expect(() => signInScript('/t/steamcmd.sh', '/h', 'x; id')).toThrow()
  })

  it('writes a Terminal script that keeps SteamCMD in its own home folder', () => {
    const script = signInScript("/Users/o'neil/Application Support/OGL/steamcmd.sh", '/data/home', 'player')
    expect(script).toContain("export HOME='/data/home'")
    expect(script).toContain(`'/Users/o'\\''neil/Application Support/OGL/steamcmd.sh' +login 'player' +quit`)
  })
})

describe('SteamCMD output', () => {
  it('spots the password prompt, which has no line end', () => {
    expect(readSteamOutput('password: ')).toEqual({ type: 'password' })
    expect(readSteamOutput('Cached credentials not found.')).toBeNull()
  })

  it('spots the Steam Guard prompts', () => {
    expect(readSteamOutput('Steam Guard code:')).toMatchObject({ progress: { phase: 'code' } })
    expect(readSteamOutput('Two-factor code:')).toMatchObject({ progress: { phase: 'code' } })
    expect(readSteamOutput('Please confirm the login in the Steam Mobile app on your phone.')).toMatchObject({
      progress: { phase: 'confirm' }
    })
  })

  it('reads download progress', () => {
    expect(readSteamOutput(' Update state (0x61) downloading, progress: 20.69 (14037656 / 67863136)')).toEqual({
      type: 'progress',
      progress: { phase: 'downloading', received: 14037656, total: 67863136 }
    })
    expect(readSteamOutput(' Update state (0x3) reconfiguring, progress: 0.00 (0 / 0)')).toMatchObject({
      progress: { phase: 'checking' }
    })
  })

  it('tells success from the ways it fails', () => {
    expect(readSteamOutput("Success! App '1007' fully installed.")).toEqual({ type: 'success' })
    expect(readSteamOutput("Logging in user 'x' [U:1:0] to Steam Public...ERROR (Invalid Password)")).toEqual({
      type: 'failure',
      message: 'Steam did not accept that name and password.'
    })
    expect(readSteamOutput("ERROR! Failed to install app '356430' (No subscription)")).toEqual({
      type: 'failure',
      message: 'This Steam account does not own the game.'
    })
    expect(readSteamOutput("ERROR! Failed to install app '356430' (Missing configuration)")).toEqual({
      type: 'failure',
      message: 'SteamCMD said: Missing configuration'
    })
  })
})

describe('game settings', () => {
  const folder = '/Users/me/Library/Application Support/OGL/originals/openrct2'

  it('replaces a key in its ini section and leaves the rest', () => {
    const text = '[general]\nrct1_path = ""\ngame_path = "/old"\n\n[sound]\ngame_path = "untouched"\n'
    const next = setIniValue(text, 'general', 'game_path', folder)
    expect(next).toBe(`[general]\nrct1_path = ""\ngame_path = "${folder}"\n\n[sound]\ngame_path = "untouched"\n`)
    expect(readIniValue(next, 'general', 'game_path')).toBe(folder)
  })

  it('adds the key or the section when missing', () => {
    expect(setIniValue('[general]\nfoo = 1\n', 'general', 'game_path', '/x')).toBe('[general]\ngame_path = "/x"\nfoo = 1\n')
    expect(setIniValue('', 'general', 'game_path', '/x')).toBe('[general]\ngame_path = "/x"\n')
    expect(setIniValue('[sound]\na = 1\n', 'general', 'game_path', '/x')).toBe('[sound]\na = 1\n\n[general]\ngame_path = "/x"\n')
    expect(readIniValue('', 'general', 'game_path')).toBe('')
  })

  it('sets a top-level YAML key', () => {
    expect(setYamlValue('', 'loco_install_path', '/x y')).toBe('loco_install_path: "/x y"\n')
    const text = 'display:\n  mode: window\nloco_install_path: /old\nlanguage: en-GB\n'
    const next = setYamlValue(text, 'loco_install_path', '/new')
    expect(next).toBe('display:\n  mode: window\nloco_install_path: "/new"\nlanguage: en-GB\n')
    expect(readYamlValue(next, 'loco_install_path')).toBe('/new')
    expect(readYamlValue(text, 'loco_install_path')).toBe('/old')
    expect(setYamlValue('language: en-GB\n', 'loco_install_path', '/x')).toBe('language: en-GB\nloco_install_path: "/x"\n')
  })
})
